import Message          from '../models/Message.js';
import Block            from '../models/Block.js';
import User             from '../models/User.js';
import PushSubscription from '../models/PushSubscription.js';
import webpush          from 'web-push';
import mongoose         from 'mongoose';
import { Expo }         from 'expo-server-sdk';

const { Types: { ObjectId } } = mongoose;
const expo = new Expo();

// ── Expo push helper (DM notifications) ─────────────────────────────────────
async function sendExpoPush({ recipientId, senderName, content, senderId }) {
  try {
    const recipient = await User.findById(recipientId).select('expoPushToken').lean();
    const token = recipient?.expoPushToken;
    if (!token || !Expo.isExpoPushToken(token)) return; // no valid token — skip

    const body = content.length > 80 ? content.slice(0, 77) + '…' : content;
    await expo.sendPushNotificationsAsync([{
      to:    token,
      title: senderName,
      body,
      sound: 'default',
      data: {
        type:       'message',
        senderId:   String(senderId),
        senderName,
      },
    }]);
  } catch (e) {
    // Never let a push failure break the message send
    console.error('[sendExpoPush] failed:', e.message);
  }
}

async function pushTo(userId, title, body) {
  try {
    const subs = await PushSubscription.find({ userId }).lean();
    const payload = JSON.stringify({ title, body, icon: '/icon.png' });
    for (const s of subs) webpush.sendNotification(s.subscription, payload).catch(() => {});
  } catch (_) {}
}

// ── GET /api/messages/conversations ─────────────────────────────────────────
export const getConversations = async (req, res) => {
  try {
    const me = new ObjectId(req.user.id);
    const convos = await Message.aggregate([
      { $match: { $or: [{ senderId: me }, { receiverId: me }] } },
      { $addFields: {
          partnerId: { $cond: [{ $eq: ['$senderId', me] }, '$receiverId', '$senderId'] }
      }},
      { $sort: { createdAt: -1 } },
      { $group: {
          _id: '$partnerId',
          lastMessage: { $first: '$$ROOT' },
          unreadCount: { $sum: {
            $cond: [{ $and: [{ $eq: ['$receiverId', me] }, { $eq: ['$readAt', null] }] }, 1, 0]
          }},
      }},
      { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'partner' } },
      { $unwind: '$partner' },
      { $project: {
          partner: { _id: 1, name: 1, avatar: 1 },
          lastMessage: { content: 1, createdAt: 1, senderId: 1 },
          unreadCount: 1,
      }},
      { $sort: { 'lastMessage.createdAt': -1 } },
    ]);
    res.json(convos);
  } catch (err) {
    console.error('[getConversations]', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── GET /api/messages/unread-count ──────────────────────────────────────────
export const getUnreadCount = async (req, res) => {
  try {
    const count = await Message.countDocuments({ receiverId: req.user.id, readAt: null });
    res.json({ count });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ── GET /api/messages/conversation/:userId ───────────────────────────────────
export const getMessages = async (req, res) => {
  try {
    const me    = req.user.id;
    const other = req.params.userId;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);

    const msgs = await Message.find({
      $or: [
        { senderId: me, receiverId: other },
        { senderId: other, receiverId: me },
      ],
    }).sort({ createdAt: 1 }).limit(limit).lean();

    // Mark received messages as read
    await Message.updateMany(
      { senderId: other, receiverId: me, readAt: null },
      { $set: { readAt: new Date() } }
    );

    res.json(msgs);
  } catch (err) {
    console.error('[getMessages]', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── POST /api/messages/send ──────────────────────────────────────────────────
export const sendMessage = async (req, res) => {
  try {
    const { receiverId, content } = req.body;
    const senderId = req.user.id;

    if (!receiverId || !content?.trim())
      return res.status(400).json({ message: 'receiverId and content are required.' });
    if (content.trim().length > 280)
      return res.status(400).json({ message: 'Message too long (max 280 chars).' });
    if (senderId === receiverId)
      return res.status(400).json({ message: 'Cannot message yourself.' });

    // Friends check — symmetric: either side having the other in their list is enough.
    // This handles friendships created before the bidirectional fix as well.
    const [me, them] = await Promise.all([
      User.findById(senderId).select('friends name').lean(),
      User.findById(receiverId).select('friends').lean(),
    ]);
    if (!me) return res.status(404).json({ message: 'Sender not found.' });
    if (!them) return res.status(404).json({ message: 'Recipient not found.' });

    const senderKnowsThem   = me?.friends?.some(f => f.toString() === receiverId);
    const receiverKnowsMe   = them?.friends?.some(f => f.toString() === senderId);
    if (!senderKnowsThem && !receiverKnowsMe)
      return res.status(403).json({ message: 'You can only message friends.' });

    // Block check
    const blocked = await Block.findOne({
      $or: [
        { blockerId: senderId, blockedId: receiverId },
        { blockerId: receiverId, blockedId: senderId },
      ],
    });
    if (blocked) {
      const recipientIsBlocker = blocked.blockerId.toString() === receiverId;
      return res.status(403).json({
        error:   'BLOCKED',
        message: recipientIsBlocker
          ? 'You have been blocked by this user.'
          : 'You have blocked this user.',
      });
    }

    // Daily limit: 20 messages per conversation per day
    const dayStart = new Date(); dayStart.setUTCHours(0, 0, 0, 0);
    const todayCount = await Message.countDocuments({
      senderId, receiverId, createdAt: { $gte: dayStart },
    });
    if (todayCount >= 20)
      return res.status(429).json({ message: 'Daily message limit reached. Come back tomorrow.' });

    const msg = await Message.create({ senderId, receiverId, content: content.trim() });

    // Web-push (browser subscribers)
    const preview = content.trim().slice(0, 50);
    await pushTo(receiverId, `💬 ${me.name}`, `${preview}${content.length > 50 ? '...' : ''}`);

    // Expo push (mobile app) — fire-and-forget, never throws
    sendExpoPush({
      recipientId: receiverId,
      senderName:  me.name,
      content:     content.trim(),
      senderId,
    });

    res.status(201).json(msg);
  } catch (err) {
    console.error('[sendMessage]', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── POST /api/messages/block/:userId ────────────────────────────────────────
export const blockUser = async (req, res) => {
  try {
    await Block.findOneAndUpdate(
      { blockerId: req.user.id, blockedId: req.params.userId },
      { blockerId: req.user.id, blockedId: req.params.userId },
      { upsert: true, setDefaultsOnInsert: true }
    );
    res.json({ message: 'User blocked.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ── DELETE /api/messages/block/:userId ──────────────────────────────────────
export const unblockUser = async (req, res) => {
  try {
    await Block.deleteOne({ blockerId: req.user.id, blockedId: req.params.userId });
    res.json({ message: 'User unblocked.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

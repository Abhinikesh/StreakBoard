import express from 'express';
import auth from '../middleware/auth.js';
import Message from '../models/Message.js';
import mongoose from 'mongoose';
import {
  getConversations, getUnreadCount, getMessages,
  sendMessage, blockUser, unblockUser,
} from '../controllers/messageController.js';

const router = express.Router();

router.get('/conversations',         auth, getConversations);
router.get('/unread-count',          auth, getUnreadCount);
router.get('/conversation/:userId',  auth, getMessages);
router.post('/send',                 auth, sendMessage);
router.post('/block/:userId',        auth, blockUser);
router.delete('/block/:userId',      auth, unblockUser);

// ── GET /api/messages/unread-counts ─────────────────────────────────────────
// Returns a map of { [friendId]: unreadCount } for all conversations
router.get('/unread-counts', auth, async (req, res) => {
  try {
    const me = new mongoose.Types.ObjectId(req.user.id);
    const counts = await Message.aggregate([
      { $match: { receiverId: me, readAt: null } },
      { $group: { _id: '$senderId', count: { $sum: 1 } } },
    ]);
    // Convert array to a plain object map: { friendId: count }
    const map = {};
    for (const { _id, count } of counts) map[_id.toString()] = count;
    res.json(map);
  } catch (err) {
    console.error('[unread-counts]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── PATCH /api/messages/mark-read/:friendId ──────────────────────────────────
// Marks all messages from :friendId to the current user as read
router.patch('/mark-read/:friendId', auth, async (req, res) => {
  try {
    const result = await Message.updateMany(
      { senderId: req.params.friendId, receiverId: req.user.id, readAt: null },
      { $set: { readAt: new Date() } }
    );
    res.json({ marked: result.modifiedCount });
  } catch (err) {
    console.error('[mark-read]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;

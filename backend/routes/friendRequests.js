import express from 'express';
import auth from '../middleware/auth.js';
import FriendRequest from '../models/FriendRequest.js';
import User from '../models/User.js';
import sendPushNotification from '../utils/sendPushNotification.js';

const router = express.Router();

// ── POST /api/friend-requests/send ──────────────────────────────────────────
// Body: { toUserId }
router.post('/send', auth, async (req, res) => {
  try {
    const fromId = req.user.id;
    const { toUserId } = req.body;

    if (!toUserId)
      return res.status(400).json({ message: 'toUserId is required.' });
    if (fromId === toUserId)
      return res.status(400).json({ message: 'You cannot send a request to yourself.' });

    // Check they aren't already friends
    const me = await User.findById(fromId).select('friends name').lean();
    if (!me) return res.status(404).json({ message: 'User not found.' });
    if (me.friends.some(f => f.toString() === toUserId))
      return res.status(409).json({ message: 'You are already friends.' });

    // Upsert: re-send a previously declined request by resetting to pending
    const request = await FriendRequest.findOneAndUpdate(
      { from: fromId, to: toUserId },
      { status: 'pending' },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Push notification to recipient
    const toUser = await User.findById(toUserId).select('name').lean();
    await sendPushNotification(
      toUserId,
      '👋 New Friend Request',
      `${me.name} wants to be your friend!`
    );

    res.status(201).json(request);
  } catch (err) {
    if (err.code === 11000)
      return res.status(409).json({ message: 'Friend request already sent.' });
    console.error('[friendRequests/send]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── GET /api/friend-requests/incoming ───────────────────────────────────────
// Returns all pending requests where `to` === current user
router.get('/incoming', auth, async (req, res) => {
  try {
    const requests = await FriendRequest.find({ to: req.user.id, status: 'pending' })
      .populate('from', 'name avatar shareCode')
      .sort({ createdAt: -1 })
      .lean();
    res.json(requests);
  } catch (err) {
    console.error('[friendRequests/incoming]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── PATCH /api/friend-requests/accept/:id ───────────────────────────────────
router.patch('/accept/:id', auth, async (req, res) => {
  try {
    const request = await FriendRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: 'Request not found.' });
    if (request.to.toString() !== req.user.id)
      return res.status(403).json({ message: 'Not authorised.' });
    if (request.status !== 'pending')
      return res.status(409).json({ message: `Request is already ${request.status}.` });

    request.status = 'accepted';
    await request.save();

    // Add each other as friends (bidirectional)
    await Promise.all([
      User.findByIdAndUpdate(request.from, { $addToSet: { friends: request.to } }),
      User.findByIdAndUpdate(request.to,   { $addToSet: { friends: request.from } }),
    ]);

    // Notify the sender
    const acceptor = await User.findById(req.user.id).select('name').lean();
    await sendPushNotification(
      request.from.toString(),
      '🎉 Friend Request Accepted',
      `${acceptor.name} accepted your friend request!`
    );

    res.json({ message: 'Friend request accepted.', request });
  } catch (err) {
    console.error('[friendRequests/accept]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ── PATCH /api/friend-requests/decline/:id ──────────────────────────────────
router.patch('/decline/:id', auth, async (req, res) => {
  try {
    const request = await FriendRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: 'Request not found.' });
    if (request.to.toString() !== req.user.id)
      return res.status(403).json({ message: 'Not authorised.' });
    if (request.status !== 'pending')
      return res.status(409).json({ message: `Request is already ${request.status}.` });

    request.status = 'declined';
    await request.save();

    res.json({ message: 'Friend request declined.', request });
  } catch (err) {
    console.error('[friendRequests/decline]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;

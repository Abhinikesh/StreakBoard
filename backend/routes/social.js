import express from 'express';
import authMiddleware from '../middleware/auth.js';
import {
  enableSharing,
  disableSharing,
  getMyShareInfo,
  getPublicProfile,
  getProfileById,
  addFriend,
  getFriends,
  removeFriend,
  getLeaderboard,
  // ── Friend-request system (called by mobile app under /api/social/*) ──────
  sendFriendRequest,
  getIncomingRequests,
  acceptFriendRequest,
  declineFriendRequest,
  cancelFriendRequest,
  getFriendStatus,
  removeFriendById,
} from '../controllers/socialController.js';

const router = express.Router();

// ── Public (no auth) ─────────────────────────────────────────────────────────
router.get('/u/:shareCode', getPublicProfile);

// ── Profile & sharing ────────────────────────────────────────────────────────
router.post('/enable',            authMiddleware, enableSharing);
router.post('/disable',           authMiddleware, disableSharing);
router.get('/my-share',           authMiddleware, getMyShareInfo);
router.get('/profile/:userId',    authMiddleware, getProfileById);

// ── Legacy direct-add (share code → immediate friendship, used by website) ───
router.post('/friends/add',          authMiddleware, addFriend);
router.get('/friends',               authMiddleware, getFriends);
router.delete('/friends/:shareCode', authMiddleware, removeFriend);      // by shareCode (website)
router.delete('/friends/by-id/:userId', authMiddleware, removeFriendById); // by userId (mobile)

// ── Friend-request CRUD (mobile app uses these) ───────────────────────────────
// NOTE: specific route /friend-requests/incoming must come BEFORE /:id routes
router.post('/friend-requests',              authMiddleware, sendFriendRequest);
router.get('/friend-requests',               authMiddleware, getIncomingRequests);
router.patch('/friend-requests/:id/accept',  authMiddleware, acceptFriendRequest);
router.patch('/friend-requests/:id/decline', authMiddleware, declineFriendRequest);
router.delete('/friend-requests/:id',        authMiddleware, cancelFriendRequest);

// ── Friend status (for profile button states) ─────────────────────────────────
router.get('/friend-status/:userId', authMiddleware, getFriendStatus);

// ── Leaderboard ───────────────────────────────────────────────────────────────
router.get('/leaderboard', authMiddleware, getLeaderboard);

export default router;

import express from 'express';
import auth from '../middleware/auth.js';
import FriendChallenge from '../models/FriendChallenge.js';
import {
  createChallenge,
  getMyChallenges,
  acceptChallenge,
  declineChallenge,
} from '../controllers/friendChallengeController.js';

const router = express.Router();

router.post('/',           auth, createChallenge);
router.get('/',            auth, getMyChallenges);
router.patch('/:id/accept', auth, acceptChallenge);
router.patch('/:id/decline', auth, declineChallenge);

// ── GET /api/friend-challenges/pending-count ─────────────────────────────────
// Returns the number of pending challenges sent TO the current user
router.get('/pending-count', auth, async (req, res) => {
  try {
    const count = await FriendChallenge.countDocuments({
      challengedId: req.user.id,
      status: 'pending',
    });
    res.json({ count });
  } catch (err) {
    console.error('[pending-count]', err);
    res.status(500).json({ message: 'Server error' });
  }
});

export default router;

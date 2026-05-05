import express from 'express';
import auth from '../middleware/auth.js';
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
router.patch('/:id/decline',auth, declineChallenge);

export default router;

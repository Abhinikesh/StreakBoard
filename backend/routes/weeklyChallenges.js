import express from 'express';
import auth from '../middleware/auth.js';
import { getCurrent, getMyProgress, getLeaderboard } from '../controllers/weeklyChallengeController.js';

const router = express.Router();

router.get('/current',    auth, getCurrent);
router.get('/my-progress',auth, getMyProgress);
router.get('/leaderboard',auth, getLeaderboard);

export default router;

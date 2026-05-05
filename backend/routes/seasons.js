import express from 'express';
import auth from '../middleware/auth.js';
import {
  getCurrentSeason,
  getSeasonLeaderboard,
  getMySeasonRank,
  getPastSeasons,
} from '../controllers/seasonController.js';

const router = express.Router();

router.get('/current',     auth, getCurrentSeason);
router.get('/leaderboard', auth, getSeasonLeaderboard);
router.get('/my-rank',     auth, getMySeasonRank);
router.get('/past',        auth, getPastSeasons);

export default router;

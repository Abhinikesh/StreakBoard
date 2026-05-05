/**
 * controllers/seasonController.js
 *
 * GET /api/seasons/current     — current season + days remaining
 * GET /api/seasons/leaderboard — top 50 users this season by bestStreak
 * GET /api/seasons/my-rank     — auth'd user's rank + bestStreak this season
 * GET /api/seasons/past        — last 3 ended seasons with winner info
 */
import Season        from '../models/Season.js';
import SeasonRanking from '../models/SeasonRanking.js';
import User          from '../models/User.js';
import { getLevelInfo } from '../lib/xp.js';

// ── GET /api/seasons/current ──────────────────────────────────────────────────
export const getCurrentSeason = async (req, res) => {
  try {
    const season = await Season.findOne({ status: 'active' }).lean();
    if (!season) return res.json(null);

    const now = new Date();
    const daysRemaining = Math.ceil((new Date(season.endDate) - now) / (1000 * 60 * 60 * 24));
    res.json({ ...season, daysRemaining: Math.max(0, daysRemaining) });
  } catch (err) {
    console.error('[getCurrentSeason]', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── GET /api/seasons/leaderboard ─────────────────────────────────────────────
export const getSeasonLeaderboard = async (req, res) => {
  try {
    const season = await Season.findOne({ status: 'active' }).select('_id').lean();
    if (!season) return res.json([]);

    const rankings = await SeasonRanking.find({ seasonId: season._id })
      .sort({ bestStreak: -1 })
      .limit(50)
      .populate('userId', 'name avatar currentLevel shareCode')
      .lean();

    const result = rankings
      .filter((r) => r.userId) // skip orphan records
      .map((r, i) => ({
        rank:         i + 1,
        _id:          r.userId._id,
        name:         r.userId.name || 'StreakBoard User',
        avatar:       r.userId.avatar || null,
        currentLevel: r.userId.currentLevel || 1,
        shareCode:    r.userId.shareCode || null,
        bestStreak:   r.bestStreak || 0,
        // Normalise to all-time shape so LeaderboardRow works unchanged
        currentStreak:  r.bestStreak || 0,
        streak:         r.bestStreak || 0,
        completionRate: 0,
        totalDone:      0,
      }));

    res.json(result);
  } catch (err) {
    console.error('[getSeasonLeaderboard]', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── GET /api/seasons/my-rank ──────────────────────────────────────────────────
export const getMySeasonRank = async (req, res) => {
  try {
    const season = await Season.findOne({ status: 'active' }).lean();
    if (!season) return res.json({ rank: null, bestStreak: 0, season: null });

    const myRanking = await SeasonRanking.findOne({
      seasonId: season._id, userId: req.user.id,
    }).lean();

    if (!myRanking) return res.json({ rank: null, bestStreak: 0, season });

    // Count users ranked strictly above me
    const rank = await SeasonRanking.countDocuments({
      seasonId:   season._id,
      bestStreak: { $gt: myRanking.bestStreak },
    }) + 1;

    res.json({ rank, bestStreak: myRanking.bestStreak, season });
  } catch (err) {
    console.error('[getMySeasonRank]', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── GET /api/seasons/past ─────────────────────────────────────────────────────
export const getPastSeasons = async (req, res) => {
  try {
    const past = await Season.find({ status: 'ended' })
      .sort({ endDate: -1 })
      .limit(3)
      .lean();

    const result = await Promise.all(
      past.map(async (s) => {
        const winner = await SeasonRanking.findOne({ seasonId: s._id, rank: 1 })
          .populate('userId', 'name avatar')
          .lean();
        return {
          ...s,
          winner: winner?.userId
            ? { name: winner.userId.name, bestStreak: winner.bestStreak, avatar: winner.userId.avatar }
            : null,
        };
      })
    );

    res.json(result);
  } catch (err) {
    console.error('[getPastSeasons]', err);
    res.status(500).json({ message: 'Server error' });
  }
};

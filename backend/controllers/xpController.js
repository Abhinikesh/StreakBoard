/**
 * controllers/xpController.js
 *
 * GET /api/xp/profile  — Current XP profile for the authenticated user.
 * GET /api/xp/history  — Last 20 XP events.
 */
import User    from '../models/User.js';
import XpEvent from '../models/XpEvent.js';
import { getLevelInfo } from '../lib/xp.js';

// ── GET /api/xp/profile ───────────────────────────────────────────────────────
export const getXpProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('totalXp currentLevel')
      .lean();

    if (!user) return res.status(404).json({ message: 'User not found' });

    const totalXp = user.totalXp || 0;
    const { current, next, xpIntoLevel, xpNeeded, progress } = getLevelInfo(totalXp);

    res.json({
      totalXp,
      currentLevel:  current.level,
      levelName:     current.name,
      nextLevel:     next?.level    ?? null,
      nextLevelName: next?.name     ?? null,
      xpIntoLevel,
      xpNeeded,
      xpToNext:      next ? next.minXp - totalXp : 0,
      progress,      // 0.0 – 1.0 fraction into current level
    });
  } catch (err) {
    console.error('[getXpProfile]', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── GET /api/xp/history ───────────────────────────────────────────────────────
export const getXpHistory = async (req, res) => {
  try {
    const events = await XpEvent.find({ userId: req.user.id })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    res.json(events.map(e => ({
      _id:       e._id,
      amount:    e.amount,
      reason:    e.reason,
      createdAt: e.createdAt,
    })));
  } catch (err) {
    console.error('[getXpHistory]', err);
    res.status(500).json({ message: 'Server error' });
  }
};

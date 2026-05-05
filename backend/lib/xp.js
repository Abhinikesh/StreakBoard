import User from '../models/User.js';
import XpEvent from '../models/XpEvent.js';

const LEVELS = [
  { level: 1,  name: 'Beginner',    minXp: 0 },
  { level: 2,  name: 'Apprentice',  minXp: 200 },
  { level: 3,  name: 'Consistent',  minXp: 500 },
  { level: 4,  name: 'Dedicated',   minXp: 1_000 },
  { level: 5,  name: 'Focused',     minXp: 2_000 },
  { level: 6,  name: 'Disciplined', minXp: 3_500 },
  { level: 7,  name: 'Committed',   minXp: 5_500 },
  { level: 8,  name: 'Expert',      minXp: 8_000 },
  { level: 9,  name: 'Elite',       minXp: 12_000 },
  { level: 10, name: 'Grandmaster', minXp: 18_000 },
];

export function getLevelInfo(totalXp = 0) {
  let current = LEVELS[0];
  let next    = LEVELS[1] || null;

  for (let i = 0; i < LEVELS.length; i++) {
    if (totalXp >= LEVELS[i].minXp) {
      current = LEVELS[i];
      next    = LEVELS[i + 1] || null;
    }
  }

  const xpIntoLevel = next ? totalXp - current.minXp : 0;
  const xpNeeded    = next ? next.minXp - current.minXp : 0;
  const progress    = xpNeeded > 0 ? xpIntoLevel / xpNeeded : 1;

  return { current, next, xpIntoLevel, xpNeeded, progress };
}

export async function grantXp(userId, amount, reason, milestoneKey = null) {
  try {
    if (milestoneKey) {
      const u = await User.findById(userId).select('xpMilestonesHit').lean();
      if (!u) return null;
      if (u.xpMilestonesHit?.includes(milestoneKey)) return null;
    }

    const old = await User.findById(userId).select('totalXp currentLevel').lean();
    if (!old) return null;
    const oldLevel = old.currentLevel || 1;

    await XpEvent.create({ userId, amount, reason: reason.slice(0, 120) });

    const updateOp = { $inc: { totalXp: amount } };
    if (milestoneKey) updateOp.$addToSet = { xpMilestonesHit: milestoneKey };

    const updated = await User.findByIdAndUpdate(userId, updateOp, { new: true })
      .select('totalXp currentLevel');
    if (!updated) return null;

    const { current: newLevelData } = getLevelInfo(updated.totalXp);
    if (newLevelData.level !== updated.currentLevel) {
      await User.updateOne({ _id: userId }, { $set: { currentLevel: newLevelData.level } });
    }

    return {
      newXp:        updated.totalXp,
      oldLevel,
      newLevel:     newLevelData.level,
      newLevelName: newLevelData.name,
      leveledUp:    newLevelData.level > oldLevel,
    };
  } catch (err) {
    console.error('[grantXp]', err.message);
    return null;
  }
}

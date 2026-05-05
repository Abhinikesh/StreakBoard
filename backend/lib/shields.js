/**
 * backend/lib/shields.js
 *
 * Shield engine:
 *  - grantShield(userId, amount, reason, milestoneKey?) — award shields with dedup
 *  - MAX_SHIELDS = 3
 */
import User         from '../models/User.js';
import ShieldEvent  from '../models/ShieldEvent.js';

export const MAX_SHIELDS = 3;

/**
 * Award streak shields to a user.
 *
 * @param {string|ObjectId} userId
 * @param {number}          amount       - Number of shields to grant (1 or 2)
 * @param {string}          reason       - Human-readable reason (max 120 chars)
 * @param {string|null}     milestoneKey - If provided, deduplicates via xpMilestonesHit
 * @returns {Promise<{shieldsGranted: number}|null>}
 *          null if milestone already hit or user already at cap
 */
export async function grantShield(userId, amount, reason, milestoneKey = null) {
  try {
    // ── 1. Milestone dedup via shared xpMilestonesHit array ───────────────
    if (milestoneKey) {
      const u = await User.findById(userId).select('xpMilestonesHit shieldCount').lean();
      if (!u) return null;
      if (u.xpMilestonesHit?.includes(milestoneKey)) return null;

      // Cap: only add as many as space allows
      const space = MAX_SHIELDS - (u.shieldCount || 0);
      const toAdd = Math.min(amount, space);

      // Record milestone even if capped, so we don't re-attempt
      const update = { $addToSet: { xpMilestonesHit: milestoneKey } };
      if (toAdd > 0) {
        update.$inc = { shieldCount: toAdd };
        await ShieldEvent.create({ userId, eventType: 'earned', reason: reason.slice(0, 120) });
      }
      await User.findByIdAndUpdate(userId, update);
      return toAdd > 0 ? { shieldsGranted: toAdd } : null;
    }

    // ── 2. No milestone key — just cap and add ─────────────────────────────
    const u = await User.findById(userId).select('shieldCount').lean();
    if (!u) return null;
    const space = MAX_SHIELDS - (u.shieldCount || 0);
    const toAdd = Math.min(amount, space);
    if (toAdd <= 0) return null;

    await ShieldEvent.create({ userId, eventType: 'earned', reason: reason.slice(0, 120) });
    await User.findByIdAndUpdate(userId, { $inc: { shieldCount: toAdd } });
    return { shieldsGranted: toAdd };
  } catch (err) {
    console.error('[grantShield]', err.message);
    return null; // never throw — shield errors must not break main flow
  }
}

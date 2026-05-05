/**
 * backend/lib/seasonUtils.js
 *
 * Core season utilities:
 *  - ensureActiveSeason()   — idempotent, called at server start
 *  - runSeasonReset()       — called by cron at 00:05 UTC on 1st of each month
 */
import Season        from '../models/Season.js';
import SeasonRanking from '../models/SeasonRanking.js';
import User          from '../models/User.js';
import HabitLog      from '../models/HabitLog.js';
import PushSubscription from '../models/PushSubscription.js';
import webpush       from 'web-push';
import { grantXp }   from './xp.js';

const MONTHS = ['January','February','March','April','May','June',
                 'July','August','September','October','November','December'];

function seasonNumber(year, month0) {
  return (year - 2026) * 12 + (month0 + 1); // May 2026 = 5
}

// ── ensureActiveSeason ────────────────────────────────────────────────────────
export async function ensureActiveSeason() {
  const existing = await Season.findOne({ status: 'active' }).lean();
  if (existing) return existing;

  const now   = new Date();
  const year  = now.getUTCFullYear();
  const month = now.getUTCMonth(); // 0-indexed

  const startDate = new Date(Date.UTC(year, month, 1));
  const endDate   = new Date(Date.UTC(year, month + 1, 1)); // exclusive upper bound

  const num  = seasonNumber(year, month);
  const name = `${MONTHS[month]} ${year} Season`;

  try {
    return await Season.create({ seasonNumber: num, name, startDate, endDate, status: 'active' });
  } catch (err) {
    if (err.code === 11000) return Season.findOne({ seasonNumber: num }).lean();
    throw err;
  }
}

// ── runSeasonReset ────────────────────────────────────────────────────────────
// Called by cron at 00:05 UTC on 1st of each month.
export async function runSeasonReset() {
  // 1. Find the season that just ended (its endDate <= now)
  const now = new Date();
  const endingSeason = await Season.findOne({
    status:  'active',
    endDate: { $lte: now },
  });

  if (!endingSeason) {
    console.log('[SeasonReset] No ended season found — may have already been reset');
    await ensureActiveSeason();
    return;
  }

  console.log(`[SeasonReset] Closing season: ${endingSeason.name}`);

  // 2. Get all rankings sorted by bestStreak desc
  const rankings = await SeasonRanking.find({ seasonId: endingSeason._id })
    .sort({ bestStreak: -1 })
    .lean();

  // 3. Assign ranks and distribute rewards
  for (let i = 0; i < rankings.length; i++) {
    const r    = rankings[i];
    const rank = i + 1;

    if (r.rewardsDistributed) continue;

    // Count distinct logged days in this season window
    const daysLogged = await HabitLog.distinct('date', {
      userId: r.userId,
      date: {
        $gte: endingSeason.startDate.toISOString().split('T')[0],
        $lt:  endingSeason.endDate.toISOString().split('T')[0],
      },
    }).then(d => d.length);

    // XP reward amounts by rank
    let xpAmount = 0;
    let badgeType = null;
    let notifMsg  = '';

    if (rank === 1) {
      xpAmount = 1000;
      badgeType = 'champion';
      notifMsg  = `🏆 Season over! You finished Rank 1. +${xpAmount} XP and Season Champion badge awarded!`;
    } else if (rank === 2) {
      xpAmount = 600;
      badgeType = 'runner_up';
      notifMsg  = `🥈 Season over! You finished Rank 2. +${xpAmount} XP and Season Runner-up badge awarded!`;
    } else if (rank === 3) {
      xpAmount = 400;
      badgeType = 'podium';
      notifMsg  = `🥉 Season over! You finished Rank 3. +${xpAmount} XP and Season Podium badge awarded!`;
    } else if (rank <= 10) {
      xpAmount = 200;
      badgeType = 'top10';
      notifMsg  = `✨ Season over! You finished Top 10 (Rank ${rank}). +${xpAmount} XP awarded!`;
    } else {
      notifMsg = `${endingSeason.name} is over. New season starts now — fresh start, get to the top! 🚀`;
    }

    // Participant bonus (15+ distinct days logged)
    let bonusXp = 0;
    if (daysLogged >= 15 && rank > 10) {
      bonusXp = 100;
      notifMsg = `Great effort! You logged ${daysLogged} days this season. +100 XP bonus! New season starts now.`;
    }

    // Grant XP (no milestone key — season rewards are unique per-season by design)
    const seasonXpKey = `season_reward_${endingSeason._id}_${r.userId}`;
    if (xpAmount > 0) {
      await grantXp(r.userId, xpAmount,
        `${endingSeason.name} — Rank ${rank} reward`, seasonXpKey);
    }
    if (bonusXp > 0) {
      await grantXp(r.userId, bonusXp,
        `${endingSeason.name} — 15+ days participation bonus`,
        `${seasonXpKey}_bonus`);
    }

    // Award season badge
    if (badgeType) {
      const monthYear = endingSeason.name.replace(' Season', '');
      await User.findByIdAndUpdate(r.userId, {
        $push: {
          seasonBadges: {
            $each: [{ type: badgeType, season: endingSeason.name, month: monthYear, rank, awardedAt: new Date() }],
            $slice: -10, // keep latest 10
          },
        },
      });
    }

    // Mark ranking as distributed
    await SeasonRanking.findByIdAndUpdate(r._id, { rank, rewardsDistributed: true });

    // Send push notification
    const user = await User.findById(r.userId).select('pushNotificationsEnabled').lean();
    if (user?.pushNotificationsEnabled !== false) {
      const subs = await PushSubscription.find({ userId: r.userId }).lean();
      const payload = JSON.stringify({
        title: '🏆 Season Over!',
        body:  notifMsg,
        icon:  '/icon.png',
      });
      for (const sub of subs) {
        webpush.sendNotification(sub.subscription, payload).catch(() => {});
      }
    }
  }

  // 4. Close the season
  await Season.findByIdAndUpdate(endingSeason._id, { status: 'ended' });
  console.log(`[SeasonReset] ${endingSeason.name} closed. Rewards distributed to ${rankings.length} users.`);

  // 5. Create new season for current month
  const newSeason = await ensureActiveSeason();
  console.log(`[SeasonReset] New season created: ${newSeason.name}`);
}

/**
 * backend/lib/weeklyChallenge.js
 *
 * Core utilities:
 *  - ensureCurrentChallenge()      — idempotent, called at server start
 *  - evaluateUserProgress(userId)  — recalculates from logs, awards XP on first completion
 *  - runWeeklyReset()              — called by cron every Monday 00:05 UTC
 */
import WeeklyChallenge            from '../models/WeeklyChallenge.js';
import WeeklyChallengeParticipant from '../models/WeeklyChallengeParticipant.js';
import HabitLog                   from '../models/HabitLog.js';
import Habit                      from '../models/Habit.js';
import User                       from '../models/User.js';
import PushSubscription           from '../models/PushSubscription.js';
import webpush                    from 'web-push';
import { grantXp }                from './xp.js';

// ── Challenge templates — cycled weekly ──────────────────────────────────────
const TEMPLATES = [
  {
    title: 'Daily Logger',
    description: 'Log at least one habit every single day this week. Seven days, seven logs.',
    type: 'daily_log', targetValue: 7,
  },
  {
    title: 'Five-Day Champion',
    description: 'Complete every one of your active habits on at least 5 out of 7 days this week.',
    type: 'full_day', targetValue: 5,
  },
  {
    title: 'Three-Day Streak',
    description: 'Log your habits on 3 consecutive days this week. Keep the chain going.',
    type: 'streak', targetValue: 3,
  },
  {
    title: 'Early Bird',
    description: 'Log at least one habit before 9 AM UTC on 3 different days this week.',
    type: 'early_bird', targetValue: 3,
  },
  {
    title: 'Perfect Day',
    description: 'Complete 100% of all your active habits on at least one day this week.',
    type: 'perfect_day', targetValue: 1,
  },
];

// ── Week boundary helpers ─────────────────────────────────────────────────────
function getMondayOfWeek(d = new Date()) {
  const day = d.getUTCDay(); // 0=Sun
  const daysBack = day === 0 ? 6 : day - 1;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() - daysBack));
}

// ── ensureCurrentChallenge ────────────────────────────────────────────────────
export async function ensureCurrentChallenge() {
  const existing = await WeeklyChallenge.findOne({ status: 'active' }).lean();
  if (existing) return existing;

  const last = await WeeklyChallenge.findOne().sort({ endDate: -1 }).lean();
  const nextIdx = last != null ? (last.templateIndex + 1) % TEMPLATES.length : 0;
  const template = TEMPLATES[nextIdx];

  const startDate = getMondayOfWeek();
  const endDate   = new Date(startDate.getTime() + 7 * 24 * 60 * 60 * 1000);

  try {
    return await WeeklyChallenge.create({ ...template, startDate, endDate, templateIndex: nextIdx, status: 'active' });
  } catch (err) {
    if (err.code === 11000) return WeeklyChallenge.findOne({ status: 'active' }).lean();
    throw err;
  }
}

// ── evaluateUserProgress ──────────────────────────────────────────────────────
// Called from logController after every 'done' log.
// Recalculates progress from scratch so it's always accurate.
export async function evaluateUserProgress(userId, challenge) {
  try {
    const start = new Date(challenge.startDate).toISOString().split('T')[0];
    const end   = new Date(challenge.endDate).toISOString().split('T')[0];
    let progress = 0;

    if (challenge.type === 'daily_log') {
      const dates = await HabitLog.distinct('date', { userId, date: { $gte: start, $lt: end }, status: 'done' });
      progress = dates.length;

    } else if (challenge.type === 'full_day' || challenge.type === 'perfect_day') {
      const active = await Habit.countDocuments({ userId, isActive: true });
      if (active > 0) {
        const dates = await HabitLog.distinct('date', { userId, date: { $gte: start, $lt: end } });
        for (const date of dates) {
          const done = await HabitLog.countDocuments({ userId, date, status: 'done' });
          if (done >= active) { progress++; if (challenge.type === 'perfect_day') break; }
        }
      }

    } else if (challenge.type === 'streak') {
      const dates = (await HabitLog.distinct('date', { userId, date: { $gte: start, $lt: end }, status: 'done' })).sort();
      let max = 0, cur = 0;
      for (let i = 0; i < dates.length; i++) {
        cur = (i > 0 && Math.round((new Date(dates[i]+'T00:00:00Z') - new Date(dates[i-1]+'T00:00:00Z')) / 86400000) === 1)
          ? cur + 1 : 1;
        max = Math.max(max, cur);
      }
      progress = max;

    } else if (challenge.type === 'early_bird') {
      const logs = await HabitLog.find({ userId, date: { $gte: start, $lt: end }, status: 'done' })
        .select('date createdAt').lean();
      const earlyDates = new Set(logs.filter(l => new Date(l.createdAt).getUTCHours() < 9).map(l => l.date));
      progress = earlyDates.size;
    }

    // Load previous state before upserting
    const prev = await WeeklyChallengeParticipant.findOne({ challengeId: challenge._id, userId }).lean();
    const wasCompleted = prev?.completed || false;
    const completed    = progress >= challenge.targetValue;

    const update = { $set: { currentProgress: progress, completed } };
    if (completed && !wasCompleted) update.$set.completedAt = new Date();

    await WeeklyChallengeParticipant.findOneAndUpdate(
      { challengeId: challenge._id, userId },
      { ...update, $setOnInsert: { rewardDistributed: false, badgeType: null } },
      { upsert: true }
    );

    // Award XP + push on first-ever completion
    if (completed && !wasCompleted) {
      const xpKey = `weekly_challenge_${challenge._id}_${userId}`;
      await grantXp(userId, 150, `Completed weekly challenge: ${challenge.title}`, xpKey);

      const u = await User.findById(userId).select('pushNotificationsEnabled').lean();
      if (u?.pushNotificationsEnabled !== false) {
        const subs = await PushSubscription.find({ userId }).lean();
        const payload = JSON.stringify({
          title: '🎉 Challenge Completed!',
          body: `You completed "${challenge.title}". +150 XP awarded!`,
          icon: '/icon.png',
        });
        for (const sub of subs) webpush.sendNotification(sub.subscription, payload).catch(() => {});
      }

      await WeeklyChallengeParticipant.findOneAndUpdate(
        { challengeId: challenge._id, userId }, { $set: { rewardDistributed: true } }
      );
    }

    return { progress, completed };
  } catch (err) {
    console.error('[evaluateUserProgress]', err.message);
    return { progress: 0, completed: false };
  }
}

// ── runWeeklyReset ────────────────────────────────────────────────────────────
export async function runWeeklyReset() {
  const now = new Date();
  const ending = await WeeklyChallenge.findOne({ status: 'active', endDate: { $lte: now } });
  if (ending) {
    // Award top-10 winner badge, rest get participant badge
    const completed = await WeeklyChallengeParticipant.find({ challengeId: ending._id, completed: true })
      .sort({ currentProgress: -1, completedAt: 1 }).lean();

    for (let i = 0; i < completed.length; i++) {
      const badge = i < 10 ? 'winner' : 'participant';
      await WeeklyChallengeParticipant.findByIdAndUpdate(completed[i]._id, { $set: { badgeType: badge } });

      // Push notification for top 10
      if (i < 10) {
        const u = await User.findById(completed[i].userId).select('pushNotificationsEnabled').lean();
        if (u?.pushNotificationsEnabled !== false) {
          const subs = await PushSubscription.find({ userId: completed[i].userId }).lean();
          const payload = JSON.stringify({
            title: '🏅 Weekly Winner!',
            body: `You finished in the top 10 this week. Great work!`,
            icon: '/icon.png',
          });
          for (const sub of subs) webpush.sendNotification(sub.subscription, payload).catch(() => {});
        }
      }
    }

    await WeeklyChallenge.findByIdAndUpdate(ending._id, { status: 'ended' });
    console.log(`[WeeklyCron] Closed: ${ending.title} — ${completed.length} completions`);
  }
  await ensureCurrentChallenge();
}

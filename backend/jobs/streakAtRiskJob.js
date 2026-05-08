/**
 * jobs/streakAtRiskJob.js
 *
 * Sends a calm "your streak is at risk" push notification to users who:
 *   1. Have an active streak of ≥ 3 days (measured as the MAX streak across all active habits)
 *   2. Have NOT logged any habit yet today (UTC date)
 *   3. Haven't already received this alert today (lastStreakAtRiskAlert !== todayStr)
 *
 * Called from reminderJob.js in two places:
 *   a) Fixed cron at 15:30 UTC  → 9 PM IST (primary user base)
 *   b) Per-minute cron when a user's reminderTime fires and is >= "15:30" UTC
 *      (handles users who set a later personal reminder time)
 *
 * Does NOT touch: habit logging, streak calculation, re-engagement flow,
 * existing personal reminders, or global reminders.
 */

import webpush          from 'web-push';
import User             from '../models/User.js';
import Habit            from '../models/Habit.js';
import HabitLog         from '../models/HabitLog.js';
import PushSubscription from '../models/PushSubscription.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

const pad   = n  => String(n).padStart(2, '0');
const toUTC = d  => `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}`;

/**
 * Computes the streak for a single habit given its full log date set.
 * Because we call this only when today is NOT logged, the streak is measured
 * backwards from yesterday.
 *
 * Both 'done' and 'missed' entries count (same rule as logController).
 * A day with NO log at all breaks the streak.
 */
function streakFromDates(loggedDates, todayStr) {
  // Build yesterday's date string relative to todayStr
  const todayD     = new Date(todayStr + 'T12:00:00Z'); // noon UTC avoids DST edges
  const yesterdayD = new Date(todayD);
  yesterdayD.setUTCDate(yesterdayD.getUTCDate() - 1);
  const yesterdayStr = toUTC(yesterdayD);

  // If yesterday has no log → streak is already dead → nothing to protect
  if (!loggedDates.has(yesterdayStr)) return 0;

  let count = 0;
  const cur = new Date(yesterdayD);
  while (true) {
    const ds = toUTC(cur);
    if (loggedDates.has(ds)) {
      count++;
      cur.setUTCDate(cur.getUTCDate() - 1);
    } else {
      break;
    }
  }
  return count;
}

/**
 * Returns the notification body text based on streak length.
 * Tone: direct, calm, no exclamation overload.
 */
function buildBody(streak) {
  if (streak >= 30) {
    return `${streak} days. That is serious. Log before midnight.`;
  }
  if (streak >= 7) {
    return `${streak} days strong. Don't let it end tonight. You have time.`;
  }
  // 3–6
  return `You have a ${streak}-day streak. Log something before midnight to keep it.`;
}

/**
 * Sends a web-push notification to all registered subscriptions for a user.
 * Silently removes stale (410 / 404) subscriptions.
 */
async function pushToUser(userId, title, body) {
  const subs = await PushSubscription.find({ userId }).lean();
  if (!subs.length) return;

  const payload = JSON.stringify({
    title,
    body,
    icon:  '/icon-192.png',
    badge: '/icon-192.png',
    tag:   'streak-at-risk',   // same tag collapses duplicates on the device
    data:  { url: '/dashboard' },
  });

  for (const sub of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys },
        payload
      );
    } catch (err) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        // Subscription expired — clean up
        await PushSubscription.deleteOne({ _id: sub._id }).catch(() => {});
      }
      // All other errors: silent — don't let one bad sub break the loop
    }
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Runs the streak-at-risk check for ALL eligible users.
 *
 * Call this from a cron at the desired UTC time (default: 15:30 UTC = 9 PM IST).
 * Can also be called for a single user from the per-minute cron when their
 * custom reminderTime fires — pass `specificUserId` to scope the query.
 *
 * @param {string|null} specificUserId  If provided, only checks that user.
 */
export async function runStreakAtRiskCheck(specificUserId = null) {
  const now      = new Date();
  const todayStr = toUTC(now);  // UTC date "YYYY-MM-DD"

  try {
    // ── 1. Find candidate users ─────────────────────────────────────────────
    // Skip users who:
    //   • have push notifications disabled
    //   • already received the alert today
    const filter = {
      pushNotificationsEnabled: { $ne: false },
      $or: [
        { lastStreakAtRiskAlert: null },
        { lastStreakAtRiskAlert: { $ne: todayStr } },
      ],
    };
    if (specificUserId) {
      filter._id = specificUserId;
    }

    const users = await User.find(filter)
      .select('_id name pushNotificationsEnabled lastStreakAtRiskAlert')
      .lean();

    if (!users.length) return;

    let sent = 0;

    for (const user of users) {
      try {
        // ── 2. Check if user has logged ANY habit today ─────────────────────
        const loggedToday = await HabitLog.countDocuments({
          userId: user._id,
          date:   todayStr,
        });
        if (loggedToday > 0) continue;  // already logged — no alert needed

        // ── 3. Compute max streak across all active habits ──────────────────
        const habits = await Habit.find({ userId: user._id, isActive: true })
          .select('_id')
          .lean();

        if (!habits.length) continue;   // no active habits → nothing to protect

        let maxStreak = 0;

        for (const habit of habits) {
          const logs = await HabitLog.find({ habitId: habit._id })
            .select('date')
            .lean();

          const dateSet = new Set(logs.map(l => l.date));
          const s = streakFromDates(dateSet, todayStr);
          if (s > maxStreak) maxStreak = s;
        }

        // ── 4. Only alert if streak ≥ 3 ────────────────────────────────────
        if (maxStreak < 3) continue;

        // ── 5. Build and send the notification ─────────────────────────────
        const title = 'Your streak is at risk';
        const body  = buildBody(maxStreak);

        await pushToUser(user._id, title, body);

        // ── 6. Mark alert sent for today (prevent duplicates) ───────────────
        await User.findByIdAndUpdate(user._id, {
          lastStreakAtRiskAlert: todayStr,
        });

        sent++;
        console.log(
          `[StreakAtRisk] Sent to user ${user._id} — streak ${maxStreak}d`
        );
      } catch (userErr) {
        console.error(`[StreakAtRisk] Error for user ${user._id}:`, userErr.message);
      }
    }

    console.log(
      `[StreakAtRisk] Done — ${sent} alert(s) sent out of ${users.length} candidate(s)`
    );
  } catch (err) {
    console.error('[StreakAtRisk] Fatal error:', err.message);
  }
}

/**
 * jobs/weeklySummaryJob.js
 *
 * Every Sunday at 15:30 UTC (≈ 9 PM IST), sends each user:
 *   1. A push notification "Your week in review"
 *   2. A branded HTML email (if emailNotificationsEnabled)
 *
 * The frontend fetches the same stats via GET /api/weekly-summary and
 * shows a dismissable in-app card on Sunday / Monday.
 *
 * Does NOT touch: habit logging, streaks, XP system, existing cron jobs.
 */

import webpush          from 'web-push';
import User             from '../models/User.js';
import Habit            from '../models/Habit.js';
import HabitLog         from '../models/HabitLog.js';
import PushSubscription from '../models/PushSubscription.js';
import { sendWeeklySummaryEmail } from '../utils/mailer.js';

// ── Date helpers ──────────────────────────────────────────────────────────────

const pad   = n => String(n).padStart(2, '0');
const toUTC = d => `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}`;

/**
 * Returns the Monday and Sunday (inclusive) of the ISO week that contains
 * the given UTC date.  Sunday → offset 6 back; Mon → offset 0 back.
 */
function getWeekBounds(refDate) {
  // getUTCDay(): 0=Sun, 1=Mon … 6=Sat
  const day = refDate.getUTCDay();
  const daysFromMon = day === 0 ? 6 : day - 1;   // Mon=0 … Sun=6

  const monday = new Date(refDate);
  monday.setUTCDate(refDate.getUTCDate() - daysFromMon);
  monday.setUTCHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  sunday.setUTCHours(23, 59, 59, 999);

  return { monday, sunday };
}

/** "Apr 28 – May 4, 2025" label */
function weekLabel(monday, sunday) {
  const opts = { month: 'short', day: 'numeric', timeZone: 'UTC' };
  const m = monday.toLocaleDateString('en-US', opts);
  const s = sunday.toLocaleDateString('en-US', { ...opts, year: 'numeric' });
  return `${m} – ${s}`;
}

// ── Stats calculation ─────────────────────────────────────────────────────────

/**
 * Calculates weekly stats for one user over a Mon–Sun range.
 * Returns null if the user has no active habits (skip notification).
 */
export async function calcWeeklyStats(userId, monday, sunday) {
  const monStr = toUTC(monday);
  const sunStr = toUTC(sunday);

  // Active habits
  const habits = await Habit.find({ userId, isActive: true }).select('_id').lean();
  if (!habits.length) return null;

  // All logs in the week
  const logs = await HabitLog.find({
    userId,
    date: { $gte: monStr, $lte: sunStr },
  }).select('date status').lean();

  // Days where at least one habit was logged
  const daySet = new Set(logs.map(l => l.date));
  const daysLogged = daySet.size;                  // 0–7

  // Total individual habit log entries
  const totalLogs = logs.length;

  // Best streak: per-habit streak counts for the week window
  let bestStreak = 0;
  for (const h of habits) {
    const hLogs = await HabitLog.find({ habitId: h._id })
      .select('date').lean();
    const dateSet = new Set(hLogs.map(l => l.date));

    // Count consecutive days from sunStr backwards within the week
    let streak = 0;
    const cur  = new Date(sunday);
    while (toUTC(cur) >= monStr) {
      if (dateSet.has(toUTC(cur))) {
        streak++;
        cur.setUTCDate(cur.getUTCDate() - 1);
      } else {
        break;
      }
    }
    if (streak > bestStreak) bestStreak = streak;
  }

  // Previous week bounds (for comparison)
  const prevSunday = new Date(monday);
  prevSunday.setUTCDate(monday.getUTCDate() - 1);
  const { monday: prevMon } = getWeekBounds(prevSunday);
  const prevMonStr = toUTC(prevMon);
  const prevSunStr = toUTC(prevSunday);

  const prevLogs = await HabitLog.find({
    userId,
    date: { $gte: prevMonStr, $lte: prevSunStr },
  }).select('date').lean();
  const prevDaySet  = new Set(prevLogs.map(l => l.date));
  const prevDaysLogged = prevDaySet.size;
  const vsLastWeek  = daysLogged - prevDaysLogged;   // signed integer

  return {
    daysLogged,
    totalLogs,
    bestStreak,
    vsLastWeek,
    weekLabel: weekLabel(monday, sunday),
    monStr,
    sunStr,
  };
}

// ── Notification copy ─────────────────────────────────────────────────────────

function personalizedLine(daysLogged) {
  if (daysLogged === 7) return 'Perfect week.';
  if (daysLogged >= 5) return 'Strong week. Keep the momentum.';
  if (daysLogged >= 3) return 'Halfway there. Next week, push further.';
  if (daysLogged >= 1) return 'A slow week. Start fresh tomorrow.';
  return 'Nothing logged this week. One habit. Tomorrow.';
}

// ── Push helper ───────────────────────────────────────────────────────────────

async function pushToUser(userId, title, body) {
  const subs = await PushSubscription.find({ userId }).lean();
  if (!subs.length) return;

  const payload = JSON.stringify({
    title,
    body,
    icon:  '/icon-192.png',
    badge: '/icon-192.png',
    tag:   'weekly-summary',
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
        await PushSubscription.deleteOne({ _id: sub._id }).catch(() => {});
      }
    }
  }
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Runs the weekly summary for all eligible users.
 * Called by the Sunday cron in reminderJob.js.
 */
export async function runWeeklySummary() {
  const now      = new Date();
  const todayStr = toUTC(now);
  const { monday, sunday } = getWeekBounds(now);

  console.log(`[WeeklySummary] Running for week ${toUTC(monday)} → ${toUTC(sunday)}`);

  try {
    const users = await User.find({
      pushNotificationsEnabled: { $ne: false },
      $or: [
        { lastWeeklySummaryDate: null },
        { lastWeeklySummaryDate: { $ne: todayStr } },
      ],
    }).select('_id name email emailNotificationsEnabled lastWeeklySummaryDate').lean();

    let sent = 0;

    for (const user of users) {
      try {
        const stats = await calcWeeklyStats(user._id, monday, sunday);
        if (!stats) continue;   // no active habits → skip

        // ── Push notification ─────────────────────────────────────────────
        const title = 'Your week in review';
        const body  = [
          `You logged ${stats.daysLogged}/7 days this week.`,
          `Best streak: ${stats.bestStreak} day${stats.bestStreak !== 1 ? 's' : ''}.`,
          personalizedLine(stats.daysLogged),
        ].join(' ');

        await pushToUser(user._id, title, body);

        // ── Email (optional) ──────────────────────────────────────────────
        if (user.emailNotificationsEnabled !== false && user.email) {
          sendWeeklySummaryEmail(user, stats).catch(err =>
            console.error(`[WeeklySummary] Email failed for ${user._id}:`, err.message)
          );
        }

        // ── Mark sent ─────────────────────────────────────────────────────
        await User.findByIdAndUpdate(user._id, { lastWeeklySummaryDate: todayStr });

        sent++;
        console.log(`[WeeklySummary] Sent to ${user._id} (${stats.daysLogged}/7 days)`);
      } catch (userErr) {
        console.error(`[WeeklySummary] Error for user ${user._id}:`, userErr.message);
      }
    }

    console.log(`[WeeklySummary] Done — ${sent}/${users.length} summaries sent`);
  } catch (err) {
    console.error('[WeeklySummary] Fatal:', err.message);
  }
}

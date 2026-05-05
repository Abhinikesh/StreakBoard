import cron from 'node-cron';
import webpush from 'web-push';
import User from '../models/User.js';
import PushSubscription from '../models/PushSubscription.js';
import HabitLog from '../models/HabitLog.js';
import Habit from '../models/Habit.js';
import ShieldEvent from '../models/ShieldEvent.js';
import { sendFriendDigest, sendGlobalReminders, sendDailyGlobalNotification } from '../controllers/notificationController.js';
import { runSeasonReset } from '../lib/seasonUtils.js';
import { runWeeklyReset } from '../lib/weeklyChallenge.js';

// reminderTime is stored in UTC. On the frontend, the user sees their local
// time converted to UTC before saving. See useNotifications hook for conversion.

export function startReminderJob() {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    console.error('[ReminderJob] ⚠️  VAPID keys missing — reminder cron will not send pushes.');
    return;
  }

  // Initialize web-push inside the job so it is always ready
  webpush.setVapidDetails(
    process.env.VAPID_MAILTO || 'mailto:admin@streakboard.app',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );

  // Runs every minute
  cron.schedule('* * * * *', async () => {
    try {
      // Current UTC time as "HH:MM"
      const now  = new Date();
      const utcH = String(now.getUTCHours()).padStart(2, '0');
      const utcM = String(now.getUTCMinutes()).padStart(2, '0');
      const currentTime = `${utcH}:${utcM}`;

      // Find users whose reminder is enabled and matches the current UTC minute
      const users = await User.find({
        reminderEnabled: true,
        reminderTime: currentTime,
      });

      if (users.length > 0) {
        const payload = JSON.stringify({
          title:    'StreakBoard Reminder 🔥',
          body:     'Time to log your habits and protect your streak!',
          icon:     '/icon-192.png',
          badge:    '/icon-192.png',
          tag:      'personal-reminder',
          renotify: true,
          actions: [
            { action: 'mark-all-done', title: '✅ Mark All Done' },
            { action: 'open-app',      title: '📱 Open App'     },
          ],
          data: { url: '/dashboard' },
        });

        for (const user of users) {
          const subscriptions = await PushSubscription.find({ userId: user._id });

          for (const sub of subscriptions) {
            try {
              await webpush.sendNotification(
                { endpoint: sub.endpoint, keys: sub.keys },
                payload
              );
            } catch (pushErr) {
              // 404 / 410 = subscription no longer valid — clean it up silently
              if (pushErr.statusCode === 404 || pushErr.statusCode === 410) {
                await PushSubscription.deleteOne({ _id: sub._id });
              } else {
                console.error('[ReminderJob] Push send error:', pushErr.message);
              }
            }
          }
        }
      }

      // ── Daily friend digest at 20:00 UTC ────────────────────────
      if (currentTime === '20:00') {
        await sendFriendDigest();
      }
    } catch (err) {
      // Never let a single failure crash the scheduler
      console.error('[ReminderJob] Cron error:', err);
    }
  });

  console.log('🔔 Reminder cron job started (runs every minute)');

  // ── 7:00 AM IST (01:30 UTC) — Morning global reminder ──────────────
  cron.schedule('30 1 * * *', () => {
    console.log('🌅 [GlobalReminder] Morning triggered');
    sendGlobalReminders('morning');
  });

  // ── 2:00 PM IST (08:30 UTC) — Afternoon global reminder ────────────
  cron.schedule('30 8 * * *', () => {
    console.log('☀️  [GlobalReminder] Afternoon triggered');
    sendGlobalReminders('afternoon');
  });

  // ── 9:00 PM IST (15:30 UTC) — Night global reminder ────────────────
  cron.schedule('30 15 * * *', () => {
    console.log('🌙 [GlobalReminder] Night triggered');
    sendGlobalReminders('night');
  });

  // ── 7:00 PM UTC — Daily global notification (push + email) ──────────
  // Sends to every user who hasn't logged any habit today.
  // Respects per-user emailNotificationsEnabled / pushNotificationsEnabled flags.
  // Rate-limits email to 1 per user per day via lastGlobalEmailSent.
  cron.schedule('0 19 * * *', () => {
    console.log('📨 [GlobalDaily] 19:00 UTC — running daily global notification job');
    sendDailyGlobalNotification();
  });

  // ── 00:05 UTC every Monday — Weekly challenge reset ───────────────────
  cron.schedule('5 0 * * 1', async () => {
    console.log('🏆 [WeeklyCron] Monday 00:05 UTC — rotating weekly challenge');
    try { await runWeeklyReset(); }
    catch (err) { console.error('[WeeklyCron] fatal:', err.message); }
  });

  // ── 00:05 UTC on 1st of month — Season reset ──────────────────────────
  cron.schedule('5 0 1 * *', async () => {
    console.log('🎫 [SeasonCron] 00:05 UTC on 1st — running season reset');
    try { await runSeasonReset(); }
    catch (err) { console.error('[SeasonCron] fatal:', err.message); }
  });

  // ── 00:05 UTC — Midnight streak shield check ─────────────────────────
  // 5 min after midnight so any last-second logs have been saved.
  cron.schedule('5 0 * * *', async () => {
    console.log('🛡  [ShieldCron] 00:05 UTC — running midnight shield check');
    try { await runMidnightShieldCheck(); }
    catch (err) { console.error('[ShieldCron] fatal:', err.message); }
  });
}

// ── Midnight shield check implementation ─────────────────────────────────────
async function runMidnightShieldCheck() {
  const pad       = n => String(n).padStart(2, '0');
  const toDateStr = d => `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}`;

  const now       = new Date();
  const yesterday = new Date(now); yesterday.setUTCDate(now.getUTCDate() - 1);
  const dayBefore = new Date(now); dayBefore.setUTCDate(now.getUTCDate() - 2);
  const yStr  = toDateStr(yesterday);
  const dbStr = toDateStr(dayBefore);

  // Only check users that actually have shields available
  const users = await User.find({ shieldCount: { $gt: 0 } })
    .select('_id shieldCount name pushNotificationsEnabled')
    .lean();

  let activated = 0;

  for (const user of users) {
    try {
      // 1. Did they log anything yesterday? → no shield needed
      const yLogs = await HabitLog.countDocuments({ userId: user._id, date: yStr });
      if (yLogs > 0) continue;

      // 2. Was yesterday ALREADY shield-protected? (consecutive-day rule)
      const alreadyUsed = await ShieldEvent.findOne({ userId: user._id, eventType: 'used', date: yStr });
      if (alreadyUsed) continue;

      // 3. Did they have logs the day before? → ensures there is a streak to protect
      const dbLogs = await HabitLog.countDocuments({ userId: user._id, date: dbStr });
      if (dbLogs === 0) continue;

      // 4. Create 'missed' logs for all active habits for yesterday (keeps streak alive)
      const habits = await Habit.find({ userId: user._id, isActive: true }).select('_id').lean();
      for (const h of habits) {
        const exists = await HabitLog.findOne({ habitId: h._id, date: yStr });
        if (!exists) {
          await HabitLog.create({ userId: user._id, habitId: h._id, date: yStr, status: 'missed' });
        }
      }

      // 5. Deduct shield
      await User.findByIdAndUpdate(user._id, { $inc: { shieldCount: -1, shieldsUsedTotal: 1 } });

      // 6. Audit record
      await ShieldEvent.create({
        userId: user._id, eventType: 'used',
        reason: `Streak protected for ${yStr}`, date: yStr,
      });

      activated++;

      // 7. Push notification
      if (user.pushNotificationsEnabled === false) continue;
      const remaining = Math.max(0, (user.shieldCount || 1) - 1);
      const subs = await PushSubscription.find({ userId: user._id }).lean();
      const payload = JSON.stringify({
        title: '🛡 Streak Saved!',
        body: `Your streak shield protected your streak for ${yStr}! ${remaining} shield${remaining !== 1 ? 's' : ''} remaining.`,
        icon: '/icon.png',
      });
      for (const sub of subs) {
        webpush.sendNotification(sub.subscription, payload).catch(() => {});
      }
    } catch (err) {
      console.error(`[ShieldCron] user ${user._id}:`, err.message);
    }
  }

  console.log(`🛡  [ShieldCron] activated ${activated} shield(s) across ${users.length} at-risk users`);
}



import cron from 'node-cron';
import webpush from 'web-push';
import User from '../models/User.js';
import PushSubscription from '../models/PushSubscription.js';
import { sendFriendDigest, sendGlobalReminders } from '../controllers/notificationController.js';

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
}

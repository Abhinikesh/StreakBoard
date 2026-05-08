import webpush from 'web-push';
import User from '../models/User.js';
import PushSubscription from '../models/PushSubscription.js';
import Habit from '../models/Habit.js';
import HabitLog from '../models/HabitLog.js';
import NotificationLog from '../models/NotificationLog.js';
import { sendDailyReminderEmail } from '../utils/mailer.js';

// ── Initialize VAPID ──────────────────────────────────────────────────────────
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_MAILTO || 'mailto:admin@streakboard.app',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
} else {
  console.error('[Notifications] ⚠️  VAPID keys missing from .env — push notifications disabled.');
}

// ── GET /api/notifications/vapid-public-key  (public, no auth) ───────────────
export const getVapidPublicKey = (req, res) => {
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY || '' });
};

// ── POST /api/notifications/subscribe  (protected) ───────────────────────────
export const subscribe = async (req, res) => {
  try {
    const { endpoint, keys } = req.body;
    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return res.status(400).json({ message: 'Missing subscription fields' });
    }

    await PushSubscription.findOneAndUpdate(
      { endpoint },
      { userId: req.user.id, endpoint, keys },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    res.status(201).json({ message: 'Subscribed successfully' });
  } catch (err) {
    console.error('subscribe error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── DELETE /api/notifications/unsubscribe  (protected) ───────────────────────
export const unsubscribe = async (req, res) => {
  try {
    const { endpoint } = req.body;
    await PushSubscription.deleteOne({ endpoint, userId: req.user.id });
    res.json({ message: 'Unsubscribed' });
  } catch (err) {
    console.error('unsubscribe error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── GET /api/notifications/settings  (protected) ─────────────────────────────
// Reads the persisted reminderEnabled + reminderTime from DB on page load.
export const getReminderSettings = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('reminderEnabled reminderTime');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({
      reminderEnabled: user.reminderEnabled ?? false,
      reminderTime:    user.reminderTime    ?? '21:00',
    });
  } catch (err) {
    console.error('getReminderSettings error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── PATCH /api/notifications/settings  (protected) ───────────────────────────
export const updateReminderSettings = async (req, res) => {
  try {
    const { reminderEnabled, reminderTime } = req.body;

    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (reminderTime !== undefined && !timeRegex.test(reminderTime)) {
      return res.status(400).json({ message: 'Invalid time format. Use HH:MM (24h)' });
    }

    const update = {};
    if (reminderEnabled !== undefined) update.reminderEnabled = reminderEnabled;
    if (reminderTime   !== undefined) update.reminderTime     = reminderTime;

    const updatedUser = await User.findByIdAndUpdate(
      req.user.id,
      { $set: update },
      { new: true, select: 'reminderEnabled reminderTime' }
    );

    res.json({
      reminderEnabled: updatedUser.reminderEnabled,
      reminderTime:    updatedUser.reminderTime,
    });
  } catch (err) {
    console.error('updateReminderSettings error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── Daily friend digest (called by cron at 20:00 UTC) ────────────────────────
export const sendFriendDigest = async () => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // Only process users who have at least one friend
    const usersWithFriends = await User.find({ 'friends.0': { $exists: true } })
      .select('_id friends');

    for (const user of usersWithFriends) {
      // Count user's active habits
      const habitCount = await Habit.countDocuments({ userId: user._id, isActive: true });
      if (habitCount === 0) continue;

      // Count how many the user completed today
      const userDoneToday = await HabitLog.countDocuments({
        userId: user._id,
        date: today,
        status: 'done',
      });

      // Skip if user already completed all habits
      if (userDoneToday >= habitCount) continue;

      // Count how many friends completed at least one habit today
      const friendsDoneToday = await HabitLog.countDocuments({
        userId: { $in: user.friends },
        date: today,
        status: 'done',
      });

      // Only notify if at least one friend completed something
      if (friendsDoneToday === 0) continue;

      // How many distinct friends completed a habit today
      const activeFriends = await HabitLog.distinct('userId', {
        userId: { $in: user.friends },
        date: today,
        status: 'done',
      });
      const activeFriendCount = activeFriends.length;

      const payload = JSON.stringify({
        title: 'Your friends are crushing it! 💪',
        body: `${activeFriendCount} of your friend${activeFriendCount > 1 ? 's' : ''} completed habits today — don't break your streak!`,
        icon:     '/icon-192.png',
        badge:    '/icon-192.png',
        tag:      'friend-digest',
        renotify: true,
        actions: [
          { action: 'mark-all-done', title: '✅ Mark All Done' },
          { action: 'open-app',      title: '📱 Open App'     },
        ],
        data: { url: '/dashboard' },
      });

      const subscriptions = await PushSubscription.find({ userId: user._id });
      for (const sub of subscriptions) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: sub.keys },
            payload
          );
        } catch (pushErr) {
          if (pushErr.statusCode === 404 || pushErr.statusCode === 410) {
            await PushSubscription.deleteOne({ _id: sub._id });
          } else {
            console.error('[sendFriendDigest] Push send error:', pushErr.message);
          }
        }
      }
    }
  } catch (err) {
    console.error('[sendFriendDigest] Error:', err);
  }
};

// ── Global daily reminders (morning / afternoon / night) ─────────────────────
// Smart: skips users who have already completed all habits today.
// Also skips users with a personal reminder enabled — prevents doubles.
// Subscriptions live in the PushSubscription collection, not on User.
export const sendGlobalReminders = async (type) => {
  try {
    const messages = {
      morning: {
        title: '🌅 Good Morning, Streak Builder!',
        body:  'Start your day strong — mark your habits done! 💪',
      },
      afternoon: {
        title: '☀️ Afternoon Check-in!',
        body:  "How are your habits going? Don't let the day slip by! 🔥",
      },
      night: {
        title: '🌙 Last Chance Today!',
        body:  "Don't break your streak! Mark your habits before midnight 🏃",
      },
    };

    const notification = messages[type];
    if (!notification) return;

    // Today as "YYYY-MM-DD" — same format HabitLog.date uses
    const today = new Date().toISOString().split('T')[0];

    // Users with personal reminders ON get their own timed notification — exclude them
    const excludedUsers = await User.find({ reminderEnabled: true }).select('_id').lean();
    const excludedIds   = excludedUsers.map((u) => u._id);

    // All push subscriptions for non-excluded users
    const allSubs = await PushSubscription.find({ userId: { $nin: excludedIds } }).lean();
    if (allSubs.length === 0) return;

    // Group by userId — one DB completion check per user, not per device
    const subsByUser = new Map();
    for (const sub of allSubs) {
      const uid = sub.userId.toString();
      if (!subsByUser.has(uid)) subsByUser.set(uid, []);
      subsByUser.get(uid).push(sub);
    }

    console.log(`📢 [GlobalReminder] ${type} — checking ${subsByUser.size} users`);

    let sent    = 0;
    let skipped = 0;

    for (const [uid, subs] of subsByUser) {
      // Count active habits — skip users with none
      const habitCount = await Habit.countDocuments({ userId: uid, isActive: true });
      if (habitCount === 0) { skipped++; continue; }

      // Count habits already marked done today (string date, status field)
      const doneCount = await HabitLog.countDocuments({
        userId: uid,
        date:   today,
        status: 'done',
      });

      // All habits done — no point reminding
      if (doneCount >= habitCount) {
        console.log(`⏭  [GlobalReminder] Skipping ${uid} — all ${habitCount} habits done`);
        skipped++;
        continue;
      }

      const pendingCount = habitCount - doneCount;
      const payload = JSON.stringify({
        title:    notification.title,
        body:     `${notification.body} (${pendingCount} habit${pendingCount > 1 ? 's' : ''} remaining)`,
        icon:     '/icon-192.png',
        badge:    '/icon-192.png',
        tag:      `global-${type}`,
        renotify: true,
        actions: [
          { action: 'mark-all-done', title: '✅ Mark All Done' },
          { action: 'open-app',      title: '📱 Open App'     },
        ],
        data: { url: '/dashboard' },
      });

      // Send to every registered device for this user
      for (const sub of subs) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.endpoint, keys: sub.keys },
            payload
          );
          sent++;
        } catch (err) {
          if (err.statusCode === 410 || err.statusCode === 404) {
            await PushSubscription.deleteOne({ _id: sub._id });
            console.log(`🗑  [GlobalReminder] Removed expired subscription ${sub._id}`);
          } else {
            console.error('[GlobalReminder] Push send error:', err.message);
          }
        }
      }
    }
  } catch (err) {
    console.error('[sendGlobalReminders] Error:', err);
  }
};

// ── GET /api/notifications/prefs  (protected) ─────────────────────────────────
// Returns the user's email + push global notification preferences.
export const getNotificationPrefs = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('emailNotificationsEnabled pushNotificationsEnabled');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({
      emailNotificationsEnabled: user.emailNotificationsEnabled ?? true,
      pushNotificationsEnabled:  user.pushNotificationsEnabled  ?? true,
    });
  } catch (err) {
    console.error('getNotificationPrefs error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── PATCH /api/notifications/prefs  (protected) ───────────────────────────────
// Saves the user's email + push global notification opt-in/out to DB.
export const updateNotificationPrefs = async (req, res) => {
  try {
    const { emailNotificationsEnabled, pushNotificationsEnabled } = req.body;
    const update = {};
    if (emailNotificationsEnabled !== undefined) update.emailNotificationsEnabled = !!emailNotificationsEnabled;
    if (pushNotificationsEnabled  !== undefined) update.pushNotificationsEnabled  = !!pushNotificationsEnabled;
    if (!Object.keys(update).length) return res.status(400).json({ message: 'No fields to update' });

    const updated = await User.findByIdAndUpdate(
      req.user.id,
      { $set: update },
      { new: true, select: 'emailNotificationsEnabled pushNotificationsEnabled' }
    );
    res.json({
      emailNotificationsEnabled: updated.emailNotificationsEnabled,
      pushNotificationsEnabled:  updated.pushNotificationsEnabled,
    });
  } catch (err) {
    console.error('updateNotificationPrefs error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── GET /api/notifications/unsubscribe-email  (public, no auth) ───────────────
// One-click unsubscribe from the email footer link.
// Token = base64url-encoded userId. Sets emailNotificationsEnabled=false.
export const handleEmailUnsubscribe = async (req, res) => {
  try {
    const { token } = req.query;
    if (!token) return res.status(400).send('Invalid unsubscribe link.');

    const userId = Buffer.from(token, 'base64url').toString('utf8');
    await User.findByIdAndUpdate(userId, { $set: { emailNotificationsEnabled: false } });

    // Friendly HTML confirmation page
    res.send(`
      <!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"/>
      <title>Unsubscribed — StreakBoard</title>
      <style>body{font-family:sans-serif;background:#0d0d1a;color:#fff;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;}
      .card{background:#13131f;border-radius:16px;padding:40px;max-width:420px;text-align:center;border:1px solid rgba(255,255,255,0.08);}
      h2{color:#7c3aed;}p{color:rgba(255,255,255,0.6);line-height:1.6;}</style></head>
      <body><div class="card"><h2>✅ Unsubscribed</h2>
      <p>You've been removed from StreakBoard daily reminder emails. You can re-enable them anytime in the app's Profile settings.</p>
      </div></body></html>
    `);
  } catch (err) {
    console.error('handleEmailUnsubscribe error:', err);
    res.status(400).send('Invalid or expired unsubscribe link.');
  }
};

// ── sendDailyGlobalNotification  (called by cron at 19:00 UTC) ────────────────
/**
 * Queries all users who have NOT logged any habit today, then:
 *  1. Sends a web-push notification (if pushNotificationsEnabled).
 *  2. Sends a reminder email (if emailNotificationsEnabled + not already sent today).
 *  3. Logs every attempt to NotificationLog for debugging.
 *
 * Skips:
 *  - Users who have already logged at least one habit today.
 *  - Users opted out of push / email.
 *  - Users who already received a global email today (rate-limit).
 */
export const sendDailyGlobalNotification = async () => {
  const today = new Date().toISOString().split('T')[0]; // 'YYYY-MM-DD'

  console.log(`[GlobalDaily] Starting daily global notification run for ${today}`);

  const PUSH_MESSAGES = [
    { title: "Don't break your streak! 🔥", body: "You haven't logged anything today. 30 seconds is all it takes! ✅" },
    { title: "Don't break your streak! 🔥", body: 'Your habits are waiting for you 💪 Log something before midnight!' },
    { title: "Don't break your streak! 🔥", body: "Today's not over yet! Mark your habits and keep that streak alive 🔥" },
    { title: "Don't break your streak! 🔥", body: "Quick check-in time! ⚡ Don't let today slip by without logging." },
  ];

  try {
    // All active users — lean for performance
    const allUsers = await User.find({}).select(
      '_id name email emailNotificationsEnabled pushNotificationsEnabled lastGlobalEmailSent reminderEnabled'
    ).lean();

    let pushSent = 0, pushSkipped = 0, emailSent = 0, emailSkipped = 0;

    for (const user of allUsers) {
      const uid = user._id.toString();

      // ── Check if user has logged ANY habit today ──────────────────────────
      const loggedToday = await HabitLog.exists({ userId: user._id, date: today });
      if (loggedToday) {
        // User is already active today — skip entirely
        await NotificationLog.create({ userId: user._id, type: 'push',  status: 'skipped', reason: 'logged today' });
        await NotificationLog.create({ userId: user._id, type: 'email', status: 'skipped', reason: 'logged today' });
        continue;
      }

      // ── 1. Push notification ──────────────────────────────────────────────
      if (user.pushNotificationsEnabled !== false) {
        const msg  = PUSH_MESSAGES[Math.floor(Math.random() * PUSH_MESSAGES.length)];
        const payload = JSON.stringify({
          title:    msg.title,
          body:     msg.body,
          icon:     '/icon-192.png',
          badge:    '/icon-192.png',
          tag:      'daily-global',
          renotify: true,
          data:     { url: '/dashboard' },
        });

        const subs = await PushSubscription.find({ userId: user._id }).lean();
        if (subs.length === 0) {
          await NotificationLog.create({ userId: user._id, type: 'push', status: 'skipped', reason: 'no subscriptions' });
        } else {
          for (const sub of subs) {
            try {
              await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload);
              pushSent++;
            } catch (pushErr) {
              if (pushErr.statusCode === 404 || pushErr.statusCode === 410) {
                await PushSubscription.deleteOne({ _id: sub._id });
              }
              await NotificationLog.create({ userId: user._id, type: 'push', status: 'failed', reason: pushErr.message });
            }
          }
          await NotificationLog.create({ userId: user._id, type: 'push', status: 'sent' });
        }
      } else {
        pushSkipped++;
        await NotificationLog.create({ userId: user._id, type: 'push', status: 'skipped', reason: 'opted out' });
      }

      // ── 2. Email notification ─────────────────────────────────────────────
      // Rate-limit: max 1 global email per user per day
      if (user.lastGlobalEmailSent === today) {
        emailSkipped++;
        await NotificationLog.create({ userId: user._id, type: 'email', status: 'skipped', reason: 'already sent today' });
        continue;
      }

      if (user.emailNotificationsEnabled === false) {
        emailSkipped++;
        await NotificationLog.create({ userId: user._id, type: 'email', status: 'skipped', reason: 'opted out' });
        continue;
      }

      if (!user.email) {
        await NotificationLog.create({ userId: user._id, type: 'email', status: 'skipped', reason: 'no email address' });
        continue;
      }

      try {
        await sendDailyReminderEmail(user);
        // Record send date for rate-limiting
        await User.updateOne({ _id: user._id }, { $set: { lastGlobalEmailSent: today } });
        await NotificationLog.create({ userId: user._id, type: 'email', status: 'sent' });
        emailSent++;
      } catch (_emailErr) {
        await NotificationLog.create({ userId: user._id, type: 'email', status: 'failed', reason: _emailErr.message });
      }
    }

    console.log(
      `[GlobalDaily] Done — push sent: ${pushSent}, push skipped: ${pushSkipped}, ` +
      `email sent: ${emailSent}, email skipped: ${emailSkipped}`
    );
  } catch (err) {
    console.error('[GlobalDaily] Fatal error:', err);
  }
};

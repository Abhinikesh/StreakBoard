/**
 * utils/mailer.js
 *
 * Shared Nodemailer transporter + helper for sending the daily habit-reminder email.
 * Reuses the same Gmail credentials already used for OTP emails (EMAIL_USER / EMAIL_PASS).
 */

import nodemailer from 'nodemailer';

// ── Transporter (singleton) ───────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // Gmail App Password
  },
});

// ── App constants ─────────────────────────────────────────────────────────────
const APP_NAME    = 'StreakBoard';
const APP_URL     = process.env.CLIENT_URL || 'https://streak-o.vercel.app';
const PRIMARY     = '#7c3aed';   // purple — matches app brand
const BG          = '#0d0d1a';
const CARD_BG     = '#13131f';
const TEXT        = '#ffffff';
const TEXT_MUTED  = 'rgba(255,255,255,0.55)';

/**
 * Rotating reminder messages (body text inside the email).
 */
const MESSAGES = [
  "You haven't logged anything today. 30 seconds is all it takes! ✅",
  "Your habits are waiting for you 💪 Log something before midnight!",
  "Today's not over yet! Mark your habits and keep that streak alive 🔥",
  "Quick check-in time! ⚡ Don't let today slip by without logging.",
];

/**
 * Build the unsubscribe URL — encodes userId as base64 so we don't expose the raw ObjectId.
 * @param {string} userId
 * @returns {string}
 */
function unsubscribeUrl(userId) {
  const token = Buffer.from(userId.toString()).toString('base64url');
  return `${process.env.API_BASE_URL || 'https://streakboard.onrender.com'}/api/notifications/unsubscribe-email?token=${token}`;
}

/**
 * Send the daily habit-reminder email to a single user.
 *
 * @param {{ _id: string, name: string, email: string }} user
 * @returns {Promise<void>}  Resolves even if sending fails (logs error, never throws).
 */
export async function sendDailyReminderEmail(user) {
  const body    = MESSAGES[Math.floor(Math.random() * MESSAGES.length)];
  const unsub   = unsubscribeUrl(user._id);
  const ctaUrl  = `${APP_URL}/dashboard`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Log your habits today</title>
</head>
<body style="margin:0;padding:0;background:${BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="100%" style="max-width:520px;background:${CARD_BG};border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);">

          <!-- Header banner -->
          <tr>
            <td style="background:linear-gradient(135deg,#7c3aed,#4f46e5);padding:32px 32px 24px;text-align:center;">
              <p style="margin:0;font-size:36px;line-height:1;">🔥</p>
              <h1 style="margin:12px 0 0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:-0.3px;">${APP_NAME}</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 8px;color:${TEXT};font-size:18px;font-weight:600;">
                Hey ${user.name || 'there'}! 👋
              </p>
              <p style="margin:0 0 24px;color:${TEXT_MUTED};font-size:15px;line-height:1.6;">
                ${body}
              </p>

              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding:8px 0 32px;">
                    <a href="${ctaUrl}"
                       style="display:inline-block;background:${PRIMARY};color:#ffffff;font-size:15px;font-weight:600;
                              text-decoration:none;padding:14px 36px;border-radius:12px;letter-spacing:0.2px;">
                      Log My Habits Now →
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin:0;color:${TEXT_MUTED};font-size:13px;line-height:1.5;text-align:center;">
                Consistency builds champions. One small check-in today keeps your streak alive.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="border-top:1px solid rgba(255,255,255,0.07);padding:20px 32px;text-align:center;">
              <p style="margin:0;color:${TEXT_MUTED};font-size:12px;line-height:1.6;">
                You're receiving this because you have an active ${APP_NAME} account.<br/>
                <a href="${unsub}" style="color:${PRIMARY};text-decoration:underline;">
                  Unsubscribe from reminder emails
                </a>
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`.trim();

  try {
    await transporter.sendMail({
      from:    `"${APP_NAME}" <${process.env.EMAIL_USER}>`,
      to:      user.email,
      subject: `⏰ You haven't logged today — your streak needs you!`,
      html,
    });
  } catch (err) {
    // Never throw — caller handles logging
    console.error(`[mailer] Failed to send reminder to ${user.email}:`, err.message);
    throw err; // re-throw so caller can record 'failed' status
  }
}

/**
 * Send the weekly summary email to a single user.
 *
 * @param {{ _id: string, name: string, email: string }} user
 * @param {{
 *   daysLogged: number, totalLogs: number, bestStreak: number,
 *   vsLastWeek: number, weekLabel: string
 * }} stats
 */
export async function sendWeeklySummaryEmail(user, stats) {
  const { daysLogged, totalLogs, bestStreak, vsLastWeek, weekLabel } = stats;

  const vsSign   = vsLastWeek > 0 ? `+${vsLastWeek}` : `${vsLastWeek}`;
  const vsColor  = vsLastWeek > 0 ? '#10b981' : vsLastWeek < 0 ? '#ef4444' : TEXT_MUTED;
  const ctaUrl   = `${APP_URL}/dashboard`;

  const perfLine = (() => {
    if (daysLogged === 7) return 'Perfect week. That is rare.';
    if (daysLogged >= 5) return 'Strong week. Keep the momentum going.';
    if (daysLogged >= 3) return 'Halfway there. Next week, push further.';
    if (daysLogged >= 1) return 'A slow week. Start fresh tomorrow.';
    return 'Nothing logged this week. One habit. Tomorrow.';
  })();

  const row = (label, value, color = TEXT) => `
    <tr>
      <td style="padding:10px 0;color:${TEXT_MUTED};font-size:14px;border-bottom:1px solid rgba(255,255,255,0.06);">${label}</td>
      <td style="padding:10px 0;color:${color};font-size:14px;font-weight:600;text-align:right;border-bottom:1px solid rgba(255,255,255,0.06);">${value}</td>
    </tr>`;

  const html = `
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/>
<title>Your StreakBoard week</title></head>
<body style="margin:0;padding:0;background:${BG};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:${BG};padding:40px 16px;">
    <tr><td align="center">
      <table width="100%" style="max-width:520px;background:${CARD_BG};border-radius:16px;overflow:hidden;border:1px solid rgba(255,255,255,0.08);">

        <!-- Header -->
        <tr><td style="background:linear-gradient(135deg,${PRIMARY},#4f46e5);padding:28px 32px 20px;text-align:center;">
          <p style="margin:0;font-size:32px;">📊</p>
          <h1 style="margin:10px 0 4px;color:#fff;font-size:20px;font-weight:700;">${APP_NAME}</h1>
          <p style="margin:0;color:rgba(255,255,255,0.75);font-size:13px;">Week of ${weekLabel}</p>
        </td></tr>

        <!-- Body -->
        <tr><td style="padding:28px 32px;">
          <p style="margin:0 0 6px;color:${TEXT};font-size:18px;font-weight:600;">Hey ${user.name || 'there'} 👋</p>
          <p style="margin:0 0 24px;color:${TEXT_MUTED};font-size:14px;line-height:1.6;">${perfLine}</p>

          <!-- Stats table -->
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
            ${row('Days logged', `${daysLogged} / 7`)}
            ${row('Habits completed', totalLogs)}
            ${row('Best streak', `${bestStreak} day${bestStreak !== 1 ? 's' : ''}`)}
            ${row('vs last week', vsLastWeek === 0 ? 'Same' : `${vsSign} day${Math.abs(vsLastWeek) !== 1 ? 's' : ''}`, vsColor)}
          </table>

          <!-- CTA -->
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td align="center" style="padding:4px 0 28px;">
              <a href="${ctaUrl}"
                 style="display:inline-block;background:${PRIMARY};color:#fff;font-size:14px;font-weight:600;
                        text-decoration:none;padding:13px 32px;border-radius:10px;">
                Start next week strong →
              </a>
            </td></tr>
          </table>
        </td></tr>

        <!-- Footer -->
        <tr><td style="border-top:1px solid rgba(255,255,255,0.07);padding:18px 32px;text-align:center;">
          <p style="margin:0;color:${TEXT_MUTED};font-size:12px;line-height:1.6;">
            You're receiving this because you have an active ${APP_NAME} account.
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`.trim();

  await transporter.sendMail({
    from:    `"${APP_NAME}" <${process.env.EMAIL_USER}>`,
    to:      user.email,
    subject: `Your StreakBoard week — ${weekLabel}`,
    html,
  });
}

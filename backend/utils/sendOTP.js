import nodemailer from "nodemailer";

// ── In-memory OTP store ────────────────────────────────────────
// Structure: Map<email, { otp: string, expiresAt: number }>
// NOTE: This store is cleared on server restart (Render free-tier spins down
// after 15 min of inactivity). If OTPs expire on restart, the user simply
// taps "Resend code" on the login screen to get a fresh one.
const otpStore = new Map();

// ── Nodemailer transporter ─────────────────────────────────────
// IMPORTANT: EMAIL_PASS must be a Gmail App Password, NOT your real Gmail
// password. Gmail has blocked plain-password SMTP since May 2022.
//
// How to get an App Password:
//   1. Go to myaccount.google.com → Security
//   2. Enable 2-Step Verification (required)
//   3. Go to App Passwords → create one for "Mail" / "Other (StreakBoard)"
//   4. Copy the 16-character password (e.g. "abcd efgh ijkl mnop")
//   5. Set EMAIL_PASS=abcdefghijklmnop in your .env / Render env vars
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // ← must be Gmail App Password, not account password
  },
});

transporter.verify((error, success) => {
  if (error) {
    console.error('[EMAIL] SMTP failed:', error.message);
  } else {
    console.log('[EMAIL] SMTP ready to send emails');
  }
});

/**
 * Generates a 6-digit numeric OTP, sends it to the given email address,
 * and only stores it in memory AFTER the email sends successfully.
 *
 * Throws if email send fails — so the caller can return a real 5xx error
 * to the client instead of a false 200 OK.
 *
 * @param {string} email
 */
export const sendOTPEmail = async (email) => {
  const otp = String(Math.floor(100000 + Math.random() * 900000));

  try {
    await transporter.sendMail({
      from: `"StreakBoard" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Your StreakBoard sign-in code',
      html: `
        <div style="font-family: sans-serif; max-width: 400px;">
          <h2 style="color: #7C3AED;">Your sign-in code</h2>
          <p>Use this code to sign in:</p>
          <div style="background: #F3F4F6; padding: 24px; 
                      text-align: center; border-radius: 8px;">
            <span style="font-size: 36px; font-weight: 700; 
                         letter-spacing: 8px; color: #7C3AED;">
              ${otp}
            </span>
          </div>
          <p style="color: #666; font-size: 14px;">
            Expires in 10 minutes. Do not share this code.
          </p>
        </div>
      `,
    });
    console.log('[EMAIL] OTP sent successfully to:', email);
    
    // Only store the OTP *after* the email successfully sends.
    otpStore.set(email, {
      otp,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
    });

    return true;
  } catch (err) {
    console.error('[EMAIL] Failed to send OTP:', err.message);
    throw err;
  }
};

/**
 * Verifies the OTP for the given email.
 * Clears the entry from the store on success.
 * @param {string} email
 * @param {string} otp
 * @returns {boolean}
 */
export const verifyOTP = (email, otp) => {
  const record = otpStore.get(email);

  if (!record) return false;

  const { otp: storedOtp, expiresAt } = record;

  if (Date.now() > expiresAt) {
    otpStore.delete(email);
    return false;
  }

  if (storedOtp !== String(otp)) return false;

  // Clear OTP after successful verification
  otpStore.delete(email);
  return true;
};


import nodemailer from "nodemailer";

// ── In-memory OTP store ────────────────────────────────────────
// Structure: Map<email, { otp: string, expiresAt: number }>
const otpStore = new Map();

// ── Nodemailer transporter ─────────────────────────────────────
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS, // Gmail App Password
  },
});

/**
 * Generates a 6-digit numeric OTP, stores it in memory,
 * and sends it to the given email address.
 * @param {string} email
 */
export const sendOTPEmail = async (email) => {
  // Generate a random 6-digit OTP
  const otp = String(Math.floor(100000 + Math.random() * 900000));
  console.log(`🔑 OTP for ${email}: ${otp}`); // visible in Render logs

  // Store with 10-minute expiry
  otpStore.set(email, {
    otp,
    expiresAt: Date.now() + 10 * 60 * 1000,
  });

  const mailOptions = {
    from: `"StreakBoard" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Your StreakBoard Login OTP",
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;border:1px solid #e5e7eb;border-radius:12px;">
        <h2 style="color:#4f46e5;margin-bottom:8px;">🔐 Your One-Time Password</h2>
        <p style="color:#374151;font-size:15px;">Use the code below to log in to <strong>StreakBoard</strong>. It expires in <strong>10 minutes</strong>.</p>
        <div style="font-size:36px;font-weight:700;letter-spacing:8px;color:#111827;margin:24px 0;text-align:center;">${otp}</div>
        <p style="color:#6b7280;font-size:13px;">If you didn't request this, you can safely ignore this email.</p>
      </div>
    `,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (mailErr) {
    // Log the error but don't throw — OTP is already stored.
    // The user can retrieve it from Render logs until a valid App Password is configured.
    console.error('[sendOTPEmail] Gmail send failed (check EMAIL_PASS is a Gmail App Password):', mailErr.message);
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

import User from "../models/User.js";
import generateToken from "../utils/generateToken.js";
import { sendOTPEmail, verifyOTP } from "../utils/sendOTP.js";

// ── Helper: generate a unique share code ──────────────────────────────────────
function buildShareCode(nameOrEmail) {
  const base = (nameOrEmail || 'user')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 10);
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base}-${suffix}`;
}

// ── POST /api/auth/request-otp ─────────────────────────────────
/**
 * Accepts { email }. If the user doesn't exist, creates a shell document.
 * Sends a 6-digit OTP to the email address.
 */
export const requestOTP = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const normalizedEmail = email.toLowerCase();

    // Find existing user by email — could be a Google OAuth account, that's fine.
    // We do NOT create a user here; creation happens in verifyOTPLogin on success.
    // This prevents a duplicate-key crash when a Google user requests an OTP.
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (!existingUser) {
      // Pre-create a shell so verifyOTP can find them, but only if truly new.
      const name = normalizedEmail.split('@')[0];
      await User.create({
        email: normalizedEmail,
        name,
        isProfilePublic: true,
        shareCode: buildShareCode(name),
      });
    }
    // If user already exists (Google or OTP), skip create — just send the OTP.

    await sendOTPEmail(normalizedEmail);

    return res.status(200).json({ message: "OTP sent" });
  } catch (err) {
    console.error("[requestOTP]", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ── POST /api/auth/verify-otp ──────────────────────────────────
/**
 * Accepts { email, otp }. Validates OTP, then returns a JWT + user object.
 */
export const verifyOTPLogin = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ message: "Email and OTP are required" });
    }

    const normalizedEmail = email.toLowerCase();
    const isValid = verifyOTP(normalizedEmail, String(otp));

    if (!isValid) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    // Always look up by email first — one email = one account, regardless of login method.
    // This handles the case where the user originally signed up with Google OAuth.
    let user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      // Truly new user — create their account now.
      const name = normalizedEmail.split('@')[0];
      user = await User.create({
        email: normalizedEmail,
        name,
        isProfilePublic: true,
        shareCode: buildShareCode(name),
      });
    } else if (!user.shareCode) {
      // Backfill shareCode for legacy users created before this feature.
      user.shareCode = buildShareCode(user.name || user.email);
      await user.save();
    }
    // If user exists with a googleId — that's fine, we just issue them a JWT.
    // No duplicate account is created.

    const token = generateToken({ id: user._id, email: user.email });

    return res.status(200).json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        avatar: user.avatar,
      },
    });
  } catch (err) {
    console.error("[verifyOTPLogin]", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ── GET /api/auth/google/callback ──────────────────────────────
/**
 * Called by Passport after a successful Google OAuth flow.
 * Generates a JWT and redirects the client to CLIENT_URL/auth/callback?token=...
 */
export const googleCallback = async (req, res) => {
  try {
    const { _id, email } = req.user;
    const token = generateToken({ id: _id, email });

    // redirectUrl was encoded in the OAuth state param and decoded by the route
    // before this controller was called. Falls back to web frontend if absent.
    const redirectUrl = req.decodedRedirectUrl || '';
    const fallbackUrl = process.env.CLIENT_URL || 'https://streak-o.vercel.app';

    const finalUrl = redirectUrl && redirectUrl.startsWith('streakboard://')
      ? `${redirectUrl}?token=${token}`
      : `${fallbackUrl}/auth/callback?token=${token}`;

    return res.redirect(finalUrl);
  } catch (err) {
    console.error('[googleCallback]', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// ── GET /api/auth/me ─────────────────────────────────────────
/**
 * Protected route — returns the currently authenticated user's profile.
 * Requires the authMiddleware to set req.user = { id, email }.
 */
export const getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
      id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
    });
  } catch (err) {
    console.error("[getMe]", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ── PUT /api/auth/me ─────────────────────────────────────────
/**
 * Protected route — updates the currently authenticated user's profile.
 */
export const updateMe = async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Name is required" });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { name: name.trim() },
      { new: true }
    ).select("-password -__v");

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.status(200).json({
      id: user._id,
      name: user.name,
      email: user.email,
      avatar: user.avatar,
    });
  } catch (err) {
    console.error("[updateMe]", err);
    return res.status(500).json({ message: "Server error" });
  }
};

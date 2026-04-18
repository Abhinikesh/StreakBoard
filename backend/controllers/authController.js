import User from "../models/User.js";
import generateToken from "../utils/generateToken.js";
import { sendOTPEmail, verifyOTP } from "../utils/sendOTP.js";

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

    // Find or create user (OTP users may not have a name yet)
    let user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      user = await User.create({ email: email.toLowerCase(), name: email.split("@")[0] });
    }

    await sendOTPEmail(email.toLowerCase());

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

    const isValid = verifyOTP(email.toLowerCase(), String(otp));

    if (!isValid) {
      return res.status(400).json({ message: "Invalid or expired OTP" });
    }

    // Fetch or create user
    let user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      user = await User.create({ email: email.toLowerCase(), name: email.split("@")[0] });
    }

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
    // req.user is attached by the Passport GoogleStrategy verify callback
    const { _id, email, name, avatar } = req.user;

    const token = generateToken({ id: _id, email });

    const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
    return res.redirect(`${clientUrl}/auth/callback?token=${token}`);
  } catch (err) {
    console.error("[googleCallback]", err);
    return res.status(500).json({ message: "Server error" });
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

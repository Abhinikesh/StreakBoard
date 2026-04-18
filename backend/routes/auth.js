import express from "express";
import passport from "passport";
import authMiddleware from "../middleware/auth.js";
import {
  requestOTP,
  verifyOTPLogin,
  googleCallback,
  getMe,
  updateMe,
} from "../controllers/authController.js";

const router = express.Router();

// ── OTP Auth ───────────────────────────────────────────────────
// POST /api/auth/request-otp
router.post("/request-otp", requestOTP);

// POST /api/auth/verify-otp
router.post("/verify-otp", verifyOTPLogin);

// ── Google OAuth ───────────────────────────────────────────────
// GET /api/auth/google  → redirects to Google consent screen
router.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

// GET /api/auth/google/callback  → Google redirects back here
router.get(
  "/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: `${process.env.CLIENT_URL || "http://localhost:5173"}/login?error=oauth_failed`,
  }),
  googleCallback
);

// ── Protected ─────────────────────────────────────────────────
// GET /api/auth/me
router.get("/me", authMiddleware, getMe);

// PUT /api/auth/me
router.put("/me", authMiddleware, updateMe);

export default router;

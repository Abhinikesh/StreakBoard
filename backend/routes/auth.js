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
  (req, res, next) => {
    passport.authenticate("google", { session: false }, (err, user, info) => {
      if (err) {
        console.error("[Google OAuth Error]:", err);
        const clientUrl = process.env.CLIENT_URL || "https://streak-o.vercel.app";
        return res.redirect(`${clientUrl}/login?error=oauth_server_error`);
      }
      if (!user) {
        const clientUrl = process.env.CLIENT_URL || "https://streak-o.vercel.app";
        return res.redirect(`${clientUrl}/login?error=oauth_failed`);
      }
      req.user = user;
      next();
    })(req, res, next);
  },
  googleCallback
);

// ── Protected ─────────────────────────────────────────────────
// GET /api/auth/me
router.get("/me", authMiddleware, getMe);

// PUT /api/auth/me
router.put("/me", authMiddleware, updateMe);

export default router;

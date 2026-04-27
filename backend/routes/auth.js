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
router.get("/google", (req, res, next) => {
  const redirectUrl = req.query.redirectUrl || '';
  const state = Buffer.from(JSON.stringify({ redirectUrl })).toString('base64');
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    state,
  })(req, res, next);
});

// GET /api/auth/google/callback  → Google redirects back here
router.get(
  "/google/callback",
  // Step 1: Authenticate with Passport
  (req, res, next) => {
    passport.authenticate('google', { session: false }, (err, user) => {
      if (err) {
        console.error('[Google OAuth Error]:', err);
        const clientUrl = process.env.CLIENT_URL || 'https://streak-o.vercel.app';
        return res.redirect(`${clientUrl}/login?error=oauth_server_error`);
      }
      if (!user) {
        const clientUrl = process.env.CLIENT_URL || 'https://streak-o.vercel.app';
        return res.redirect(`${clientUrl}/login?error=oauth_failed`);
      }
      req.user = user;
      // Step 2: Decode the state param to recover redirectUrl
      try {
        const decoded = JSON.parse(
          Buffer.from(req.query.state || '', 'base64').toString()
        );
        req.decodedRedirectUrl = decoded.redirectUrl || '';
      } catch (_) {
        req.decodedRedirectUrl = '';
      }
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

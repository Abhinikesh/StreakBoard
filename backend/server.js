import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import connectDB from "./config/db.js";
import passport from "./config/passport.js";
import authRoutes from "./routes/auth.js";
import habitRoutes from "./routes/habits.js";
import logRoutes from "./routes/logs.js";
import socialRoutes from "./routes/social.js";
import leaderboardRoutes from "./routes/leaderboard.js";
import notificationRoutes from "./routes/notifications.js";
import userRoutes from "./routes/user.js";
import xpRoutes      from "./routes/xp.js";
import shieldRoutes  from "./routes/shields.js";
import seasonRoutes  from "./routes/seasons.js";
import weeklyRoutes      from "./routes/weeklyChallenges.js";
import fcRoutes          from "./routes/friendChallenges.js";
import msgRoutes         from "./routes/messages.js";
import weeklySummaryRoutes from "./routes/weeklySummary.js";
import { ensureActiveSeason } from "./lib/seasonUtils.js";
import { ensureCurrentChallenge } from "./lib/weeklyChallenge.js";
import { startReminderJob } from "./jobs/reminderJob.js";

// Load environment variables
dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();

// ── Middleware ─────────────────────────────────────────────
app.use(express.json());
app.use(
  cors({
    origin: [
      'https://streak-o.vercel.app',
      'http://localhost:5173',
      process.env.CLIENT_URL,
    ].filter(Boolean),
    credentials: true,
  })
);

// ── Passport (JWT-only, no sessions needed) ────────────────────
app.use(passport.initialize());

// ── Health check ───────────────────────────────────────────
app.get("/", (req, res) => {
  res.status(200).json({ status: "ok", message: "StreakBoard API is running!" });
});

// ── Routes ───────────────────────────────────────────────────
app.use("/api/auth",   authRoutes);
app.use("/api/habits", habitRoutes);
app.use("/api/logs",   logRoutes);
app.use("/api/social", socialRoutes);
app.use("/api/leaderboard",    leaderboardRoutes);
app.use("/api/notifications",  notificationRoutes);
app.use("/api/user",           userRoutes);
app.use("/api/xp",            xpRoutes);
app.use("/api/shields",       shieldRoutes);
app.use("/api/seasons",           seasonRoutes);
app.use("/api/weekly-challenge",  weeklyRoutes);
app.use("/api/friend-challenges", fcRoutes);
app.use("/api/messages",          msgRoutes);
app.use("/api/weekly-summary",    weeklySummaryRoutes);

// ── Startup: ensure active season + weekly challenge ───────────────────────
ensureActiveSeason()
  .then((s) => console.log(`[Season] Active: ${s?.name ?? 'none'}`))
  .catch((err) => console.error('[Season] init failed:', err.message));

ensureCurrentChallenge()
  .then((c) => console.log(`[WeeklyChallenge] Active: ${c?.title ?? 'none'}`))
  .catch((err) => console.error('[WeeklyChallenge] init failed:', err.message));

// ── Health check ───────────────────────────────────────────────
app.get("/api/health", (req, res) => res.json({ status: "ok" }));

// ── Start Server ───────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  startReminderJob();
});

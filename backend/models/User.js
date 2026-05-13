import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      default: null, // optional — OTP users won't have a password
    },
    googleId: {
      type: String,
      default: null, // optional — only set for Google OAuth users
    },
    avatar: {
      type: String,
      default: "",
    },
    shareCode: {
      type: String,
      unique: true,
      sparse: true,
      default: null,
    },
    isProfilePublic: {
      type: Boolean,
      default: true,
    },
    friends: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    reminderEnabled: {
      type: Boolean,
      default: false,
    },
    reminderTime: {
      type: String,
      default: '21:00', // stored in UTC "HH:MM"
    },
    // Global notification preferences (set by user in app settings)
    emailNotificationsEnabled: {
      type: Boolean,
      default: true,   // opted-in by default; user can turn off
    },
    pushNotificationsEnabled: {
      type: Boolean,
      default: true,
    },
    // Rate-limit: track the last date a global email was sent (YYYY-MM-DD UTC)
    lastGlobalEmailSent: {
      type: String,
      default: null,
    },
    // ── XP / Level system ────────────────────────────────────────────────────
    totalXp: {
      type: Number,
      default: 0,
      min: 0,
    },
    currentLevel: {
      type: Number,
      default: 1,
      min: 1,
      max: 10,
    },
    // Stores string keys for one-time XP milestones to prevent double-awarding.
    // Examples: 'first_habit', 'friend_added_{friendId}', 'streak_7_{habitId}_{startDate}'
    // Shield milestone keys also live here: 'shield_streak_7_{habitId}_{startDate}'
    xpMilestonesHit: {
      type: [String],
      default: [],
    },
    // ── Streak Shield system ──────────────────────────────────────────────────
    shieldCount: {
      type: Number,
      default: 0,
      min: 0,
      max: 3,
    },
    shieldsUsedTotal: {
      type: Number,
      default: 0,
      min: 0,
    },
    // ── Season badge gallery (up to 10 most recent) ────────────────────────────────
    seasonBadges: {
      type: [{
        type:      { type: String, enum: ['champion','runner_up','podium','top10','participant'] },
        season:    String,    // "May 2026 Season"
        month:     String,    // "May 2026"
        rank:      Number,
        awardedAt: Date,
      }],
      default: [],
    },

    // ── Streak-at-risk notification dedup ───────────────────────────────────
    // Stores the UTC date (YYYY-MM-DD) when the last streak-at-risk alert was sent.
    // Prevents sending more than one alert per day per user.
    lastStreakAtRiskAlert: {
      type:    String,
      default: null,
    },

    // ── Weekly summary dedup ────────────────────────────────────────────────
    // Stores the Sunday UTC date (YYYY-MM-DD) when the last weekly summary was sent.
    // Prevents duplicate summaries if the cron fires more than once on Sunday.
    lastWeeklySummaryDate: {
      type:    String,
      default: null,
    },
    // ── Public profile customisation ────────────────────────────────────────
    bio: {
      type:      String,
      default:   null,
      maxlength: 120,
    },
    bannerColor: {
      type:    String,
      default: null, // e.g. "#7C3AED"; null → use app default purple
    },
    pinnedBadge: {
      icon:  { type: String, default: null },
      label: { type: String, default: null },
      _id:   false,
    },
    // ── Expo push token (mobile app — for DM push notifications) ─────────────
    expoPushToken: {
      type:    String,
      default: null,
    },

  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

const User = mongoose.model("User", userSchema);

export default User;

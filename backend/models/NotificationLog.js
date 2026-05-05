import mongoose from 'mongoose';

/**
 * Lightweight log of every global notification attempt.
 * One document per user per notification send attempt.
 * Useful for debugging delivery failures and auditing send history.
 */
const notificationLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    // 'push' = web-push / Expo push, 'email' = SMTP email
    type: {
      type: String,
      enum: ['push', 'email'],
      required: true,
    },
    status: {
      type: String,
      enum: ['sent', 'failed', 'skipped'],
      required: true,
    },
    // Human-readable reason for failure or skip (e.g. "opted out", "already sent today")
    reason: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

// Auto-expire logs after 90 days to avoid unbounded collection growth
notificationLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

const NotificationLog = mongoose.model('NotificationLog', notificationLogSchema);
export default NotificationLog;

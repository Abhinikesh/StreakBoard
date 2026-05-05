import mongoose from 'mongoose';

/**
 * ShieldEvent — one record every time a streak shield is earned or consumed.
 * Provides audit trail and "shields used" stats for XpDetailScreen.
 * TTL-indexed after 365 days.
 */
const shieldEventSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    eventType: {
      type: String,
      enum: ['earned', 'used'],
      required: true,
    },
    reason: {
      type: String,
      required: true,
      maxlength: 120,
    },
    // YYYY-MM-DD of the day the shield was USED (only set for eventType: 'used')
    // Used to prevent consecutive-day re-shielding.
    date: {
      type: String,
      default: null,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

shieldEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

export default mongoose.model('ShieldEvent', shieldEventSchema);

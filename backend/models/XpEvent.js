import mongoose from 'mongoose';

/**
 * XpEvent — one record per XP award.
 * Provides the "XP history" feed shown in XpDetailScreen.
 * TTL-indexed after 180 days to keep the collection bounded.
 */
const xpEventSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 1,
    },
    reason: {
      type: String,
      required: true,
      maxlength: 120,
    },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

xpEventSchema.index({ createdAt: 1 }, { expireAfterSeconds: 180 * 24 * 60 * 60 });

export default mongoose.model('XpEvent', xpEventSchema);

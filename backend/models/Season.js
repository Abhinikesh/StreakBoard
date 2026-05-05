import mongoose from 'mongoose';

/**
 * Season — one record per calendar month.
 */
const seasonSchema = new mongoose.Schema(
  {
    seasonNumber: { type: Number, required: true, unique: true },
    name:         { type: String, required: true },   // "May 2026 Season"
    startDate:    { type: Date,   required: true },   // UTC midnight 1st of month
    endDate:      { type: Date,   required: true },   // UTC midnight 1st of NEXT month
    status:       { type: String, enum: ['active', 'ended'], default: 'active', index: true },
  },
  { timestamps: false }
);

export default mongoose.model('Season', seasonSchema);

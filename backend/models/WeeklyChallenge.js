import mongoose from 'mongoose';

const weeklyChallengSchema = new mongoose.Schema({
  title:          { type: String, required: true },
  description:    { type: String, required: true },
  type: {
    type: String,
    enum: ['daily_log', 'full_day', 'streak', 'early_bird', 'perfect_day'],
    required: true,
  },
  targetValue:    { type: Number, required: true },
  startDate:      { type: Date, required: true },
  endDate:        { type: Date, required: true },
  status:         { type: String, enum: ['active', 'ended'], default: 'active', index: true },
  templateIndex:  { type: Number, default: 0 },
}, { timestamps: false });

export default mongoose.model('WeeklyChallenge', weeklyChallengSchema);

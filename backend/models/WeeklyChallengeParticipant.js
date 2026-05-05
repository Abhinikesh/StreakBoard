import mongoose from 'mongoose';

const participantSchema = new mongoose.Schema({
  challengeId:        { type: mongoose.Schema.Types.ObjectId, ref: 'WeeklyChallenge', required: true, index: true },
  userId:             { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  currentProgress:    { type: Number, default: 0, min: 0 },
  completed:          { type: Boolean, default: false },
  completedAt:        { type: Date, default: null },
  rewardDistributed:  { type: Boolean, default: false },
  badgeType:          { type: String, enum: ['winner', 'participant', null], default: null },
}, { timestamps: true });

participantSchema.index({ challengeId: 1, userId: 1 }, { unique: true });
participantSchema.index({ challengeId: 1, currentProgress: -1, completedAt: 1 });

export default mongoose.model('WeeklyChallengeParticipant', participantSchema);

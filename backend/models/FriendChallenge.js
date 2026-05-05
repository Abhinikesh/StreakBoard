import mongoose from 'mongoose';

const { Schema } = mongoose;

const friendChallengeSchema = new Schema({
  challengerId:         { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  challengedId:         { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  habitName:            { type: String, required: true, trim: true, maxlength: 80 },
  startDate:            { type: String, default: null }, // 'YYYY-MM-DD' — set on acceptance
  endDate:              { type: String, default: null }, // 7 days inclusive from startDate
  status:               {
    type: String,
    enum: ['pending', 'active', 'complete', 'declined', 'expired'],
    default: 'pending',
    index: true,
  },
  challengerDaysLogged: [{ type: String }], // date strings 'YYYY-MM-DD'
  challengedDaysLogged: [{ type: String }],
  rewardDistributed:    { type: Boolean, default: false },
  expiresAt:            { type: Date, required: true }, // 48 h from creation
}, { timestamps: true });

friendChallengeSchema.index({ challengerId: 1, status: 1 });
friendChallengeSchema.index({ challengedId: 1, status: 1 });

export default mongoose.model('FriendChallenge', friendChallengeSchema);

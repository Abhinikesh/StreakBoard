import mongoose from 'mongoose';

/**
 * SeasonRanking — one record per (season, user) pair.
 * bestStreak is updated live whenever the user earns a longer streak.
 * rank and rewardsDistributed are populated at season end.
 */
const seasonRankingSchema = new mongoose.Schema(
  {
    seasonId:           { type: mongoose.Schema.Types.ObjectId, ref: 'Season',  required: true, index: true },
    userId:             { type: mongoose.Schema.Types.ObjectId, ref: 'User',    required: true, index: true },
    bestStreak:         { type: Number, default: 0, min: 0 },
    rank:               { type: Number, default: null },           // set at season end
    rewardsDistributed: { type: Boolean, default: false },
  },
  { timestamps: true }
);

seasonRankingSchema.index({ seasonId: 1, userId: 1 }, { unique: true });
seasonRankingSchema.index({ seasonId: 1, bestStreak: -1 }); // fast leaderboard queries

export default mongoose.model('SeasonRanking', seasonRankingSchema);

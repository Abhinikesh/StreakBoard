/**
 * controllers/weeklyChallengeController.js
 *
 * GET /api/weekly-challenge/current    — current challenge + participant count + days remaining
 * GET /api/weekly-challenge/my-progress — auth user's progress + rank
 * GET /api/weekly-challenge/leaderboard — top 10 by progress this week
 */
import WeeklyChallenge            from '../models/WeeklyChallenge.js';
import WeeklyChallengeParticipant from '../models/WeeklyChallengeParticipant.js';

// ── GET /api/weekly-challenge/current ────────────────────────────────────────
export const getCurrent = async (req, res) => {
  try {
    const challenge = await WeeklyChallenge.findOne({ status: 'active' }).lean();
    if (!challenge) return res.json(null);

    const now = new Date();
    const daysRemaining    = Math.max(0, Math.ceil((new Date(challenge.endDate) - now) / 86400000));
    const participantCount = await WeeklyChallengeParticipant.countDocuments({ challengeId: challenge._id });

    res.json({ ...challenge, daysRemaining, participantCount });
  } catch (err) {
    console.error('[getCurrent]', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── GET /api/weekly-challenge/my-progress ────────────────────────────────────
export const getMyProgress = async (req, res) => {
  try {
    const challenge = await WeeklyChallenge.findOne({ status: 'active' }).lean();
    if (!challenge) return res.json(null);

    const now = new Date();
    const daysRemaining    = Math.max(0, Math.ceil((new Date(challenge.endDate) - now) / 86400000));
    const participantCount = await WeeklyChallengeParticipant.countDocuments({ challengeId: challenge._id });

    const participant = await WeeklyChallengeParticipant.findOne({
      challengeId: challenge._id, userId: req.user.id,
    }).lean();

    const progress = participant?.currentProgress ?? 0;

    // My rank among participants
    const rank = participant
      ? await WeeklyChallengeParticipant.countDocuments({
          challengeId: challenge._id,
          currentProgress: { $gt: progress },
        }) + 1
      : null;

    res.json({
      challenge: { ...challenge, daysRemaining, participantCount },
      progress,
      completed:  participant?.completed  ?? false,
      badgeType:  participant?.badgeType  ?? null,
      rank,
    });
  } catch (err) {
    console.error('[getMyProgress]', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── GET /api/weekly-challenge/leaderboard ────────────────────────────────────
export const getLeaderboard = async (req, res) => {
  try {
    const challenge = await WeeklyChallenge.findOne({ status: 'active' })
      .select('_id targetValue').lean();
    if (!challenge) return res.json([]);

    const top = await WeeklyChallengeParticipant.find({
      challengeId: challenge._id,
      currentProgress: { $gt: 0 },
    })
      .sort({ currentProgress: -1, completedAt: 1 })
      .limit(10)
      .populate('userId', 'name avatar currentLevel')
      .lean();

    res.json(
      top.filter(p => p.userId).map((p, i) => ({
        rank:         i + 1,
        name:         p.userId.name,
        avatar:       p.userId.avatar || null,
        currentLevel: p.userId.currentLevel || 1,
        progress:     p.currentProgress,
        completed:    p.completed,
        targetValue:  challenge.targetValue,
      }))
    );
  } catch (err) {
    console.error('[getLeaderboard]', err);
    res.status(500).json({ message: 'Server error' });
  }
};

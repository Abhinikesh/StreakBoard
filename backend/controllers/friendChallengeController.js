/**
 * controllers/friendChallengeController.js
 *
 * POST   /api/friend-challenges              — create
 * GET    /api/friend-challenges              — my challenges
 * PATCH  /api/friend-challenges/:id/accept  — accept pending
 * PATCH  /api/friend-challenges/:id/decline — decline pending
 */
import FriendChallenge from '../models/FriendChallenge.js';
import User            from '../models/User.js';
import PushSubscription from '../models/PushSubscription.js';
import webpush          from 'web-push';
import { grantXp }      from '../lib/xp.js';

// ── Helpers ──────────────────────────────────────────────────────────────────
async function pushTo(userId, title, body) {
  try {
    const subs = await PushSubscription.find({ userId }).lean();
    const payload = JSON.stringify({ title, body, icon: '/icon.png' });
    for (const s of subs) webpush.sendNotification(s.subscription, payload).catch(() => {});
  } catch (_) {}
}

async function distributeRewards(challenge) {
  try {
    const cDays = challenge.challengerDaysLogged?.length ?? 0;
    const eDays = challenge.challengedDaysLogged?.length ?? 0;

    // Winner bonus
    let winnerId = null;
    if (cDays > eDays) winnerId = challenge.challengerId;
    else if (eDays > cDays) winnerId = challenge.challengedId;

    if (winnerId) {
      const key = `fc_win_${challenge._id}`;
      await grantXp(winnerId, 50, `Won friend challenge: ${challenge.habitName}`, key);
    }

    // Challenger badge (5+ / 7 days)
    for (const [uid, days] of [[challenge.challengerId, cDays], [challenge.challengedId, eDays]]) {
      if (days >= 5) {
        await User.findByIdAndUpdate(uid, {
          $push: {
            seasonBadges: {
              $each: [{ type: 'challenger', season: `Challenge: ${challenge.habitName}`, awardedAt: new Date(), rank: 0 }],
              $slice: -10,
            },
          },
        });
      }
    }

    await FriendChallenge.findByIdAndUpdate(challenge._id, { rewardDistributed: true });
  } catch (err) {
    console.error('[FC distributeRewards]', err.message);
  }
}

// ── Auto-housekeeping ─────────────────────────────────────────────────────────
async function housekeep() {
  const now   = new Date();
  const today = now.toISOString().split('T')[0];
  await FriendChallenge.updateMany(
    { status: 'pending', expiresAt: { $lte: now } },
    { $set: { status: 'expired' } }
  );
  await FriendChallenge.updateMany(
    { status: 'active', endDate: { $lt: today } },
    { $set: { status: 'complete' } }
  );
}

// ── POST /api/friend-challenges ──────────────────────────────────────────────
export const createChallenge = async (req, res) => {
  try {
    const { friendId, habitName } = req.body;
    const userId = req.user.id;

    if (!friendId || !habitName?.trim())
      return res.status(400).json({ message: 'friendId and habitName are required.' });

    // Max 3 active per user
    const activeCount = await FriendChallenge.countDocuments({
      $or: [{ challengerId: userId }, { challengedId: userId }],
      status: 'active',
    });
    if (activeCount >= 3)
      return res.status(400).json({ message: 'You already have 3 active challenges. Complete one before creating another.' });

    // 1 challenge per friend pair
    const dupe = await FriendChallenge.findOne({
      $or: [
        { challengerId: userId, challengedId: friendId },
        { challengerId: friendId, challengedId: userId },
      ],
      status: { $in: ['pending', 'active'] },
    });
    if (dupe)
      return res.status(400).json({ message: 'You already have an active challenge with this friend.' });

    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const challenge = await FriendChallenge.create({
      challengerId: userId,
      challengedId: friendId,
      habitName: habitName.trim(),
      expiresAt,
    });

    const challenger = await User.findById(userId).select('name').lean();
    await pushTo(friendId, '🤜 New Challenge!',
      `${challenger.name} challenged you to "${habitName.trim()}" for 7 days! Open the app to respond.`);

    res.status(201).json(challenge);
  } catch (err) {
    console.error('[createChallenge]', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── GET /api/friend-challenges ───────────────────────────────────────────────
export const getMyChallenges = async (req, res) => {
  try {
    await housekeep();
    const userId = req.user.id;

    const challenges = await FriendChallenge.find({
      $or: [{ challengerId: userId }, { challengedId: userId }],
      status: { $in: ['pending', 'active', 'complete', 'declined'] },
    })
      .sort({ createdAt: -1 })
      .limit(30)
      .populate('challengerId', 'name avatar')
      .populate('challengedId', 'name avatar')
      .lean();

    // Distribute rewards for newly completed challenges
    for (const c of challenges) {
      if (c.status === 'complete' && !c.rewardDistributed) {
        distributeRewards(c).catch(() => {});
      }
    }

    res.json(challenges);
  } catch (err) {
    console.error('[getMyChallenges]', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── PATCH /api/friend-challenges/:id/accept ──────────────────────────────────
export const acceptChallenge = async (req, res) => {
  try {
    const userId = req.user.id;
    const challenge = await FriendChallenge.findOne({
      _id: req.params.id, challengedId: userId, status: 'pending',
    });
    if (!challenge) return res.status(404).json({ message: 'Challenge not found.' });

    // Check active limit for accepting user too
    const activeCount = await FriendChallenge.countDocuments({
      $or: [{ challengerId: userId }, { challengedId: userId }],
      status: 'active',
    });
    if (activeCount >= 3)
      return res.status(400).json({ message: 'You already have 3 active challenges.' });

    // Start tomorrow 00:00 UTC
    const tmr = new Date();
    tmr.setUTCDate(tmr.getUTCDate() + 1);
    const startDate = tmr.toISOString().split('T')[0];
    const endD = new Date(tmr.getTime() + 6 * 24 * 60 * 60 * 1000);
    const endDate = endD.toISOString().split('T')[0];

    challenge.status    = 'active';
    challenge.startDate = startDate;
    challenge.endDate   = endDate;
    await challenge.save();

    const accepted = await User.findById(userId).select('name').lean();
    await pushTo(challenge.challengerId, '✅ Challenge Accepted!',
      `${accepted.name} accepted your "${challenge.habitName}" challenge. Starts tomorrow!`);

    res.json(challenge);
  } catch (err) {
    console.error('[acceptChallenge]', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── PATCH /api/friend-challenges/:id/decline ─────────────────────────────────
export const declineChallenge = async (req, res) => {
  try {
    const userId = req.user.id;
    const challenge = await FriendChallenge.findOne({
      _id: req.params.id, challengedId: userId, status: 'pending',
    });
    if (!challenge) return res.status(404).json({ message: 'Challenge not found.' });

    challenge.status = 'declined';
    await challenge.save();

    const declined = await User.findById(userId).select('name').lean();
    await pushTo(challenge.challengerId, 'Challenge Declined',
      `${declined.name} declined your "${challenge.habitName}" challenge.`);

    res.json({ message: 'Challenge declined.' });
  } catch (err) {
    console.error('[declineChallenge]', err);
    res.status(500).json({ message: 'Server error' });
  }
};

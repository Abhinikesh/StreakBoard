import User from '../models/User.js';
import Habit from '../models/Habit.js';
import HabitLog from '../models/HabitLog.js';
import FriendRequest from '../models/FriendRequest.js';
import { grantXp, getLevelInfo } from '../lib/xp.js';

// ── POST /api/social/enable ────────────────────────────────────
export const enableSharing = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (!user.shareCode) {
      const base = (user.name || user.email || 'user')
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '')
        .slice(0, 10);
      const suffix = Math.random().toString(36).slice(2, 6);
      user.shareCode = `${base}-${suffix}`;
    }

    user.isProfilePublic = true;

    await user.save();

    const shareUrl = `${process.env.CLIENT_URL}/u/${user.shareCode}`;
    res.json({ shareCode: user.shareCode, shareUrl, isProfilePublic: true });
  } catch (err) {
    console.error('enableSharing error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── POST /api/social/disable ───────────────────────────────────
export const disableSharing = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.user.id, { isProfilePublic: false });
    res.json({ message: 'Profile hidden', isProfilePublic: false });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ── GET /api/social/my-share ───────────────────────────────────
export const getMyShareInfo = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('shareCode isProfilePublic name');
    if (!user) return res.status(404).json({ message: 'User not found' });

    const shareUrl = user.shareCode
      ? `${process.env.CLIENT_URL}/u/${user.shareCode}`
      : null;

    res.json({
      shareCode: user.shareCode || null,
      isProfilePublic: user.isProfilePublic || false,
      shareUrl,
    });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

// ── GET /api/social/u/:shareCode (PUBLIC) ─────────────────────
export const getPublicProfile = async (req, res) => {
  try {
    const { shareCode } = req.params;

    // Find user by shareCode only — do NOT filter by isProfilePublic here yet
    const user = await User.findOne({ shareCode });

    if (!user) {
      return res.status(404).json({ message: 'Profile not found or private' });
    }

    if (!user.isProfilePublic) {
      return res.status(404).json({ message: 'Profile not found or private' });
    }

    // Query habits and logs INTERNALLY for stats only — never sent in response
    const habits = await Habit.find({ userId: user._id, isActive: true })
      .select('_id')
      .lean();

    const habitIds = habits.map(h => h._id);

    const logs = await HabitLog.find({
      userId: user._id,
      habitId: { $in: habitIds },
    })
      .select('habitId date status')
      .lean();

    // Calculate stats server-side
    const doneLogs = logs.filter(l => l.status === 'done');
    const missedLogs = logs.filter(l => l.status === 'missed');
    const totalDone = doneLogs.length;
    const totalMissed = missedLogs.length;
    const overallRate = (totalDone + totalMissed) > 0
      ? Math.round((totalDone / (totalDone + totalMissed)) * 100)
      : 0;

    // Calculate best streak across all habits, take max
    let longestStreak = 0;

    habitIds.forEach(habitId => {
      const habitDoneDates = logs
        .filter(l => l.habitId.toString() === habitId.toString() && l.status === 'done')
        .map(l => l.date)
        .sort();

      let best = 0, run = 0;
      for (let i = 0; i < habitDoneDates.length; i++) {
        if (i === 0) { run = 1; continue; }
        const prev = new Date(habitDoneDates[i - 1] + 'T00:00:00');
        const curr = new Date(habitDoneDates[i] + 'T00:00:00');
        const diff = (curr - prev) / (1000 * 60 * 60 * 24);
        run = diff === 1 ? run + 1 : 1;
        if (run > best) best = run;
      }
      if (run > best) best = run;
      if (best > longestStreak) longestStreak = best;
    });

    const uniqueActiveDays = [...new Set(doneLogs.map(l => l.date))].length;

    // Calculate level info from user's XP
    const { current: levelData } = getLevelInfo(user.totalXp || 0);

    // Return ONLY aggregate stats — no habit names, icons, logs, email, or friends
    res.json({
      userId:      user._id,           // needed by mobile to send friend requests
      name:        user.name || 'StreakBoard User',
      avatar:      user.avatar || null,
      memberSince: user.createdAt,
      bio:         user.bio         || null,
      bannerColor: user.bannerColor || null,
      pinnedBadge: user.pinnedBadge?.icon ? user.pinnedBadge : null,
      currentLevel:  levelData.level,
      levelName:     levelData.name,
      stats: {
        totalHabits: habits.length,
        totalDone,
        longestStreak,
        overallRate,
        activeDays: uniqueActiveDays,
      },
    });
  } catch (err) {
    console.error('getPublicProfile error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── POST /api/social/friends/add ──────────────────────────────
export const addFriend = async (req, res) => {
  try {
    const { shareCode } = req.body;
    if (!shareCode) return res.status(400).json({ message: 'shareCode is required' });

    const friend = await User.findOne({ shareCode, isProfilePublic: true })
      .select('_id name shareCode');
    if (!friend) return res.status(404).json({ message: 'User not found or profile is private' });
    if (friend._id.toString() === req.user.id) {
      return res.status(400).json({ message: 'Cannot add yourself' });
    }

    // Bidirectional: both users get each other in their friends list so either
    // side can initiate messages (the message-send friends-only check requires
    // the SENDER to have the receiver in their own friends list).
    await Promise.all([
      User.findByIdAndUpdate(req.user.id,  { $addToSet: { friends: friend._id } }),
      User.findByIdAndUpdate(friend._id,   { $addToSet: { friends: req.user.id } }),
    ]);

    // XP: +10 for adding a new friend (one-time per friendship)
    await grantXp(req.user.id, 10, `Added friend ${friend.name}`, `friend_added_${friend._id}`);

    return res.status(200).json({ message: 'Friend added', friend: { name: friend.name, shareCode: friend.shareCode } });
  } catch (err) {
    console.error('[addFriend]', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// ── GET /api/social/friends ────────────────────────────────────
export const getFriends = async (req, res) => {
  try {
    const me = await User.findById(req.user.id).select('friends');
    if (!me) return res.status(404).json({ message: 'User not found' });

    const friends = await User.find({ _id: { $in: me.friends } })
      .select('name avatar shareCode isProfilePublic');

    const today = new Date().toISOString().split('T')[0];
    const friendsWithData = await Promise.all(friends.map(async (f) => {
      const habitCount = await Habit.countDocuments({ userId: f._id });
      const todayDone = await HabitLog.countDocuments({ userId: f._id, date: today, status: 'done' });
      const weekStart = (() => {
        const d = new Date(); d.setHours(0,0,0,0);
        const dow = d.getDay();
        d.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
        return d.toISOString().split('T')[0];
      })();
      const weekDone = await HabitLog.countDocuments({ userId: f._id, date: { $gte: weekStart }, status: 'done' });
      return { _id: f._id, name: f.name, avatar: f.avatar, shareCode: f.shareCode, isPublic: f.isProfilePublic, habitCount, todayDone, weekDone };
    }));

    return res.status(200).json(friendsWithData);
  } catch (err) {
    console.error('[getFriends]', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// ── DELETE /api/social/friends/:shareCode ─────────────────────
export const removeFriend = async (req, res) => {
  try {
    const friend = await User.findOne({ shareCode: req.params.shareCode }).select('_id');
    if (!friend) return res.status(404).json({ message: 'User not found' });
    await User.findByIdAndUpdate(req.user.id, { $pull: { friends: friend._id } });
    return res.status(200).json({ message: 'Friend removed' });
  } catch (err) {
    console.error('[removeFriend]', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// ── GET /api/social/leaderboard ────────────────────────────────
export const getLeaderboard = async (req, res) => {
  try {
    const users = await User.find({
      isProfilePublic: true,
      shareCode: { $exists: true, $ne: null, $nin: ['', null] },
    }).select('name avatar shareCode createdAt totalXp currentLevel');

    const leaderboardData = await Promise.all(
      users.map(async (user) => {
        const habits = await Habit.find({
          userId: user._id,
          isActive: true,
        });

        const habitIds = habits.map((h) => h._id);

        const logs = await HabitLog.find({
          userId: user._id,
          habitId: { $in: habitIds },
        });

        const doneLogs = logs.filter((l) => l.status === 'done');
        const missedLogs = logs.filter((l) => l.status === 'missed');
        const totalDone = doneLogs.length;
        const totalMissed = missedLogs.length;
        const overallRate =
          totalDone + totalMissed > 0
            ? Math.round((totalDone / (totalDone + totalMissed)) * 100)
            : 0;

        // ── Current streak calculation ─────────────────────────
        // Rules:
        //   - Both 'done' and 'missed' keep the streak alive
        //   - Only a day with NO log at all breaks it
        //   - Streak is 0 if neither today nor yesterday has any log
        const pad = n => String(n).padStart(2, '0');
        const toStr = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

        const now = new Date();
        const todayStr = toStr(now);
        const yest = new Date(now); yest.setDate(yest.getDate() - 1);
        const yesterdayStr = toStr(yest);

        let longestStreak = 0;
        habits.forEach((habit) => {
          // All logged dates for this habit — both done and missed count
          const habitLoggedDates = new Set(
            logs
              .filter(l => l.habitId.toString() === habit._id.toString())
              .map(l => l.date)
          );

          // Streak is dead if neither today nor yesterday has any log
          if (!habitLoggedDates.has(todayStr) && !habitLoggedDates.has(yesterdayStr)) return;

          // Start from today if logged, otherwise from yesterday
          const startDate = habitLoggedDates.has(todayStr) ? new Date(now) : new Date(yest);

          let run = 0;
          const cur = new Date(startDate);
          while (true) {
            const ds = toStr(cur);
            if (habitLoggedDates.has(ds)) {
              run++;
              cur.setDate(cur.getDate() - 1);
            } else {
              break;
            }
          }
          if (run > longestStreak) longestStreak = run;
        });

        return {
          _id:           user._id,
          name:          user.name || 'StreakBoard User',
          avatar:        user.avatar || null,
          shareCode:     user.shareCode,
          totalHabits:   habits.length,
          totalDone,
          currentStreak: longestStreak,
          streak:        longestStreak,
          completionRate: overallRate,
          overallRate,
          memberSince:   user.createdAt,
          currentLevel:  user.currentLevel || 1,
          totalXp:       user.totalXp || 0,
        };
      })
    );

    // Sort by currentStreak descending
    leaderboardData.sort((a, b) => b.currentStreak - a.currentStreak);

    res.json(leaderboardData);
  } catch (err) {
    console.error('getLeaderboard error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── GET /api/social/profile/:userId (AUTHENTICATED) ───────────
// Lets any logged-in user view a leaderboard member's public stats
// by their MongoDB _id — no shareCode required.
// NOTE: We intentionally do NOT gate on isProfilePublic here.
// The leaderboard already filters to public users. Season leaderboard
// entries may include users who appear without isProfilePublic, so
// blocking on that flag causes false 404s.
export const getProfileById = async (req, res) => {
  try {
    const { userId } = req.params;
    console.log('[PublicProfile] Fetching userId:', req.params.userId);

    // Basic ObjectId sanity check
    if (!userId || !/^[a-f\d]{24}$/i.test(userId)) {
      return res.status(400).json({ message: 'Invalid user ID' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Query habits and logs for stats
    const habits = await Habit.find({ userId: user._id, isActive: true })
      .select('_id name icon trackingPeriod')
      .lean();

    const habitIds = habits.map(h => h._id);

    const logs = await HabitLog.find({
      userId: user._id,
      habitId: { $in: habitIds },
    })
      .select('habitId date status')
      .lean();

    // Aggregate stats
    const doneLogs   = logs.filter(l => l.status === 'done');
    const missedLogs = logs.filter(l => l.status === 'missed');
    const totalDone  = doneLogs.length;
    const totalMissed = missedLogs.length;
    const overallRate = (totalDone + totalMissed) > 0
      ? Math.round((totalDone / (totalDone + totalMissed)) * 100)
      : 0;

    const pad    = n => String(n).padStart(2, '0');
    const toStr  = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const now    = new Date();
    const todayStr = toStr(now);
    const yest = new Date(now); yest.setDate(yest.getDate() - 1);
    const yesterdayStr = toStr(yest);

    let longestStreak = 0;
    habitIds.forEach(habitId => {
      const habitLoggedDates = new Set(
        logs
          .filter(l => l.habitId.toString() === habitId.toString())
          .map(l => l.date)
      );
      if (!habitLoggedDates.has(todayStr) && !habitLoggedDates.has(yesterdayStr)) return;
      const startDate = habitLoggedDates.has(todayStr) ? new Date(now) : new Date(yest);
      let run = 0;
      const cur = new Date(startDate);
      while (true) {
        const ds = toStr(cur);
        if (habitLoggedDates.has(ds)) { run++; cur.setDate(cur.getDate() - 1); }
        else break;
      }
      if (run > longestStreak) longestStreak = run;
    });

    const uniqueActiveDays = [...new Set(doneLogs.map(l => l.date))].length;

    // Level info (getLevelInfo is already imported at the top of this file)
    const { current: levelData } = getLevelInfo(user.totalXp || 0);

    const publicHabits = habits;

    res.json({
      // Required fields from STEP 3
      username:       user.name || 'StreakBoard User',
      currentStreak:  longestStreak || user.currentStreak || 0,
      bestStreak:     user.bestStreak || longestStreak || 0,
      totalDone:      totalDone || user.totalDone || 0,
      completionRate: overallRate || user.completionRate || 0,
      habits:         publicHabits || [],
      level:          levelData.level,
      levelName:      levelData.name,

      // Preserve existing fields for backward compatibility
      name:         user.name || 'StreakBoard User',
      avatar:       user.avatar || null,
      shareCode:    user.shareCode || null,
      createdAt:    user.createdAt,
      bio:          user.bio         || null,
      bannerColor:  user.bannerColor || null,
      pinnedBadge:  user.pinnedBadge?.icon ? user.pinnedBadge : null,
      currentLevel: levelData.level,
      currentStreakOriginal: longestStreak, // original name
      stats: {
        totalHabits:   habits.length,
        totalDone,
        longestStreak,
        overallRate,
        activeDays:    uniqueActiveDays,
      },
    });
  } catch (err) {
    console.error('getProfileById error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── POST /api/social/friend-requests ─────────────────────────────────────────
export const sendFriendRequest = async (req, res) => {
  try {
    const fromId = req.user.id;
    const { targetUserId } = req.body;
    if (!targetUserId) return res.status(400).json({ message: 'targetUserId is required.' });
    if (fromId === targetUserId) return res.status(400).json({ message: 'Cannot request yourself.' });
    const me = await User.findById(fromId).select('friends').lean();
    if (!me) return res.status(404).json({ message: 'User not found.' });
    if (me.friends.some(f => f.toString() === targetUserId))
      return res.status(409).json({ message: 'Already friends.' });
    const target = await User.findById(targetUserId).select('_id').lean();
    if (!target) return res.status(404).json({ message: 'Target user not found.' });
    const request = await FriendRequest.findOneAndUpdate(
      { from: fromId, to: targetUserId },
      { status: 'pending' },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.status(201).json(request);
  } catch (err) {
    if (err.code === 11000) return res.status(409).json({ message: 'Request already sent.' });
    console.error('[sendFriendRequest]', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── GET /api/social/friend-requests ──────────────────────────────────────────
export const getIncomingRequests = async (req, res) => {
  try {
    const requests = await FriendRequest.find({ to: req.user.id, status: 'pending' })
      .populate('from', 'name avatar shareCode')
      .sort({ createdAt: -1 }).lean();
    res.json(requests);
  } catch (err) {
    console.error('[getIncomingRequests]', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── PATCH /api/social/friend-requests/:id/accept ──────────────────────────────
export const acceptFriendRequest = async (req, res) => {
  try {
    const request = await FriendRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: 'Request not found.' });
    if (request.to.toString() !== req.user.id) return res.status(403).json({ message: 'Not authorised.' });
    if (request.status !== 'pending') return res.status(409).json({ message: `Already ${request.status}.` });
    request.status = 'accepted';
    await request.save();
    await Promise.all([
      User.findByIdAndUpdate(request.from, { $addToSet: { friends: request.to   } }),
      User.findByIdAndUpdate(request.to,   { $addToSet: { friends: request.from } }),
    ]);
    await grantXp(req.user.id, 10, 'Accepted a friend request', `friend_added_${request.from}`);
    res.json({ message: 'Friend request accepted.', request });
  } catch (err) {
    console.error('[acceptFriendRequest]', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── PATCH /api/social/friend-requests/:id/decline ─────────────────────────────
export const declineFriendRequest = async (req, res) => {
  try {
    const request = await FriendRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: 'Request not found.' });
    if (request.to.toString() !== req.user.id) return res.status(403).json({ message: 'Not authorised.' });
    if (request.status !== 'pending') return res.status(409).json({ message: `Already ${request.status}.` });
    request.status = 'declined';
    await request.save();
    res.json({ message: 'Request declined.', request });
  } catch (err) {
    console.error('[declineFriendRequest]', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── DELETE /api/social/friend-requests/:id (either party can cancel) ──────────
export const cancelFriendRequest = async (req, res) => {
  try {
    const request = await FriendRequest.findById(req.params.id);
    if (!request) return res.status(404).json({ message: 'Request not found.' });
    const uid = req.user.id;
    if (request.from.toString() !== uid && request.to.toString() !== uid)
      return res.status(403).json({ message: 'Not authorised.' });
    await FriendRequest.deleteOne({ _id: req.params.id });
    res.json({ message: 'Request cancelled.' });
  } catch (err) {
    console.error('[cancelFriendRequest]', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── GET /api/social/friend-status/:userId ─────────────────────────────────────
export const getFriendStatus = async (req, res) => {
  try {
    const myId = req.user.id;
    const otherId = req.params.userId;
    if (myId === otherId) return res.status(400).json({ status: 'own' });
    const me = await User.findById(myId).select('friends').lean();
    if (!me) return res.status(404).json({ message: 'Not found.' });
    if (me.friends.some(f => f.toString() === otherId))
      return res.json({ status: 'friends', requestId: null });
    const sent = await FriendRequest.findOne({ from: myId, to: otherId, status: 'pending' }).lean();
    if (sent) return res.json({ status: 'pending_sent', requestId: sent._id });
    const recv = await FriendRequest.findOne({ from: otherId, to: myId, status: 'pending' }).lean();
    if (recv) return res.json({ status: 'pending_received', requestId: recv._id });
    res.json({ status: 'none', requestId: null });
  } catch (err) {
    console.error('[getFriendStatus]', err);
    res.status(500).json({ message: 'Server error' });
  }
};

// ── DELETE /api/social/friends/:userId (by userId, bidirectional) ─────────────
export const removeFriendById = async (req, res) => {
  try {
    const myId = req.user.id;
    const friendId = req.params.userId;
    await Promise.all([
      User.findByIdAndUpdate(myId,     { $pull: { friends: friendId } }),
      User.findByIdAndUpdate(friendId, { $pull: { friends: myId     } }),
    ]);
    res.json({ message: 'Friend removed.' });
  } catch (err) {
    console.error('[removeFriendById]', err);
    res.status(500).json({ message: 'Server error' });
  }
};

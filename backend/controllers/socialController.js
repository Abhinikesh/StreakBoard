import User from '../models/User.js';
import Habit from '../models/Habit.js';
import HabitLog from '../models/HabitLog.js';

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

    // Return ONLY aggregate stats — no habit names, icons, logs, email, or friends
    res.json({
      name: user.name || 'StreakBoard User',
      avatar: user.avatar || null,
      memberSince: user.createdAt,
      stats: {
        totalHabits: habits.length,
        totalDone,
        longestStreak,
        overallRate,
        activeDays: uniqueActiveDays,
      },
      // habits array intentionally omitted — privacy
      // logs array intentionally omitted — privacy
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

    await User.findByIdAndUpdate(req.user.id, { $addToSet: { friends: friend._id } });
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
    }).select('name avatar shareCode createdAt');

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

        // Calculate longest streak across all habits
        let longestStreak = 0;
        habits.forEach((habit) => {
          const habitDoneDates = logs
            .filter(
              (l) =>
                l.habitId.toString() === habit._id.toString() &&
                l.status === 'done'
            )
            .map((l) => l.date)
            .sort();

          let best = 0,
            run = 0;
          for (let i = 0; i < habitDoneDates.length; i++) {
            if (i === 0) {
              run = 1;
              continue;
            }
            const prev = new Date(habitDoneDates[i - 1] + 'T00:00:00');
            const curr = new Date(habitDoneDates[i] + 'T00:00:00');
            const diff = (curr - prev) / (1000 * 60 * 60 * 24);
            run = diff === 1 ? run + 1 : 1;
            if (run > best) best = run;
          }
          if (run > best) best = run;
          if (best > longestStreak) longestStreak = best;
        });

        return {
          name: user.name || 'StreakBoard User',
          avatar: user.avatar || null,
          shareCode: user.shareCode,
          totalHabits: habits.length,
          totalDone,
          overallRate,
          longestStreak,
          memberSince: user.createdAt,
        };
      })
    );

    // Sort by longestStreak descending
    leaderboardData.sort((a, b) => b.longestStreak - a.longestStreak);

    res.json(leaderboardData);
  } catch (err) {
    console.error('getLeaderboard error:', err);
    res.status(500).json({ message: 'Server error' });
  }
};

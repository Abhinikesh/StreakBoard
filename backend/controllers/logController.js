import HabitLog from "../models/HabitLog.js";
import Habit from "../models/Habit.js";
import mongoose from "mongoose";
import { grantXp, getStreakMilestone } from '../lib/xp.js';
import { grantShield } from '../lib/shields.js';
import Season from '../models/Season.js';
import SeasonRanking from '../models/SeasonRanking.js';
import WeeklyChallenge from '../models/WeeklyChallenge.js';
import FriendChallenge from '../models/FriendChallenge.js';
import { evaluateUserProgress } from '../lib/weeklyChallenge.js';

// ── Helper: compute current streak for a habit from its logs ───
// Rules:
//   - Both 'done' and 'missed' statuses keep the streak alive
//   - Only a day with NO log entry at all breaks the streak
//   - Streak is active if today OR yesterday has any log
//     (grace period: user can still log today without losing yesterday's streak)
//   - If neither today nor yesterday is logged → streak = 0
async function computeStreak(habitId) {
  // Fetch ALL logs regardless of status — missed also keeps streak alive
  const logs = await HabitLog.find({ habitId }).select('date').lean();
  const loggedDates = new Set(logs.map(l => l.date));

  const pad = n => String(n).padStart(2, '0');
  const toStr = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

  const today = new Date();
  const todayStr = toStr(today);

  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = toStr(yesterday);

  // Streak is dead if neither today nor yesterday has any log
  if (!loggedDates.has(todayStr) && !loggedDates.has(yesterdayStr)) return 0;

  // Start counting from today if logged, otherwise from yesterday
  const startDate = loggedDates.has(todayStr) ? new Date(today) : new Date(yesterday);

  let streak = 0;
  const cur = new Date(startDate);
  while (true) {
    const ds = toStr(cur);
    if (loggedDates.has(ds)) {
      streak++;
      cur.setDate(cur.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
}

// ── POST /api/logs ─────────────────────────────────────────────
export const logHabit = async (req, res) => {
  try {
    const { habitId, date, status, note } = req.body;

    if (!habitId || !date || !status) {
      return res.status(400).json({ message: "habitId, date, and status are required" });
    }
    if (!["done", "missed"].includes(status)) {
      return res.status(400).json({ message: 'status must be "done" or "missed"' });
    }

    const setFields = { userId: req.user.id, habitId, date, status };
    if (note !== undefined) setFields.note = note.slice(0, 280);

    const log = await HabitLog.findOneAndUpdate(
      { habitId, date },
      { $set: setFields },
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
    );

    // ── Badge: award 100-day streak badge if earned ──
    let xpResult = null;   // accumulates level-up info for response
    let totalXpGained = 0;

    if (status === 'done') {
      const streak = await computeStreak(habitId);

      if (streak >= 100) {
        const habit = await Habit.findOne({ _id: habitId, userId: req.user.id });
        if (habit && !habit.badges.some(b => b.type === '100_day_streak')) {
          habit.badges.push({
            type: '100_day_streak',
            earnedAt: new Date(),
            habitName: habit.name,
          });
          await habit.save();
        }
      }

      // ── XP: +10 per done log (once per habit per day) ────────────────────────
      const habitLogKey = `habit_done_${habitId}_${date}`;
      const r1 = await grantXp(req.user.id, 10, `Logged habit on ${date}`, habitLogKey);
      if (r1) { xpResult = r1; totalXpGained += 10; }

      // ── Season: update user's best streak for the current season ─────────
      if (streak > 0) {
        const activeSeason = await Season.findOne({ status: 'active' }).select('_id').lean();
        if (activeSeason) {
          await SeasonRanking.findOneAndUpdate(
            { seasonId: activeSeason._id, userId: req.user.id },
            { $max: { bestStreak: streak } },
            { upsert: true, setDefaultsOnInsert: true }
          );
        }
      }

      // ── Weekly challenge: re-evaluate progress (fire-and-forget) ────────
      WeeklyChallenge.findOne({ status: 'active' }).select('_id type targetValue title startDate endDate').lean()
        .then(wc => { if (wc) evaluateUserProgress(req.user.id, wc).catch(() => {}); })
        .catch(() => {});

      // ── Friend challenges: credit today's log (fire-and-forget) ──────────
      const today = date; // already 'YYYY-MM-DD' from request body
      FriendChallenge.find({
        $or: [{ challengerId: req.user.id }, { challengedId: req.user.id }],
        status: 'active',
      }).select('_id challengerId habitName startDate endDate challengerDaysLogged challengedDaysLogged').lean()
        .then(async (activeFCs) => {
          for (const fc of activeFCs) {
            // Only credit if logged date is within challenge window
            if (today < fc.startDate || today > fc.endDate) continue;
            const hName = (h?.name || '').toLowerCase().trim();
            if (!hName || hName !== fc.habitName.toLowerCase().trim()) continue;
            const isChallenger = fc.challengerId.toString() === req.user.id.toString();
            const field = isChallenger ? 'challengerDaysLogged' : 'challengedDaysLogged';
            const alreadyLogged = isChallenger
              ? fc.challengerDaysLogged.includes(today)
              : fc.challengedDaysLogged.includes(today);
            if (!alreadyLogged) {
              await FriendChallenge.findByIdAndUpdate(fc._id, { $addToSet: { [field]: today } });
            }
          }
        }).catch(() => {});

      // ── XP: streak milestones ───────────────────────────────────────
      const milestone = getStreakMilestone(streak);
      if (milestone) {
        // key includes streak start date so each new streak can earn the milestone again
        const logDate = new Date(date + 'T00:00:00Z');
        const startDate = new Date(logDate);
        startDate.setUTCDate(logDate.getUTCDate() - (streak - 1));
        const startStr = startDate.toISOString().split('T')[0];
        const mKey = `streak_${milestone.milestone}_${habitId}_${startStr}`;
        const r2 = await grantXp(
          req.user.id, milestone.xp,
          `${milestone.milestone}-day streak on ${date}`,
          mKey
        );
        if (r2) { xpResult = r2; totalXpGained += milestone.xp; }
      }

      // ── XP: +25 full-day completion bonus ──────────────────────────────
      const fullDayKey = `full_day_${req.user.id}_${date}`;
      const activeHabits = await Habit.countDocuments({ userId: req.user.id, isActive: true });
      const doneTodayCount = await HabitLog.countDocuments({ userId: req.user.id, date, status: 'done' });
      if (activeHabits > 0 && doneTodayCount >= activeHabits) {
        const r3 = await grantXp(req.user.id, 25, `All habits completed on ${date}`, fullDayKey);
        if (r3) { xpResult = r3; totalXpGained += 25; }
      }

      // ── Shields: earn at streak milestones ──────────────────────────────
      if (milestone) {
        const logDate2 = new Date(date + 'T00:00:00Z');
        const sDate = new Date(logDate2);
        sDate.setUTCDate(logDate2.getUTCDate() - (streak - 1));
        const sStr = sDate.toISOString().split('T')[0];

        let shieldAmount = 0;
        let shieldMilestoneLabel = '';
        if (milestone.milestone === 7)  { shieldAmount = 1; shieldMilestoneLabel = '7-day streak'; }
        if (milestone.milestone === 14) { shieldAmount = 1; shieldMilestoneLabel = '14-day streak'; }
        if (milestone.milestone >= 30)  { shieldAmount = 2; shieldMilestoneLabel = `${milestone.milestone}-day streak`; }

        if (shieldAmount > 0) {
          const shieldKey = `shield_streak_${milestone.milestone}_${habitId}_${sStr}`;
          await grantShield(
            req.user.id, shieldAmount,
            `Earned ${shieldAmount} shield${shieldAmount > 1 ? 's' : ''} for ${shieldMilestoneLabel}`,
            shieldKey
          );
        }
      }

      // ── Shields: +1 for leveling up ────────────────────────────────────
      if (xpResult?.leveledUp) {
        const lvlShieldKey = `shield_levelup_${xpResult.newLevel}`;
        await grantShield(
          req.user.id, 1,
          `Leveled up to ${xpResult.newLevelName}`,
          lvlShieldKey
        );
      }
    }

    return res.status(200).json({
      ...log.toObject(),
      xp: xpResult ? {
        gained:       totalXpGained,
        leveledUp:    xpResult.leveledUp,
        newLevel:     xpResult.newLevel,
        newLevelName: xpResult.newLevelName,
        newTotalXp:   xpResult.newXp,
      } : null,
    });
  } catch (err) {
    console.error("[logHabit]", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ── GET /api/logs/:habitId ─────────────────────────────────────
export const getLogsForHabit = async (req, res) => {
  try {
    const { habitId } = req.params;
    const { month } = req.query;

    const filter = { habitId, userId: req.user.id };
    if (month) filter.date = { $regex: `^${month}` };

    const logs = await HabitLog.find(filter).sort({ date: 1 });
    return res.status(200).json(logs);
  } catch (err) {
    console.error("[getLogsForHabit]", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ── GET /api/logs/all ──────────────────────────────────────────
export const getAllLogsForUser = async (req, res) => {
  try {
    const rawLogs = await HabitLog.find({ userId: req.user.id }).sort({ date: -1 });

    // Flat array — include note field
    const logs = rawLogs.map(log => ({
      _id: log._id,
      habit: log.habitId,
      habitId: log.habitId,
      date: log.date,
      status: log.status,
      note: log.note || '',
    }));

    return res.status(200).json(logs);
  } catch (err) {
    console.error("[getAllLogsForUser]", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ── PATCH /api/logs/:id/note ───────────────────────────────────
export const updateLogNote = async (req, res) => {
  try {
    const { note } = req.body;

    if (note === undefined) {
      return res.status(400).json({ message: "note field is required" });
    }
    if (note.length > 280) {
      return res.status(400).json({ message: "Note cannot exceed 280 characters" });
    }

    const log = await HabitLog.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { $set: { note } },
      { new: true }
    );

    if (!log) return res.status(404).json({ message: "Log not found" });
    return res.status(200).json(log);
  } catch (err) {
    console.error("[updateLogNote]", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ── DELETE /api/logs/:id ───────────────────────────────────────
export const deleteLog = async (req, res) => {
  try {
    const log = await HabitLog.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
    if (!log) return res.status(404).json({ message: "Log not found" });
    return res.status(200).json({ message: "Log deleted" });
  } catch (err) {
    console.error("[deleteLog]", err);
    return res.status(500).json({ message: "Server error" });
  }
};

import HabitLog from "../models/HabitLog.js";
import Habit from "../models/Habit.js";
import mongoose from "mongoose";

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

    // ── Badge: award 100-day streak badge if earned ──────────────
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
    }

    return res.status(200).json(log);
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

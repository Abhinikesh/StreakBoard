import HabitLog from "../models/HabitLog.js";
import Habit from "../models/Habit.js";
import mongoose from "mongoose";

// ── Helper: compute current streak for a habit from its logs ───
async function computeStreak(habitId) {
  const logs = await HabitLog.find({ habitId, status: 'done' }).select('date').lean();
  const doneDates = new Set(logs.map(l => l.date));

  const pad = n => String(n).padStart(2, '0');
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  if (!doneDates.has(todayStr)) return 0;

  let streak = 1;
  const cur = new Date(today);
  cur.setDate(cur.getDate() - 1);
  while (true) {
    const ds = `${cur.getFullYear()}-${pad(cur.getMonth() + 1)}-${pad(cur.getDate())}`;
    if (doneDates.has(ds)) { streak++; cur.setDate(cur.getDate() - 1); }
    else break;
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

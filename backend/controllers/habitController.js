import Habit from "../models/Habit.js";
import HabitLog from "../models/HabitLog.js";
import { grantXp } from '../lib/xp.js';

// ── POST /api/habits ───────────────────────────────────────────
/**
 * Create a new habit for the authenticated user.
 * Body: { name, icon, colorHex, trackingPeriod, startDate }
 */
export const createHabit = async (req, res) => {
  try {
    const { name, icon, colorHex, trackingPeriod, startDate } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Habit name is required" });
    }

    // Auto-set startDate to today if not provided
    const resolvedStartDate =
      startDate || new Date().toISOString().split("T")[0];

    const habit = await Habit.create({
      userId: req.user.id,
      name,
      icon,
      colorHex,
      trackingPeriod: Number(trackingPeriod) || 30,
      startDate: resolvedStartDate,
    });

    // XP: +20 one-time award for creating the very first habit
    const habitCount = await Habit.countDocuments({ userId: req.user.id });
    if (habitCount === 1) {
      await grantXp(req.user.id, 20, 'Created first habit', 'first_habit');
    }

    return res.status(201).json(habit);
  } catch (err) {
    console.error("[createHabit]", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ── GET /api/habits ────────────────────────────────────────────
/**
 * Return all active habits for the authenticated user,
 * sorted oldest-first.
 */
export const getHabits = async (req, res) => {
  try {
    const habits = await Habit.find({
      userId: req.user.id,
      isActive: true,
    }).sort({ sortOrder: 1, createdAt: 1 }); // user-defined order, then creation date

    return res.status(200).json(habits);
  } catch (err) {
    console.error("[getHabits]", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ── GET /api/habits/:id ────────────────────────────────────────
/**
 * Return a single habit by id, only if it belongs to req.user.id.
 */
export const getHabitById = async (req, res) => {
  try {
    const habit = await Habit.findOne({
      _id: req.params.id,
      userId: req.user.id,
    });

    if (!habit) {
      return res.status(404).json({ message: "Habit not found" });
    }

    return res.status(200).json(habit);
  } catch (err) {
    console.error("[getHabitById]", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ── PUT /api/habits/:id ────────────────────────────────────────
/**
 * Update a habit's editable fields.
 * Body: { name, icon, colorHex, trackingPeriod, startDate }
 * Only updates if the habit belongs to req.user.id.
 */
export const updateHabit = async (req, res) => {
  try {
    const { name, icon, colorHex, trackingPeriod, startDate } = req.body;

    const updatePayload = { name, icon, colorHex };
    if (trackingPeriod !== undefined)
      updatePayload.trackingPeriod = Number(trackingPeriod);
    if (startDate !== undefined) updatePayload.startDate = startDate;

    const habit = await Habit.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { $set: updatePayload },
      { new: true, runValidators: true }
    );

    if (!habit) {
      return res.status(404).json({ message: "Habit not found" });
    }

    return res.status(200).json(habit);
  } catch (err) {
    console.error("[updateHabit]", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ── DELETE /api/habits/:id ─────────────────────────────────────
/**
 * Soft-delete a habit by setting isActive = false.
 * Only if habit belongs to req.user.id.
 */
export const deleteHabit = async (req, res) => {
  try {
    const habit = await Habit.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { $set: { isActive: false } },
      { new: true }
    );

    if (!habit) {
      return res.status(404).json({ message: "Habit not found" });
    }

    return res.status(200).json({ message: "Habit removed" });
  } catch (err) {
    console.error("[deleteHabit]", err);
    return res.status(500).json({ message: "Server error" });
  }
};

// ── POST /api/habits/mark-all-done ────────────────────────────────────
/**
 * Mark every active habit as 'done' for today.
 * Called by the service worker notification action via postMessage → page → API.
 * Skips habits that are already marked done today.
 */
export const markAllHabitsDone = async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0]; // "YYYY-MM-DD"

    const habits = await Habit.find({ userId: req.user.id, isActive: true });
    if (habits.length === 0) {
      return res.json({ message: 'No active habits', count: 0 });
    }

    let count = 0;
    for (const habit of habits) {
      const existing = await HabitLog.findOne({
        habitId: habit._id,
        userId:  req.user.id,
        date:    today,
      });
      if (!existing || existing.status !== 'done') {
        await HabitLog.findOneAndUpdate(
          { habitId: habit._id, userId: req.user.id, date: today },
          { $set: { userId: req.user.id, habitId: habit._id, date: today, status: 'done' } },
          { upsert: true, new: true, setDefaultsOnInsert: true }
        );
        count++;
      }
    }

    return res.json({ message: `${count} habit${count !== 1 ? 's' : ''} marked done`, count });
  } catch (err) {
    console.error('[markAllHabitsDone]', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// ── PATCH /api/habits/:id/reminder ────────────────────────────────────────────
export const updateHabitReminder = async (req, res) => {
  try {
    const { reminderEnabled, reminderTime } = req.body;
    const habitId = req.params.id;

    // Validate time format if provided
    if (reminderTime !== null && reminderTime !== undefined) {
      const parts = String(reminderTime).split(':');
      const h = parseInt(parts[0], 10), m = parseInt(parts[1], 10);
      if (isNaN(h) || isNaN(m) || h < 0 || h > 23 || m < 0 || m > 59)
        return res.status(400).json({ message: 'Invalid time format. Use HH:MM.' });
    }

    const habit = await Habit.findOne({ _id: habitId, userId: req.user.id });
    if (!habit) return res.status(404).json({ message: 'Habit not found.' });

    if (reminderEnabled !== undefined) habit.reminderEnabled = !!reminderEnabled;
    if (reminderTime    !== undefined) habit.reminderTime    = reminderTime || null;
    await habit.save();

    return res.json(habit);
  } catch (err) {
    console.error('[updateHabitReminder]', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

// ── PATCH /api/habits/reorder ───────────────────────────────────────────────
/**
 * Bulk-update sortOrder after drag-to-reorder.
 * Body: { order: [{ id: string, sortOrder: number }] }
 */
export const reorderHabits = async (req, res) => {
  try {
    const { order } = req.body;
    if (!Array.isArray(order) || !order.length) {
      return res.status(400).json({ message: 'order array is required' });
    }
    await Habit.bulkWrite(
      order.map(({ id, sortOrder }) => ({
        updateOne: {
          filter: { _id: id, userId: req.user.id },
          update: { $set: { sortOrder: Number(sortOrder) } },
        },
      }))
    );
    return res.json({ message: 'Order saved' });
  } catch (err) {
    console.error('[reorderHabits]', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

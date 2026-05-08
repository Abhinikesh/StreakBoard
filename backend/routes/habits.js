import express from "express";
import authMiddleware from "../middleware/auth.js";
import {
  createHabit,
  getHabits,
  getHabitById,
  updateHabit,
  deleteHabit,
  markAllHabitsDone,
  updateHabitReminder,
  reorderHabits,
} from "../controllers/habitController.js";

const router = express.Router();

// All habit routes are protected
router.use(authMiddleware);

// GET    /api/habits       → list all active habits for user
router.get("/", getHabits);

// POST   /api/habits               → create a new habit
router.post("/", createHabit);

// POST   /api/habits/mark-all-done → mark all active habits done for today
// IMPORTANT: must be declared before /:id so 'mark-all-done' isn't treated as a param
router.post("/mark-all-done", markAllHabitsDone);

// PATCH  /api/habits/reorder → save drag-to-reorder order
// IMPORTANT: must be declared before /:id so 'reorder' isn't treated as a param
router.patch("/reorder", reorderHabits);

// GET    /api/habits/:id   → get a single habit by id
router.get("/:id", getHabitById);

// PUT    /api/habits/:id   → update a habit
router.put("/:id", updateHabit);

// DELETE /api/habits/:id   → soft-delete a habit
router.delete("/:id", deleteHabit);

// PATCH  /api/habits/:id/reminder → update per-habit reminder settings
router.patch("/:id/reminder", updateHabitReminder);

export default router;

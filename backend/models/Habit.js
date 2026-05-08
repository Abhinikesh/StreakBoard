import mongoose from "mongoose";

const habitSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "userId is required"],
    },
    name: {
      type: String,
      required: [true, "Habit name is required"],
      trim: true,
    },
    icon: {
      type: String,
      default: "⭐",
    },
    colorHex: {
      type: String,
      default: "#6366F1",
    },
    startDate: {
      type: String,
      default: null, // "YYYY-MM-DD" — the day user started this habit
    },
    trackingPeriod: {
      type: Number,
      default: 30,
      min: 1,
      max: 365,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    badges: [
      {
        type:      { type: String, default: '100_day_streak' },
        earnedAt:  { type: Date,   default: Date.now },
        habitName: { type: String },
      }
    ],
    reminderEnabled: { type: Boolean, default: false },
    reminderTime:    { type: String,  default: null }, // "HH:MM" 24h
    sortOrder:       { type: Number,  default: 0 },    // user-defined display order
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

const Habit = mongoose.model("Habit", habitSchema);

export default Habit;

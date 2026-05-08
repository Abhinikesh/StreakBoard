import mongoose from "mongoose";

const xpEventSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "userId is required"],
    },
    amount: {
      type: Number,
      required: [true, "amount is required"],
      default: 0,
    },
    reason: {
      type: String,
      required: [true, "reason is required"],
    },
  },
  {
    timestamps: { createdAt: "earnedAt", updatedAt: false },
  }
);

const XpEvent = mongoose.model("XpEvent", xpEventSchema);

export default XpEvent;

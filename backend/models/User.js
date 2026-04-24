import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: {
      type: String,
      default: null, // optional — OTP users won't have a password
    },
    googleId: {
      type: String,
      default: null, // optional — only set for Google OAuth users
    },
    avatar: {
      type: String,
      default: "",
    },
    shareCode: {
      type: String,
      unique: true,
      sparse: true,
    },
    isProfilePublic: {
      type: Boolean,
      default: false,
    },
    friends: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
    reminderEnabled: {
      type: Boolean,
      default: false,
    },
    reminderTime: {
      type: String,
      default: '21:00', // stored in UTC "HH:MM"
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
  }
);

const User = mongoose.model("User", userSchema);

export default User;

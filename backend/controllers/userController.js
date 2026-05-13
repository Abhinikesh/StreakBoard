import { uploadToCloudinary } from '../middleware/upload.js';
import User from '../models/User.js';

export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('name email avatar createdAt bio bannerColor pinnedBadge seasonBadges');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const result = await uploadToCloudinary(req.file.buffer);
    await User.findByIdAndUpdate(req.user.id, { avatar: result.secure_url });
    res.json({ avatar: result.secure_url });
  } catch (error) {
    res.status(500).json({ message: 'Upload failed', error: error.message });
  }
};

// ── PATCH /api/user/push-token ────────────────────────────────────────────────
// Saves (or clears) the Expo push token for the authenticated user's device.
export const savePushToken = async (req, res) => {
  try {
    const { token } = req.body;
    // Allow null/empty to clear the token (e.g. on logout)
    const expoPushToken = token?.trim() || null;
    await User.findByIdAndUpdate(req.user.id, { expoPushToken });
    res.json({ ok: true });
  } catch (err) {
    console.error('[savePushToken]', err);
    res.status(500).json({ message: 'Server error' });
  }
};


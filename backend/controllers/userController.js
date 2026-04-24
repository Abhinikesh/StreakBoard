import { uploadToCloudinary } from '../middleware/upload.js';
import User from '../models/User.js';

export const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('name email avatar createdAt');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
};

export const uploadAvatar = async (req, res) => {
  try {
    console.log('=== UPLOAD REQUEST RECEIVED ===');
    console.log('req.file exists:', !!req.file);
    console.log('buffer size:', req.file?.buffer?.length ?? 'NO BUFFER');
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const result = await uploadToCloudinary(req.file.buffer);
    await User.findByIdAndUpdate(req.user.id, { avatar: result.secure_url });
    res.json({ avatar: result.secure_url });
  } catch (error) {
    console.log('=== UPLOAD AVATAR CATCH ERROR ===');
    console.log(error);
    res.status(500).json({ message: 'Upload failed', error: error.message });
  }
};

import { uploadToCloudinary } from '../middleware/upload.js';
import User from '../models/User.js';

export const uploadAvatar = async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });
    const result = await uploadToCloudinary(req.file.buffer);
    await User.findByIdAndUpdate(req.user.id, { avatar: result.secure_url });
    res.json({ avatar: result.secure_url });
  } catch (error) {
    res.status(500).json({ message: 'Upload failed' });
  }
};

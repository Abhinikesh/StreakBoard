import express from 'express';
import auth from '../middleware/auth.js';
import upload from '../middleware/upload.js';
import { uploadAvatar, getProfile, savePushToken } from '../controllers/userController.js';

const router = express.Router();

// GET /api/user/profile
router.get('/profile', auth, getProfile);

// POST /api/user/avatar
router.post('/avatar', auth, upload.single('avatar'), uploadAvatar);

// PATCH /api/user/push-token — saves the Expo push token for this device
router.patch('/push-token', auth, savePushToken);

export default router;

import express from 'express';
import auth from '../middleware/auth.js';
import upload from '../middleware/upload.js';
import { uploadAvatar } from '../controllers/userController.js';

const router = express.Router();

// POST /api/user/avatar
router.post('/avatar', auth, upload.single('avatar'), uploadAvatar);

export default router;

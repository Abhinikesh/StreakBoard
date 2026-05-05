import express from 'express';
import auth from '../middleware/auth.js';
import { getXpProfile, getXpHistory } from '../controllers/xpController.js';

const router = express.Router();

router.get('/profile', auth, getXpProfile);
router.get('/history', auth, getXpHistory);

export default router;

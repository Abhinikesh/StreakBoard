import express from 'express';
import auth from '../middleware/auth.js';
import { getShieldStatus } from '../controllers/shieldController.js';

const router = express.Router();

router.get('/status', auth, getShieldStatus);

export default router;

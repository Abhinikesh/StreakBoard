import express from 'express';
import auth from '../middleware/auth.js';
import {
  getVapidPublicKey,
  subscribe,
  unsubscribe,
  getReminderSettings,
  updateReminderSettings,
} from '../controllers/notificationController.js';

const router = express.Router();

// Public — no auth needed
router.get('/vapid-public-key', getVapidPublicKey);

// Protected
router.post('/subscribe',    auth, subscribe);
router.delete('/unsubscribe', auth, unsubscribe);
router.get('/settings',      auth, getReminderSettings);
router.patch('/settings',    auth, updateReminderSettings);

export default router;

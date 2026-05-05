import express from 'express';
import auth from '../middleware/auth.js';
import {
  getVapidPublicKey,
  subscribe,
  unsubscribe,
  getReminderSettings,
  updateReminderSettings,
  getNotificationPrefs,
  updateNotificationPrefs,
  handleEmailUnsubscribe,
} from '../controllers/notificationController.js';

const router = express.Router();

// ── Public (no auth) ──────────────────────────────────────────────────────────
router.get('/vapid-public-key',    getVapidPublicKey);
router.get('/unsubscribe-email',   handleEmailUnsubscribe); // one-click email unsubscribe

// ── Protected ─────────────────────────────────────────────────────────────────
router.post('/subscribe',          auth, subscribe);
router.delete('/unsubscribe',      auth, unsubscribe);

// Personal reminder settings (existing)
router.get('/settings',            auth, getReminderSettings);
router.patch('/settings',          auth, updateReminderSettings);

// Global notification preferences (new: email + push opt-in/out)
router.get('/prefs',               auth, getNotificationPrefs);
router.patch('/prefs',             auth, updateNotificationPrefs);

export default router;

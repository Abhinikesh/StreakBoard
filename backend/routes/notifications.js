import express from 'express';
import auth from '../middleware/auth.js';
import {
  getVapidPublicKey,
  subscribe,
  unsubscribe,
  getReminderSettings,
  updateReminderSettings,
  sendGlobalReminders,
} from '../controllers/notificationController.js';

const router = express.Router();

// Public — no auth needed
router.get('/vapid-public-key', getVapidPublicKey);

// Protected
router.post('/subscribe',    auth, subscribe);
router.delete('/unsubscribe', auth, unsubscribe);
router.get('/settings',      auth, getReminderSettings);
router.patch('/settings',    auth, updateReminderSettings);

// ── DEV / TEST — no auth (remove before shipping to production) ───────────────
// GET /api/notifications/test-global/:type
// Example: curl http://localhost:5002/api/notifications/test-global/morning
router.get('/test-global/:type', async (req, res) => {
  try {
    await sendGlobalReminders(req.params.type);
    res.json({ message: `${req.params.type} global reminder triggered` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

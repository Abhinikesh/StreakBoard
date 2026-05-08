import express from 'express';
import auth    from '../middleware/auth.js';
import { getWeeklySummary } from '../controllers/weeklySummaryController.js';

const router = express.Router();

// GET /api/weekly-summary
// Returns this week's stats for the in-app summary card (Sunday/Monday only shows card).
router.get('/', auth, getWeeklySummary);

export default router;

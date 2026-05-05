/**
 * controllers/shieldController.js
 *
 * GET /api/shields/status  — Returns current shield state for the auth'd user.
 */
import User        from '../models/User.js';
import ShieldEvent from '../models/ShieldEvent.js';

// ── GET /api/shields/status ───────────────────────────────────────────────────
export const getShieldStatus = async (req, res) => {
  try {
    const user = await User.findById(req.user.id)
      .select('shieldCount shieldsUsedTotal')
      .lean();

    if (!user) return res.status(404).json({ message: 'User not found' });

    res.json({
      shieldCount:      user.shieldCount      ?? 0,
      shieldsUsedTotal: user.shieldsUsedTotal ?? 0,
    });
  } catch (err) {
    console.error('[getShieldStatus]', err);
    res.status(500).json({ message: 'Server error' });
  }
};

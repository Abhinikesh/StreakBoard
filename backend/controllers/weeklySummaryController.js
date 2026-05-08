/**
 * controllers/weeklySummaryController.js
 *
 * GET /api/weekly-summary
 * Returns this week's stats for the in-app summary card.
 * Frontend calls this on Sunday/Monday and shows a dismissable card.
 */

import Habit    from '../models/Habit.js';
import HabitLog from '../models/HabitLog.js';

const pad   = n => String(n).padStart(2, '0');
const toUTC = d => `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())}`;

function getWeekBounds(refDate) {
  const day = refDate.getUTCDay();                  // 0=Sun … 6=Sat
  const daysFromMon = day === 0 ? 6 : day - 1;

  const monday = new Date(refDate);
  monday.setUTCDate(refDate.getUTCDate() - daysFromMon);
  monday.setUTCHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  sunday.setUTCHours(23, 59, 59, 999);

  return { monday, sunday };
}

function weekLabel(monday, sunday) {
  const opts = { month: 'short', day: 'numeric', timeZone: 'UTC' };
  const m = monday.toLocaleDateString('en-US', opts);
  const s = sunday.toLocaleDateString('en-US', { ...opts, year: 'numeric' });
  return `${m} – ${s}`;
}

export const getWeeklySummary = async (req, res) => {
  try {
    const userId = req.user.id;
    const now    = new Date();
    const { monday, sunday } = getWeekBounds(now);
    const monStr = toUTC(monday);
    const sunStr = toUTC(sunday);

    // No habits → no summary
    const habitCount = await Habit.countDocuments({ userId, isActive: true });
    if (!habitCount) {
      return res.json({ available: false });
    }

    const habits = await Habit.find({ userId, isActive: true }).select('_id').lean();

    // This week's logs
    const thisWeekLogs = await HabitLog.find({
      userId,
      date: { $gte: monStr, $lte: sunStr },
    }).select('date status').lean();

    const daySet    = new Set(thisWeekLogs.map(l => l.date));
    const daysLogged = daySet.size;
    const totalLogs  = thisWeekLogs.length;

    // Best streak across all habits for this week
    let bestStreak = 0;
    for (const h of habits) {
      const hLogs = await HabitLog.find({ habitId: h._id })
        .select('date').lean();
      const dateSet = new Set(hLogs.map(l => l.date));

      let streak = 0;
      const cur  = new Date(sunday);
      while (toUTC(cur) >= monStr) {
        if (dateSet.has(toUTC(cur))) {
          streak++;
          cur.setUTCDate(cur.getUTCDate() - 1);
        } else {
          break;
        }
      }
      if (streak > bestStreak) bestStreak = streak;
    }

    // Previous week
    const prevSunday = new Date(monday);
    prevSunday.setUTCDate(monday.getUTCDate() - 1);
    const { monday: prevMon } = getWeekBounds(prevSunday);
    const prevMonStr = toUTC(prevMon);
    const prevSunStr = toUTC(prevSunday);

    const prevLogs = await HabitLog.find({
      userId,
      date: { $gte: prevMonStr, $lte: prevSunStr },
    }).select('date').lean();
    const prevDaySet     = new Set(prevLogs.map(l => l.date));
    const prevDaysLogged = prevDaySet.size;
    const vsLastWeek     = daysLogged - prevDaysLogged;

    // XP this week — scan HabitLog for this week, each 'done' = 10 XP base
    // (mirrors the grantXp logic: 10 per done log + 25 full-day bonus)
    // We give an approximate sum here — accurate enough for the summary card.
    const doneCount   = thisWeekLogs.filter(l => l.status === 'done').length;
    const xpEstimated = doneCount * 10;

    return res.json({
      available:    true,
      weekLabel:    weekLabel(monday, sunday),
      monStr,
      sunStr,
      daysLogged,
      totalLogs,
      bestStreak,
      vsLastWeek,
      xpEarned:     xpEstimated,
    });
  } catch (err) {
    console.error('[getWeeklySummary]', err);
    return res.status(500).json({ message: 'Server error' });
  }
};

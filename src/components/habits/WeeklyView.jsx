import React, { useMemo } from 'react';
import { format, parseISO } from 'date-fns';

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getWeekDays() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dow = today.getDay();
  const monday = new Date(today);
  monday.setDate(today.getDate() - (dow === 0 ? 6 : dow - 1));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d.toISOString().split('T')[0];
  });
}

export default function WeeklyView({ habits = [], allLogs = [] }) {
  const weekDays = useMemo(() => getWeekDays(), []);
  const todayStr = new Date().toISOString().split('T')[0];

  const weekStart = weekDays[0];
  const weekEnd = weekDays[6];

  const weekRangeLabel = useMemo(() => {
    try {
      const s = format(parseISO(weekStart), 'MMM d');
      const e = format(parseISO(weekEnd), 'MMM d');
      return `${s} — ${e}`;
    } catch { return ''; }
  }, [weekStart, weekEnd]);

  const logMap = useMemo(() => {
    const map = {};
    allLogs.forEach(log => {
      const hid = log.habit?.toString() || log.habitId?.toString();
      if (hid && log.date) map[`${hid}_${log.date}`] = log.status;
    });
    return map;
  }, [allLogs]);

  const { doneToday, missedToday, pendingToday } = useMemo(() => {
    let done = 0, missed = 0, pending = 0;
    habits.forEach(h => {
      const key = `${h._id}_${todayStr}`;
      if (logMap[key] === 'done') done++;
      else if (logMap[key] === 'missed') missed++;
      else pending++;
    });
    return { doneToday: done, missedToday: missed, pendingToday: pending };
  }, [habits, logMap, todayStr]);

  // Best day this week
  const bestDay = useMemo(() => {
    let best = null, bestCount = 0;
    weekDays.forEach(date => {
      const count = habits.filter(h => logMap[`${h._id}_${date}`] === 'done').length;
      if (count > bestCount) { bestCount = count; best = date; }
    });
    if (!best || bestCount === 0) return null;
    try { return format(parseISO(best), 'EEEE'); } catch { return null; }
  }, [habits, logMap, weekDays]);

  if (habits.length === 0) {
    return (
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">This Week</h2>
          <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">{weekRangeLabel}</span>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 text-center">
          <p className="text-sm text-gray-400 dark:text-gray-500 font-medium">Add habits to see your weekly view</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">This Week</h2>
        <span className="text-xs text-gray-400 dark:text-gray-500 font-medium">{weekRangeLabel}</span>
      </div>

      {/* 7-day grid card */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-4">
        <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
          {weekDays.map((date, idx) => {
            const isToday = date === todayStr;
            const isFuture = date > todayStr;
            const dayNum = parseInt(date.split('-')[2], 10);

            return (
              <div
                key={date}
                className={`flex flex-col items-center rounded-xl py-2 px-0.5 ${
                  isToday
                    ? 'bg-indigo-50 dark:bg-indigo-900/20'
                    : ''
                }`}
              >
                {/* Day label */}
                <span className="text-[10px] sm:text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase mb-1">
                  {DAY_LABELS[idx]}
                </span>

                {/* Date number */}
                <span className={`text-sm font-bold mb-2 ${
                  isToday
                    ? 'text-indigo-600 dark:text-indigo-400'
                    : 'text-gray-600 dark:text-gray-300'
                }`}>
                  {dayNum}
                </span>

                {/* Habit dots */}
                <div className="flex flex-col items-center gap-0.5">
                  {habits.map(habit => {
                    const key = `${habit._id}_${date}`;
                    const status = logMap[key];
                    let dotColor;
                    if (isFuture || !status) {
                      dotColor = null; // use Tailwind class
                    } else if (status === 'done') {
                      dotColor = habit.colorHex || '#4F46E5';
                    } else {
                      dotColor = '#EF4444';
                    }

                    return (
                      <div
                        key={habit._id}
                        className={`w-2.5 h-2.5 rounded-full mx-auto ${
                          !dotColor ? 'bg-gray-200 dark:bg-gray-600' : ''
                        }`}
                        style={dotColor ? { backgroundColor: dotColor } : {}}
                        title={`${habit.name}: ${status || 'no log'}`}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        {/* Divider + Summary */}
        <div className="mt-4 pt-3 border-t border-gray-100 dark:border-gray-700">
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <span className="text-sm font-semibold text-green-600 dark:text-green-400">
              ✓ {doneToday} done today
            </span>
            <span className="text-sm font-semibold text-red-500 dark:text-red-400">
              ✕ {missedToday} missed today
            </span>
            <span className="text-sm font-medium text-gray-400 dark:text-gray-500">
              ○ {pendingToday} pending today
            </span>
          </div>

          {/* Best day this week */}
          {bestDay && (
            <p className="text-xs text-gray-500 dark:text-gray-400 text-center mt-2">
              🔥 Your best day this week: <span className="font-semibold">{bestDay}</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

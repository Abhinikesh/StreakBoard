import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

export default function HabitCard({ habit, todayStatus, allLogs = [], onLog, isUpdating }) {
  const navigate = useNavigate();

  // Calculate streak based on past logs
  const streak = useMemo(() => {
    if (!allLogs || !allLogs.length) return 0;
    const doneDates = new Set(allLogs.filter(l => l.status === 'done').map(l => l.date));
    let count = 0;
    
    const today = new Date();
    const yT = today.getFullYear();
    const mT = String(today.getMonth() + 1).padStart(2, '0');
    const dT = String(today.getDate()).padStart(2, '0');
    const todayStr = `${yT}-${mT}-${dT}`;

    // Include today if it's done
    if (doneDates.has(todayStr)) {
      count++;
    }

    // Go backwards starting from yesterday
    let curr = new Date(today);
    curr.setDate(curr.getDate() - 1);
    
    while (true) {
      const y = curr.getFullYear();
      const m = String(curr.getMonth() + 1).padStart(2, '0');
      const d = String(curr.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${d}`;

      if (doneDates.has(dateStr)) {
        count++;
        curr.setDate(curr.getDate() - 1);
      } else {
        break;
      }
    }
    return count;
  }, [allLogs]);

  return (
    <div 
      className="bg-white rounded-xl p-4 sm:px-6 flex items-center justify-between mb-3 shadow-[0_2px_8px_-3px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_16px_-6px_rgba(0,0,0,0.1)] transition-all duration-200 border border-gray-100"
      style={{ borderLeft: `6px solid ${habit.colorHex || '#4F46E5'}` }}
    >
      <div className="flex items-center gap-4">
        <div className="text-3xl bg-gray-50/80 rounded-full w-14 h-14 flex items-center justify-center shrink-0">
          {habit.icon || '🎯'}
        </div>
        <div>
          <h3 className="font-bold text-gray-900 text-lg sm:text-xl leading-tight mb-1">{habit.name}</h3>
          <p className="text-xs sm:text-sm text-gray-500 font-medium">
            {streak > 0 ? (
              <span className="flex items-center gap-1.5"><span className="text-base leading-none">🔥</span> {streak} day streak</span>
            ) : (
              'Start your streak!'
            )}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Tick Button */}
        <button
          onClick={() => onLog(habit._id, 'done')}
          disabled={isUpdating}
          className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center border-2 transition-all duration-200 disabled:opacity-50 ${
            todayStatus === 'done' 
              ? 'bg-green-500 border-green-500 text-white shadow-md shadow-green-500/20 scale-105' 
              : 'border-gray-200 text-gray-400 hover:border-green-500 hover:bg-green-50 hover:text-green-500 active:scale-95'
          }`}
          aria-label="Mark as done"
        >
          <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
          </svg>
        </button>

        {/* Cross Button */}
        <button
          onClick={() => onLog(habit._id, 'missed')}
          disabled={isUpdating}
          className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center border-2 transition-all duration-200 disabled:opacity-50 ${
            todayStatus === 'missed'
              ? 'bg-red-500 border-red-500 text-white shadow-md shadow-red-500/20 scale-105'
              : 'border-gray-200 text-gray-400 hover:border-red-500 hover:bg-red-50 hover:text-red-500 active:scale-95'
          }`}
          aria-label="Mark as missed"
        >
          <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"></path>
          </svg>
        </button>
        
        <div className="w-px h-8 bg-gray-200 mx-1 sm:mx-2 hidden sm:block"></div>

        {/* Calendar Button */}
        <button
          onClick={() => navigate(`/calendar?habit=${habit._id}`)}
          className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center text-gray-400 hover:bg-indigo-50 hover:text-indigo-600 transition-colors active:scale-95"
          aria-label="View calendar"
        >
          <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path>
          </svg>
        </button>
      </div>
    </div>
  );
}

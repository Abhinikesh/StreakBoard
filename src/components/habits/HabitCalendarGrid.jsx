import React from 'react';
import { getDaysInMonth, getTodayString } from '../../utils/dateUtils';
import { format, parseISO, isAfter, isBefore, startOfDay, addDays } from 'date-fns';

export default function HabitCalendarGrid({ habit, logs = [], currentMonth, onLog }) {
  // Build calendar matrix logic
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth() + 1; // 1-indexed for dateUtils
  
  // Date string formats
  const daysInMonthArray = getDaysInMonth(year, month);
  const todayStr = getTodayString();
  const todayObj = startOfDay(new Date());
  const pastLimitObj = addDays(todayObj, -7); // Allow retro-logging 7 days ago limit
  
  // Align grid (Offset for Mon-to-Sun)
  const firstDayOfMonth = new Date(year, currentMonth.getMonth(), 1);
  const firstDayOfWeek = firstDayOfMonth.getDay(); // 0: Sun, 1: Mon, ...
  const emptyCellsCount = firstDayOfWeek === 0 ? 6 : firstDayOfWeek - 1;
  const emptyCells = Array.from({ length: emptyCellsCount }).map((_, i) => ({ id: `empty-${i}` }));

  // Counters
  let doneCount = 0;
  let missedCount = 0;
  let remainingCount = 0;

  // Process cells explicitly mapped over backend results
  const cells = daysInMonthArray.map(dateStr => {
    // Both full logs objects or isolated logs array compat Check
    const log = logs.find(l => l.date === dateStr);
    const dayNumber = parseInt(dateStr.split('-')[2], 10);
    const cellDateObj = parseISO(dateStr);
    
    // Status states
    const isToday = dateStr === todayStr;
    const isFuture = isAfter(cellDateObj, todayObj);
    const isPast = isBefore(cellDateObj, todayObj);
    const isValidRetroactive = isPast && !isBefore(cellDateObj, pastLimitObj); // up to 7 days
    
    // Count stats sequentially
    if (isFuture) remainingCount++;
    else if (log?.status === 'done') doneCount++;
    else if (log?.status === 'missed') missedCount++;

    return {
      dateStr,
      dayNumber,
      status: log?.status || null,
      isToday,
      isFuture,
      isPast,
      isValidRetroactive,
    };
  });

  const validDaysInMonth = doneCount + missedCount;
  const rate = validDaysInMonth > 0 ? Math.round((doneCount / validDaysInMonth) * 100) : 0;

  return (
    <div className="bg-white rounded-3xl shadow-md shadow-gray-100/50 border border-gray-100 overflow-hidden transform-gpu">
      {/* Habit Calendar Header */}
      <div 
        className="p-5 sm:p-6 flex items-center gap-4 bg-gray-50/70 border-b border-gray-100/80"
        style={{ borderLeft: `6px solid ${habit.colorHex || '#4F46E5'}` }}
      >
        <div className="text-3xl sm:text-4xl bg-white shadow-sm w-14 h-14 sm:w-16 sm:h-16 rounded-full flex items-center justify-center shrink-0 border border-gray-50">
          {habit.icon || '🎯'}
        </div>
        <div>
          <h3 className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight">{habit.name}</h3>
          <p className="text-sm text-gray-500 font-medium">Monthly tracker & stats</p>
        </div>
      </div>
      
      {/* Grid Logic Wrapper */}
      <div className="p-4 sm:p-7">
        <div className="grid grid-cols-7 gap-1 sm:gap-2 mb-3">
          {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
            <div key={day} className="text-center text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-widest">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1.5 sm:gap-3">
          {emptyCells.map(cell => (
            <div key={cell.id} className="aspect-square bg-transparent"></div>
          ))}
          
          {cells.map(cell => {
            // Compute visual cell rules based rigidly on instructions 
            let bgClass = "bg-gray-50 border border-gray-100";
            let textClass = "text-gray-400";
            let ringClass = ""; // Animation wrapper
            
            // Pointer mapping
            const isClickBlocked = cell.isFuture || (!cell.isValidRetroactive && !cell.status && cell.isPast);
            const cursorClass = isClickBlocked 
              ? "cursor-default" 
              : "cursor-pointer active:scale-90 hover:shadow-sm hover:z-10 relative transition-transform duration-200 select-none";
            
            let content = null;
            
            if (cell.status === 'done') {
              bgClass = "bg-[#22C55E] shadow-sm shadow-green-500/20 shadow-inner";
              textClass = "text-white opacity-90";
              content = (
                <svg className="w-5 h-5 sm:w-8 sm:h-8 text-white absolute inset-0 m-auto filter drop-shadow-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path>
                </svg>
              );
            } else if (cell.status === 'missed') {
              bgClass = "bg-[#EF4444] shadow-sm shadow-red-500/20";
              textClass = "text-white opacity-90";
              content = (
                <svg className="w-5 h-5 sm:w-8 sm:h-8 text-white absolute inset-0 m-auto filter drop-shadow-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"></path>
                </svg>
              );
            } else if (cell.isToday) {
              bgClass = "bg-indigo-50/50 outline outline-2 outline-[#4F46E5] outline-offset-[-2px] border-transparent";
              textClass = "text-[#4F46E5] font-extrabold";
              ringClass = "animate-pulse shadow-[0_0_0_4px_rgba(79,70,229,0.15)]";
            } else if (cell.isFuture) {
              bgClass = "bg-gray-50/30 opacity-70";
              textClass = "text-gray-300";
            } else if (cell.isPast && cell.isValidRetroactive) {
              bgClass = "bg-gray-100 border border-gray-200 hover:bg-gray-200";
              textClass = "text-gray-500 font-bold";
            }

            const handleClick = () => {
              if (isClickBlocked) return;
              
              if (cell.status === 'done') onLog(habit._id, cell.dateStr, 'missed'); // Toggle to missed
              else if (cell.status === 'missed') onLog(habit._id, cell.dateStr, 'done'); // Toggle to done
              else onLog(habit._id, cell.dateStr, 'done'); // Default to done from unmarked state
            };

            return (
              <div 
                key={cell.dateStr} 
                onClick={handleClick}
                className={`relative aspect-square rounded-xl p-1.5 sm:p-2 sm:rounded-2xl transition-all ${bgClass} ${cursorClass} ${ringClass}`}
              >
                <span className={`absolute top-1 sm:top-1.5 left-1.5 sm:left-2 text-[10px] sm:text-xs font-semibold ${textClass}`}>
                  {cell.dayNumber}
                </span>
                {content}
              </div>
            )
          })}
        </div>
        
        {/* Statistics Bar footer overlay */}
        <div className="grid grid-cols-4 gap-2 sm:gap-4 mt-8 sm:mt-10">
          <div className="bg-green-50/50 rounded-2xl p-2 sm:p-3 text-center border border-green-100">
            <p className="text-[10px] sm:text-xs text-green-700 font-bold uppercase tracking-wider mb-0.5 sm:mb-1">Done</p>
            <p className="text-xl sm:text-3xl font-black text-green-600">{doneCount}</p>
          </div>
          <div className="bg-red-50/50 rounded-2xl p-2 sm:p-3 text-center border border-red-100">
            <p className="text-[10px] sm:text-xs text-red-700 font-bold uppercase tracking-wider mb-0.5 sm:mb-1">Missed</p>
            <p className="text-xl sm:text-3xl font-black text-red-600">{missedCount}</p>
          </div>
          <div className="bg-gray-50 rounded-2xl p-2 sm:p-3 text-center border border-gray-100">
            <p className="text-[10px] sm:text-xs text-gray-500 font-bold uppercase tracking-wider mb-0.5 sm:mb-1">Remain</p>
            <p className="text-xl sm:text-3xl font-black text-gray-600">{remainingCount}</p>
          </div>
          <div className="bg-indigo-50/50 rounded-2xl p-2 sm:p-3 text-center border border-indigo-100">
            <p className="text-[10px] sm:text-xs text-indigo-700 font-bold uppercase tracking-wider mb-0.5 sm:mb-1">Rate</p>
            <p className="text-xl sm:text-3xl font-black text-indigo-600">{rate}%</p>
          </div>
        </div>
      </div>
    </div>
  );
}

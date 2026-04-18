import React, { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../api/axios';
import Navbar from '../components/layout/Navbar';
import Spinner from '../components/ui/Spinner';
import { getTodayString } from '../utils/dateUtils';

// Helper: Streak calculations fully on frontend parsing ISO Strings
const calculateCurrentStreak = (logsObjArr) => {
  const doneDates = new Set(logsObjArr.filter(l => l.status === 'done').map(l => l.date));
  let streak = 0;
  
  const todayStr = getTodayString();
  const todayParts = todayStr.split('-').map(Number);
  const today = new Date(todayParts[0], todayParts[1] - 1, todayParts[2]);

  if (doneDates.has(todayStr)) {
    streak++;
  }

  let curr = new Date(today);
  curr.setDate(curr.getDate() - 1);
  
  while(true) {
    const y = curr.getFullYear();
    const m = String(curr.getMonth() + 1).padStart(2, '0');
    const d = String(curr.getDate()).padStart(2, '0');
    const dateStr = `${y}-${m}-${d}`;
    
    if (doneDates.has(dateStr)) {
      streak++;
      curr.setDate(curr.getDate() - 1);
    } else {
      break;
    }
  }
  return streak;
};

const calculateBestStreak = (logsObjArr) => {
  // Sort distinct matching valid dates securely
  const doneDates = Array.from(new Set(logsObjArr.filter(l => l.status === 'done').map(l => l.date))).sort();
  if (doneDates.length === 0) return 0;
  
  let best = 1;
  let current = 1;
  
  for (let i = 1; i < doneDates.length; i++) {
    const pParts = doneDates[i-1].split('-');
    const cParts = doneDates[i].split('-');
    const prev = new Date(pParts[0], pParts[1]-1, pParts[2], 12, 0, 0); // Noon bounds daylight savings skips
    const curr = new Date(cParts[0], cParts[1]-1, cParts[2], 12, 0, 0);
    
    const diffDays = Math.round(Math.abs(curr - prev) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
      current++;
    } else if (diffDays > 1) {
      if (current > best) best = current;
      current = 1; // Reset chain gap sequence
    }
  }
  if (current > best) best = current;
  return best;
};

const getCompletionRate = (logsObjArr, monthStrPrefix) => {
  const monthLogs = logsObjArr.filter(l => l.date.startsWith(monthStrPrefix));
  const validLogs = monthLogs.filter(l => l.status === 'done' || l.status === 'missed');
  
  if (validLogs.length === 0) return 0; // Prevent 0/0 exceptions
  
  const doneCount = validLogs.filter(l => l.status === 'done').length;
  return Number(((doneCount / validLogs.length) * 100).toFixed(1));
};

export default function StatsPage() {
  const todayStr = getTodayString();
  const currentMonthStr = todayStr.substring(0, 7);

  // Queries
  const { data: habitsData = [], isLoading: habitsLoading } = useQuery({
    queryKey: ['habits'],
    queryFn: async () => {
      const res = await api.get('/api/habits');
      return res.data.habits || res.data || [];
    }
  });

  const { data: logsData = [], isLoading: logsLoading } = useQuery({
    queryKey: ['logs'],
    queryFn: async () => {
      const res = await api.get('/api/logs/all');
      return res.data.logs || res.data || [];
    }
  });

  const isLoading = habitsLoading || logsLoading;
  
  // Normalized arrays
  const habits = Array.isArray(habitsData) ? habitsData : [];
  const logs = Array.isArray(logsData) ? logsData : [];

  // Memorized Statistics Matrix Computation Logic
  const statsMapping = useMemo(() => {
    if (isLoading) return null;
    
    // Summary Cards math
    const totalHabits = habits.length;
    
    const globalDoneDates = new Set();
    let totalDoneAllTime = 0;
    let totalValidResolvedLogs = 0;
    let globalBestStreak = 0;

    // Heatmap / Dates map structure computation
    const datesMap = {}; // tracks how many habit were done on 'YYYY-MM-DD'
    const bestDaysCountsArray = [0, 0, 0, 0, 0, 0, 0]; // Mon = 0 to Sun = 6

    logs.forEach(log => {
      if (log.status === 'done' || log.status === 'missed') {
        totalValidResolvedLogs++;
        if (log.status === 'done') {
          totalDoneAllTime++;
          globalDoneDates.add(log.date);
          datesMap[log.date] = (datesMap[log.date] || 0) + 1;
          
          // Best Days chart mapping offsets (0 = Mon, 6 = Sun)
          const parts = log.date.split('-');
          const tempDate = new Date(parts[0], parts[1]-1, parts[2], 12, 0, 0);
          const dayIndex = tempDate.getDay();
          const shiftedIndex = dayIndex === 0 ? 6 : dayIndex - 1; 
          bestDaysCountsArray[shiftedIndex]++;
        }
      }
    });

    const activeUniqueDays = globalDoneDates.size;
    const overallRate = totalValidResolvedLogs > 0 ? Math.round((totalDoneAllTime / totalValidResolvedLogs) * 100) : 0;

    // Per habit arrays mapping computation loop 
    const analyzedHabits = habits.map(habit => {
      const habitKey = habit._id;
      const hLogs = logs.filter(l => l.habit === habitKey || l.habitId === habitKey);
      
      const currentStreak = calculateCurrentStreak(hLogs);
      const bestStreak = calculateBestStreak(hLogs);
      const monthRate = getCompletionRate(hLogs, currentMonthStr);
      const totalHabitDone = hLogs.filter(l => l.status === 'done').length;

      if (bestStreak > globalBestStreak) {
        globalBestStreak = bestStreak;
      }

      return {
        ...habit,
        currentStreak,
        bestStreak,
        monthRate,
        totalHabitDone
      };
    }).sort((a, b) => b.monthRate - a.monthRate); // Highest rate DESC

    return {
      totalHabits,
      overallRate,
      activeUniqueDays,
      globalBestStreak,
      analyzedHabits,
      bestDaysCountsArray,
      datesMap,
    };
  }, [habits, logs, isLoading, currentMonthStr]);

  if (isLoading || !statsMapping) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex h-[80vh] items-center justify-center">
          <Spinner size="lg" />
        </div>
      </div>
    );
  }

  // Destruction state context mapping hook array results
  const { totalHabits, overallRate, activeUniqueDays, globalBestStreak, analyzedHabits, bestDaysCountsArray, datesMap } = statsMapping;

  // Empty View Catch Check block execution
  if (totalHabits === 0 || logs.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 pb-24">
        <Navbar />
        <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-10">
          <h1 className="text-4xl sm:text-5xl font-extrabold text-gray-900 mb-2">Your Stats</h1>
          <p className="text-gray-500 font-medium text-lg mb-10">Track your progress and see where you shine</p>
          <div className="bg-white border-2 border-dashed border-gray-200 rounded-3xl py-24 flex flex-col items-center shadow-sm">
            <span className="text-6xl mb-4 grayscale opacity-50">📊</span>
            <p className="text-xl font-bold text-gray-600">Start tracking habits to see your stats here</p>
          </div>
        </div>
      </div>
    );
  }

  // --- Rendering UI Construction Tree Modules Helpers ---

  // Highest Best Days calculation graph map block scope
  const maxDayCount = Math.max(...bestDaysCountsArray) || 1;
  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  // Heat map rendering nested component constructor map logic
  const renderHeatmap = () => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 relative is Sun
    const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
    const endDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + daysUntilSunday, 12, 0, 0);
    const startDay = new Date(endDay.getFullYear(), endDay.getMonth(), endDay.getDate() - 83, 12, 0, 0);

    const columns = [];
    let curr = new Date(startDay);

    for (let c = 0; c < 12; c++) {
      const colCells = [];
      for (let r = 0; r < 7; r++) {
        const y = curr.getFullYear();
        const m = String(curr.getMonth() + 1).padStart(2, '0');
        const d = String(curr.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${d}`;
        
        const doneCount = datesMap[dateStr] || 0;
        let bgColor = "#E5E7EB"; // 0
        if (doneCount >= 5) bgColor = "#3730A3";
        else if (doneCount >= 3) bgColor = "#6366F1";
        else if (doneCount >= 1) bgColor = "#A5B4FC";
        
        // Exclude / blur out logical future dates beyond relative client boundary tracking limits
        if (curr > new Date()) bgColor = "#F3F4F6";

        colCells.push(
          <div 
            key={dateStr}
            className="w-[12px] h-[12px] sm:w-[14px] sm:h-[14px] rounded-[3px] transition-colors hover:brightness-90"
            style={{ backgroundColor: bgColor }}
            title={`${dateStr}: ${doneCount} done`}
          ></div>
        );
        curr.setDate(curr.getDate() + 1);
      }
      columns.push(
        <div key={c} className="flex flex-col gap-[2px] sm:gap-[3px]">
          {colCells}
        </div>
      );
    }

    const rowShortLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 overscroll-x-contain">
        <h3 className="font-bold text-lg text-gray-900 mb-6">Activity in last 12 weeks</h3>
        <div className="flex gap-[2px] sm:gap-[3px]">
          {/* Axis rendering loop */}
          <div className="flex flex-col gap-[2px] sm:gap-[3px] pr-2 items-end justify-between py-px">
            {rowShortLabels.map((l, i) => (
              <span key={i} className="text-[10px] leading-[12px] sm:text-xs sm:leading-[14px] font-bold text-gray-400 h-[12px] sm:h-[14px] w-3 text-right">
                {i % 2 === 0 ? l : ''}
              </span>
            ))}
          </div>
          <div className="flex gap-[2px] sm:gap-[3px] overflow-x-auto pb-2 no-scrollbar">
            {columns}
          </div>
        </div>
        
        <div className="flex items-center justify-end gap-2 mt-4 text-[11px] font-medium text-gray-500">
          <span>Less</span>
          <div className="w-[12px] h-[12px] rounded-[2px] bg-[#E5E7EB]"></div>
          <div className="w-[12px] h-[12px] rounded-[2px] bg-[#A5B4FC]"></div>
          <div className="w-[12px] h-[12px] rounded-[2px] bg-[#6366F1]"></div>
          <div className="w-[12px] h-[12px] rounded-[2px] bg-[#3730A3]"></div>
          <span>More</span>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      <Navbar />
      
      <main className="max-w-5xl mx-auto px-4 sm:px-6 pt-10">
        
        <div className="mb-10">
          <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 tracking-tight">Your Stats</h1>
          <p className="text-gray-500 font-medium text-lg mt-2">Track your progress and see where you shine</p>
        </div>

        <div className="space-y-[4rem]">
          
          {/* Section 1 - Top Summary Cards Overlay */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-6 tracking-tight">Overview</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
              
              {/* Card - Total Habits */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col items-center text-center">
                <div className="w-12 h-12 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center text-2xl mb-4">🎯</div>
                <div className="text-3xl sm:text-4xl font-black text-gray-900 mb-1">{totalHabits}</div>
                <div className="text-xs sm:text-sm font-bold text-gray-500 uppercase tracking-wide">Total Habits</div>
              </div>
              
              {/* Card - Best Streak */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col items-center text-center">
                <div className="w-12 h-12 bg-amber-50 text-amber-500 rounded-full flex items-center justify-center text-2xl mb-4">🔥</div>
                <div className="text-3xl sm:text-4xl font-black text-gray-900 mb-1">{globalBestStreak}</div>
                <div className="text-xs sm:text-sm font-bold text-gray-500 uppercase tracking-wide">Best Streak</div>
              </div>

              {/* Card - Overall Rate */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col items-center text-center">
                <div className="w-12 h-12 bg-green-50 text-green-500 rounded-full flex items-center justify-center text-2xl mb-4">📊</div>
                <div className="text-3xl sm:text-4xl font-black text-gray-900 mb-1">{overallRate}%</div>
                <div className="text-xs sm:text-sm font-bold text-gray-500 uppercase tracking-wide">Overall Rate</div>
              </div>

              {/* Card - Active Days */}
              <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col items-center text-center">
                <div className="w-12 h-12 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center text-2xl mb-4">📅</div>
                <div className="text-3xl sm:text-4xl font-black text-gray-900 mb-1">{activeUniqueDays}</div>
                <div className="text-xs sm:text-sm font-bold text-gray-500 uppercase tracking-wide">Active Days</div>
              </div>

            </div>
          </section>

          {/* Section 2 - Habit Breakdowns Mapping Render Block */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-6 tracking-tight">Habit Breakdown</h2>
            <div className="space-y-4">
              {analyzedHabits.map((hMap) => (
                <div 
                  key={hMap._id} 
                  className="bg-white rounded-2xl p-5 sm:p-6 shadow-sm border border-gray-100 flex flex-col sm:flex-row gap-6 sm:items-center sm:justify-between"
                  style={{ borderLeft: `6px solid ${hMap.colorHex || '#4F46E5'}` }}
                >
                  
                  {/* Left Side: Identifiers + Progress Bar Flex Column Isolation */}
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-2xl">{hMap.icon}</span>
                      <span className="text-lg font-bold text-gray-900">{hMap.name}</span>
                    </div>
                    {/* Horizontal Bar Mapping Month Rate Math Limit constraints block */}
                    <div className="space-y-2 max-w-sm">
                      <div className="flex justify-between text-xs font-semibold text-gray-500">
                        <span>This Month Completion</span>
                        <span style={{ color: hMap.colorHex || '#4F46E5' }}>{hMap.monthRate}%</span>
                      </div>
                      <div className="h-2.5 w-full bg-gray-100 rounded-full overflow-hidden">
                        <div 
                          className="h-full rounded-full transition-all duration-1000 ease-out" 
                          style={{ width: `${hMap.monthRate}%`, backgroundColor: hMap.colorHex || '#4F46E5' }}
                        ></div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Right Side: Text Statistic Grid Columns mapped UI */}
                  <div className="grid grid-cols-2 sm:flex sm:flex-row items-center gap-4 sm:gap-8 bg-gray-50/50 p-4 rounded-xl border border-gray-50">
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Current</span>
                      <span className="text-xl font-black text-gray-900">{hMap.currentStreak} 🔥</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Best</span>
                      <span className="text-xl font-black text-gray-900">{hMap.bestStreak} 🏆</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Month</span>
                      <span className="text-xl font-black text-gray-900">{hMap.monthRate}%</span>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total</span>
                      <span className="text-xl font-black text-gray-900">{hMap.totalHabitDone} ✓</span>
                    </div>
                  </div>

                </div>
              ))}
            </div>
          </section>

          {/* Section 3 - Virtual Custom Div Bar Chart Mapping Math Component View */}
          <section>
            <h2 className="text-2xl font-bold text-gray-900 mb-6 tracking-tight">Your best days</h2>
            <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-sm border border-gray-100 overflow-x-auto">
              {/* Flex Grid Bar Structure Base Constraint bounds */}
              <div className="flex items-end justify-between sm:justify-around gap-2 h-48 sm:h-56 min-w-[300px] mt-4 border-b border-gray-100 pb-2">
                {bestDaysCountsArray.map((count, idx) => {
                  const isMax = count === maxDayCount && count > 0; // Filter zeroes
                  const percentage = (count / maxDayCount) * 100;
                  
                  return (
                    <div key={idx} className="flex flex-col items-center gap-3 w-10 sm:w-16 group relative pb-2">
                      {/* Tooltip Hover Overlay Math Label Value String Check Output Constraint Context Map Node Element */}
                      <span className="text-xs sm:text-sm font-bold text-gray-600 transition-opacity">
                        {count}
                      </span>
                      
                      {/* Bar Fill Calculation Block */}
                      <div 
                        className={`w-8 sm:w-12 rounded-t-lg transition-all duration-700 hover:brightness-110 ${isMax ? 'bg-green-500 shadow-[0_-4px_14px_-2px_rgba(34,197,94,0.3)]' : 'bg-indigo-500 opacity-80 shadow-[0_-4px_14px_-2px_rgba(79,70,229,0.3)]'}`}
                        style={{ height: `${percentage === 0 ? 5 : percentage}%` }}
                      ></div>
                      
                      {/* Week Label Absolute Offset Structure Positioning */}
                      <span className="absolute -bottom-7 sm:-bottom-8 text-xs font-bold text-gray-400 uppercase">
                        {dayLabels[idx]}
                      </span>
                    </div>
                  );
                })}
              </div>
              <div className="h-8"></div> {/* Bottom margin spacing element block offset */}
            </div>
          </section>

          {/* Section 4 - Final Heatmap Component Injection Layout Block Setup */}
          <section>
            {renderHeatmap()}
          </section>

        </div>
      </main>
    </div>
  );
}

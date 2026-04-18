import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import api from '../api/axios';
import Navbar from '../components/layout/Navbar';
import HabitCalendarGrid from '../components/habits/HabitCalendarGrid';
import { getMonthString } from '../utils/dateUtils';
import Spinner from '../components/ui/Spinner';

export default function CalendarPage() {
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  
  // States
  const [selectedHabitId, setSelectedHabitId] = useState(searchParams.get('habit') || null);
  const [currentMonth, setCurrentMonth] = useState(() => new Date());

  // Handle URL syncing auto-selection securely on mount mapping
  useEffect(() => {
    const habitParam = searchParams.get('habit');
    if (habitParam && !selectedHabitId) {
      setSelectedHabitId(habitParam);
    }
  }, [searchParams, selectedHabitId]);

  const handleSelectHabit = (id) => {
    setSelectedHabitId(id);
    setSearchParams({ habit: id });
  };

  // Queries - Habits
  const { data: habitsData = [], isLoading: habitsLoading } = useQuery({
    queryKey: ['habits'],
    queryFn: async () => {
      const res = await api.get('/api/habits');
      return res.data.habits || res.data || [];
    }
  });
  
  const habits = Array.isArray(habitsData) ? habitsData : [];

  // Queries - Logs for specific selected habit + month
  const monthStr = getMonthString(currentMonth);
  const { data: logsData = [], isLoading: logsLoading } = useQuery({
    queryKey: ['logs', selectedHabitId, monthStr],
    queryFn: async () => {
      const res = await api.get(`/api/logs/${selectedHabitId}?month=${monthStr}`);
      return res.data.logs || res.data || [];
    },
    enabled: !!selectedHabitId // Skip fetch if nothing tracked
  });
  
  const logs = Array.isArray(logsData) ? logsData : [];

  // Mutation - Optimistic Logs updates
  const logMut = useMutation({
    mutationFn: async ({ habitId, date, status }) => {
      return api.post('/api/logs', { habitId, date, status });
    },
    onMutate: async ({ habitId, date, status }) => {
      const queryKey = ['logs', selectedHabitId, monthStr];
      // Cancel outgoing fetches ensuring they don't overwrite optimistic map
      await queryClient.cancelQueries({ queryKey });
      
      const previousLogs = queryClient.getQueryData(queryKey) || [];
      
      // Optimistically update to the new value mapping payload 
      queryClient.setQueryData(queryKey, old => {
        if (!old) return [{ habitId, date, status }];
        const existing = old.find(l => l.date === date);
        if (existing) {
          return old.map(l => l.date === date ? { ...l, status } : l);
        }
        return [...old, { habitId, date, status }];
      });
      
      // Snapshot return context
      return { previousLogs, queryKey };
    },
    onError: (err, newLog, context) => {
      queryClient.setQueryData(context.queryKey, context.previousLogs);
      toast.error(err.response?.data?.message || 'Failed to sync log.');
    },
    onSettled: () => {
      // Background re-fetch to ensure sync truth
      queryClient.invalidateQueries({ queryKey: ['logs', selectedHabitId, monthStr] });
    }
  });

  const handleLog = (habitId, date, status) => {
    logMut.mutate({ habitId, date, status });
  };

  // Month Math
  const today = new Date();
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth();
  
  // Disabling the Next button dynamically
  const canGoNext = currentMonth.getFullYear() < todayYear || 
                   (currentMonth.getFullYear() === todayYear && currentMonth.getMonth() < todayMonth);

  const prevMonth = () => setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  const nextMonth = () => {
    if (canGoNext) setCurrentMonth(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  };

  const selectedHabitObj = habits.find(h => h._id === selectedHabitId);

  return (
    <div className="min-h-screen bg-gray-50 pb-24 font-sans">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-10">
        <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 tracking-tight mb-8">Calendar</h1>

        {/* Loading Shell Header */}
        {habitsLoading ? (
          <div className="flex justify-center py-6">
            <Spinner size="md" />
          </div>
        ) : habits.length === 0 ? (
          <div className="bg-white p-8 rounded-2xl text-center border border-gray-200">
            <p className="text-gray-500 font-medium">You don't have any habits yet. Start by adding one from the Dashboard!</p>
          </div>
        ) : (
          <div className="space-y-10">
            
            {/* Scrollable Selector Pills */}
            <div className="flex overflow-x-auto pb-4 gap-3 snap-x no-scrollbar w-full">
              {habits.map(habit => {
                const isSelected = habit._id === selectedHabitId;
                return (
                  <button
                    key={habit._id}
                    onClick={() => handleSelectHabit(habit._id)}
                    className={`shrink-0 flex items-center gap-2.5 px-5 py-3 rounded-full font-bold shadow-sm transition-all duration-200 snap-center focus:outline-none focus:ring-2 focus:ring-offset-2 hover:-translate-y-0.5
                      ${isSelected 
                        ? 'text-white scale-105 outline-none' 
                        : 'bg-white text-gray-700 border-2 active:scale-95'
                      }`}
                    style={
                      isSelected 
                        ? { backgroundColor: habit.colorHex || '#4F46E5', boxShadow: `0 4px 14px 0 ${habit.colorHex || '#4F46E5'}40` }
                        : { borderColor: habit.colorHex || '#4F46E5' }
                    }
                  >
                    <span className="text-lg leading-none filter drop-shadow-sm">{habit.icon}</span>
                    <span className="whitespace-nowrap font-semibold tracking-wide">{habit.name}</span>
                  </button>
                );
              })}
            </div>

            {/* Main Visual Calendar Surface Setup */}
            {selectedHabitId ? (
              <div className="space-y-6">
                
                {/* Month Navigation Console */}
                <div className="flex items-center justify-between bg-white px-6 py-4 rounded-2xl shadow-sm border border-gray-100 max-w-sm mx-auto">
                  <button
                    onClick={prevMonth}
                    className="p-2 -ml-2 rounded-full hover:bg-gray-100 text-gray-600 transition-colors focus:outline-none focus:bg-gray-100"
                    aria-label="Previous month"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M15 19l-7-7 7-7"></path></svg>
                  </button>
                  
                  <span className="text-xl font-bold text-gray-900 tabular-nums tracking-wide">
                    {format(currentMonth, 'MMMM yyyy')}
                  </span>
                  
                  <button
                    onClick={nextMonth}
                    disabled={!canGoNext}
                    className={`p-2 -mr-2 rounded-full transition-colors focus:outline-none focus:bg-gray-100 ${
                      !canGoNext ? 'text-gray-300 cursor-not-allowed opacity-50' : 'hover:bg-gray-100 text-gray-600'
                    }`}
                    aria-label="Next month"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 5l7 7-7 7"></path></svg>
                  </button>
                </div>

                {/* Sub-loading isolation rendering */}
                {logsLoading ? (
                  <div className="h-96 flex items-center justify-center bg-white/50 rounded-3xl border border-gray-100">
                    <Spinner size="lg" />
                  </div>
                ) : (
                  selectedHabitObj && (
                    <HabitCalendarGrid 
                      habit={selectedHabitObj}
                      logs={logs}
                      currentMonth={currentMonth}
                      onLog={handleLog}
                    />
                  )
                )}
              </div>
            ) : (
              // Empty selection mapping layout
              <div className="flex flex-col items-center justify-center py-20 px-4 bg-white/60 backdrop-blur-sm rounded-3xl border border-dashed border-gray-200">
                <div className="text-6xl mb-6 bg-indigo-50/50 w-24 h-24 rounded-full flex items-center justify-center rotate-12 drop-shadow-sm">📅</div>
                <h3 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2">Calendar Explorer</h3>
                <p className="text-gray-500 font-medium text-center">
                  Select a habit from the dynamic selector above<br className="hidden sm:block"/> to view its full calendar graph.
                </p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

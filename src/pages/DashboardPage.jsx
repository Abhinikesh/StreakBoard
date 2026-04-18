import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import api from '../../api/axios';
import Navbar from '../layout/Navbar';
import HabitCard from '../habits/HabitCard';
import { getTodayString } from '../../utils/dateUtils';
import { useAuth } from '../../context/AuthContext';

export default function DashboardPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loadingHabitId, setLoadingHabitId] = useState(null);

  // Add Habit Modal State
  const [habitName, setHabitName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState('💪');
  const [selectedColor, setSelectedColor] = useState('#4F46E5');
  const [trackingPeriod, setTrackingPeriod] = useState(30);

  const icons = ['💪', '📚', '🧘', '🏃', '💧', '🥗', '😴', '✍️', '🎯', '🎸', '🧹', '💊'];
  const colors = [
    { name: 'indigo', hex: '#4F46E5' },
    { name: 'green', hex: '#22C55E' },
    { name: 'amber', hex: '#F59E0B' },
    { name: 'red', hex: '#EF4444' },
    { name: 'pink', hex: '#EC4899' },
    { name: 'teal', hex: '#14B8A6' },
  ];

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

  // Mutations
  const addHabitMut = useMutation({
    mutationFn: async (newHabit) => {
      return api.post('/api/habits', newHabit);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['habits'] });
      setIsModalOpen(false);
      setHabitName('');
      setSelectedIcon('💪');
      setSelectedColor('#4F46E5');
      setTrackingPeriod(30);
      toast.success('Habit added!');
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to create habit.');
    }
  });

  const logMut = useMutation({
    mutationFn: async ({ habitId, date, status }) => {
      return api.post('/api/logs', { habitId, date, status });
    },
    onMutate: (variables) => {
      setLoadingHabitId(variables.habitId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['logs'] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to update log.');
    },
    onSettled: () => {
      setLoadingHabitId(null);
    }
  });

  // Event Handlers
  const handleAddHabit = (e) => {
    e.preventDefault();
    if (!habitName.trim()) {
      toast.error('Habit name is required');
      return;
    }
    addHabitMut.mutate({
      name: habitName,
      icon: selectedIcon,
      colorHex: selectedColor,
      trackingPeriod
    });
  };

  const handleLog = (habitId, status) => {
    logMut.mutate({ habitId, date: getTodayString(), status });
  };

  // Computations
  const habits = Array.isArray(habitsData) ? habitsData : [];
  const logs = Array.isArray(logsData) ? logsData : [];
  
  const todayStr = getTodayString();
  const dateDisplay = format(new Date(), 'EEEE, MMMM d');

  const hour = new Date().getHours();
  let greeting = 'Good evening';
  if (hour < 12) greeting = 'Good morning';
  else if (hour < 17) greeting = 'Good afternoon';

  const completedTodayCount = habits.filter(h => {
    // If backend uses "habit" string check, otherwise "habitId" property
    const habitKey = h._id; 
    const log = logs.find(l => (l.habit === habitKey || l.habitId === habitKey) && l.date === todayStr);
    return log?.status === 'done';
  }).length;
  
  const totalHabits = habits.length;
  // Calculate percentage dynamically
  const progressPercent = totalHabits > 0 ? Math.round((completedTodayCount / totalHabits) * 100) : 0;
  const isLoading = habitsLoading || logsLoading;

  return (
    <div className="min-h-screen bg-gray-50/50 pb-24">
      <Navbar /> {/* Assumed existing per prompt */}
      
      <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-10">
        
        {/* Header Section */}
        <header className="mb-10">
          <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 tracking-tight">Today</h1>
          <p className="text-gray-500 font-medium mt-1 text-lg">{dateDisplay}</p>
          <p className="text-indigo-600 font-semibold mt-6 text-xl">
            {greeting}, {user?.firstName || user?.name?.split(' ')[0] || 'User'}!
          </p>
        </header>

        {/* Progress Bar View */}
        {!isLoading && totalHabits > 0 && (
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-gray-100 mb-8 border-b-4 border-b-gray-100">
            <div className="flex justify-between items-end mb-3">
              <span className="text-sm font-bold text-gray-500 uppercase tracking-wider">Daily Progress</span>
              <span className="text-indigo-600 font-bold text-lg">{completedTodayCount} of {totalHabits} done</span>
            </div>
            <div className="h-4 bg-gray-100/80 rounded-full overflow-hidden w-full relative">
              <div 
                className="h-full bg-indigo-500 transition-all duration-700 ease-out absolute left-0 top-0 bottom-0 rounded-full"
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
          </div>
        )}

        {/* Habit Listing or Loading / Empty States */}
        {isLoading ? (
          <div className="flex justify-center items-center py-20 mt-10">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-200 border-t-indigo-600"></div>
          </div>
        ) : (
          <div className="space-y-4">
            {totalHabits === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-4 bg-white rounded-3xl border-2 border-dashed border-gray-200 shadow-sm mt-8">
                <div className="text-7xl mb-4 bg-indigo-50 w-24 h-24 rounded-full flex items-center justify-center shrink-0">🌱</div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2 mt-2">No habits yet</h3>
                <p className="text-gray-500 text-center mb-10 max-w-sm text-base leading-relaxed">
                  Add your first habit to start building your discipline and tracking your daily progress.
                </p>
                <div className="relative animate-bounce text-indigo-400">
                  <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3"></path>
                  </svg>
                </div>
              </div>
            ) : (
              habits.map(habit => {
                const habitKey = habit._id;
                const todayLog = logs.find(l => (l.habit === habitKey || l.habitId === habitKey) && l.date === todayStr);
                const habitLogs = logs.filter(l => l.habit === habitKey || l.habitId === habitKey);

                return (
                  <HabitCard 
                    key={habitKey} 
                    habit={habit}
                    todayStatus={todayLog?.status || null}
                    allLogs={habitLogs}
                    onLog={handleLog}
                    isUpdating={loadingHabitId === habitKey}
                  />
                );
              })
            )}
          </div>
        )}
      </main>

      {/* Floating Action Button (+) */}
      <button 
        onClick={() => setIsModalOpen(true)}
        className="fixed bottom-8 right-8 md:bottom-12 md:right-12 w-16 h-16 bg-indigo-600 text-white rounded-full flex items-center justify-center shadow-xl shadow-indigo-600/30 hover:bg-indigo-700 hover:scale-105 active:scale-95 transition-all focus:outline-none focus:ring-4 focus:ring-indigo-300 z-40 group"
        aria-label="Add New Habit"
      >
        <svg className="w-8 h-8 group-hover:rotate-90 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4"></path>
        </svg>
      </button>

      {/* Add Habit Modal Overlay */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pt-4 pb-0 sm:p-4">
          <div 
            className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm transition-opacity" 
            onClick={() => setIsModalOpen(false)}
          ></div>
          <div className="bg-white rounded-t-3xl sm:rounded-3xl w-full max-w-md p-6 sm:p-8 relative z-10 shadow-2xl animate-in fade-in slide-in-from-bottom-8 sm:zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            
            <button 
              onClick={() => setIsModalOpen(false)}
              className="absolute top-5 right-5 text-gray-400 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-full w-9 h-9 flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-gray-300"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12"></path>
              </svg>
            </button>
            
            <h2 className="text-2xl font-bold text-gray-900 mb-6 tracking-tight pr-8">Create New Habit</h2>
            
            <form onSubmit={handleAddHabit} className="space-y-6">
              
              {/* Name Input */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Habit Name <span className="text-red-500">*</span></label>
                <input 
                  type="text" 
                  autoFocus
                  required
                  value={habitName}
                  onChange={(e) => setHabitName(e.target.value)}
                  placeholder="e.g., Read 10 pages, Meditate"
                  className="w-full px-4 py-3.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600 bg-white shadow-sm text-gray-900 text-base"
                />
              </div>

              {/* Icon Picker */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Icon</label>
                <div className="grid grid-cols-6 gap-2 sm:gap-3">
                  {icons.map(icon => (
                    <button
                      key={icon}
                      type="button"
                      onClick={() => setSelectedIcon(icon)}
                      className={`text-2xl sm:text-3xl aspect-square rounded-xl flex items-center justify-center transition-all duration-200 ${
                        selectedIcon === icon 
                          ? 'bg-indigo-100 scale-110 shadow-sm border border-indigo-200' 
                          : 'bg-gray-50 border border-transparent hover:bg-gray-100'
                      }`}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color Picker */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Theme Color</label>
                <div className="flex gap-4 sm:gap-5 justify-between px-1">
                  {colors.map(color => (
                    <button
                      key={color.hex}
                      type="button"
                      onClick={() => setSelectedColor(color.hex)}
                      className={`w-10 h-10 sm:w-11 sm:h-11 outline outline-offset-2 transition-transform duration-200 rounded-full flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-offset-2 ${
                        selectedColor === color.hex ? 'scale-110 outline text-white relative z-10' : 'outline-transparent hover:scale-105'
                      }`}
                      style={{ 
                        backgroundColor: color.hex, 
                        outlineColor: selectedColor === color.hex ? color.hex : 'transparent' 
                      }}
                      aria-label={`Select ${color.name} color`}
                    >
                      {selectedColor === color.hex && (
                        <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3.5" d="M5 13l4 4L19 7"></path>
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tracking Period */}
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Goal Tracking Period</label>
                <div className="flex gap-2 bg-gray-100/80 p-1.5 rounded-xl border border-gray-200/60">
                  {[30, 60, 90].map(days => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => setTrackingPeriod(days)}
                      className={`flex-1 py-2.5 text-sm font-bold rounded-lg transition-all duration-200 ${
                        trackingPeriod === days 
                          ? 'bg-white text-indigo-700 shadow-sm border border-gray-200/50' 
                          : 'text-gray-500 hover:text-gray-900 hover:bg-gray-200/50 border border-transparent'
                      }`}
                    >
                      {days} days
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit Action */}
              <button
                type="submit"
                disabled={addHabitMut.isPending}
                className="w-full bg-indigo-600 text-white font-bold rounded-xl py-4 mt-2 hover:bg-indigo-700 transition-all shadow-md shadow-indigo-600/20 disabled:opacity-75 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-lg active:scale-[0.98]"
              >
                {addHabitMut.isPending ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Creating...
                  </>
                ) : 'Add Habit'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

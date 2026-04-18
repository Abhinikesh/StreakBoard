import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import api from '../api/axios';
import Navbar from '../components/layout/Navbar';
import HabitCard from '../components/habits/HabitCard';
import AddHabitModal from '../components/habits/AddHabitModal';
import { getTodayString } from '../utils/dateUtils';
import { useAuth } from '../context/AuthContext';

export default function DashboardPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loadingHabitId, setLoadingHabitId] = useState(null);

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

  // Mapped out isolated modal state logic externally

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

      {/* Extracted Add Habit Modal rendering context logic map */}
      <AddHabitModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        defaultTrackingPeriod={Number(localStorage.getItem('defaultTrackingPeriod')) || 30}
      />
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import api from '../api/axios';
import Navbar from '../components/layout/Navbar';
import HabitCard from '../components/habits/HabitCard';
import AddHabitModal from '../components/habits/AddHabitModal';
import WeeklyView from '../components/habits/WeeklyView';
import StreakCelebrationModal from '../components/habits/StreakCelebrationModal';
import { getTodayString } from '../utils/dateUtils';
import { useAuth } from '../context/AuthContext';
import { playDoneSound, playMissedSound, playAllDoneSound } from '../utils/soundEffects';
import { fireConfetti, fireSmallConfetti } from '../utils/confettiEffect';

export default function DashboardPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loadingHabitId, setLoadingHabitId] = useState(null);
  const [celebrationHabit, setCelebrationHabit] = useState(null);

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

  const logMut = useMutation({
    mutationFn: async ({ habitId, date, status }) => api.post('/api/logs', { habitId, date, status }),
    onMutate: (variables) => setLoadingHabitId(variables.habitId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['logs'] });

      // Sound
      if (variables.status === 'done') {
        playDoneSound();
      } else {
        playMissedSound();
      }

      // Check all-done after refetch
      setTimeout(() => {
        const todayStr = getTodayString();
        const allHabits = queryClient.getQueryData(['habits']) || [];
        const allLogs = queryClient.getQueryData(['logs']) || [];
        const todayDone = allLogs.filter(l => l.date === todayStr && l.status === 'done');
        const doneIds = todayDone.map(l => (l.habit || l.habitId)?.toString());
        const allIds = allHabits.map(h => h._id?.toString());
        const allCompleted = allIds.length > 0 && allIds.every(id => doneIds.includes(id));

        if (allCompleted && variables.status === 'done') {
          setTimeout(() => {
            playAllDoneSound();
            fireConfetti();
            toast.success('🎉 All habits done today! Amazing!', {
              style: { background: '#4F46E5', color: 'white', fontWeight: '600' },
              duration: 4000,
            });
          }, 200);
        } else if (variables.status === 'done') {
          fireSmallConfetti();
          toast.success('🔥 Streak marked! Keep it up!', {
            style: { background: '#22C55E', color: 'white', fontWeight: '600' },
            duration: 2500, position: 'top-center',
          });
        } else {
          toast('Noted. Come back stronger tomorrow 💪', {
            style: { background: '#6B7280', color: 'white', fontWeight: '500' },
            duration: 2000, position: 'top-center',
          });
        }
      }, 400);
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to update log.'),
    onSettled: () => setLoadingHabitId(null),
  });

  const handleLog = (habitId, status) => logMut.mutate({ habitId, date: getTodayString(), status });

  const habits = Array.isArray(habitsData) ? habitsData : [];
  const logs = Array.isArray(logsData) ? logsData : [];

  // ── Check for newly earned 100-day badges ─────────────────────
  useEffect(() => {
    if (!habits.length) return;
    for (const habit of habits) {
      const has100 = habit.badges?.some(b => b.type === '100_day_streak');
      if (has100) {
        const lsKey = `celebrated_${habit._id}`;
        if (!localStorage.getItem(lsKey)) {
          localStorage.setItem(lsKey, 'true');
          setCelebrationHabit(habit);
          break; // show one at a time
        }
      }
    }
  }, [habits]);

  const todayStr = getTodayString();
  const dateDisplay = format(new Date(), 'EEEE, MMMM d');
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';

  const completedTodayCount = habits.filter(h => {
    const log = logs.find(l => (l.habit === h._id || l.habitId === h._id) && l.date === todayStr);
    return log?.status === 'done';
  }).length;

  const totalHabits = habits.length;
  const progressPercent = totalHabits > 0 ? Math.round((completedTodayCount / totalHabits) * 100) : 0;
  const isPerfectDay = totalHabits > 0 && completedTodayCount === totalHabits;
  const isLoading = habitsLoading || logsLoading;

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 pb-24">
      <Navbar />
      <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-10">

        {/* Header card */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-indigo-100 dark:border-gray-700 px-4 sm:px-6 py-4 sm:py-5 mb-6 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Today</h1>
            <p className="text-sm sm:text-base font-medium text-gray-600 dark:text-gray-300 mt-0.5">{dateDisplay}</p>
          </div>
          <p className="text-sm sm:text-base font-medium text-indigo-600 dark:text-indigo-400 text-right">
            {greeting},{' '}
            <span className="text-indigo-700 dark:text-indigo-300 font-bold">
              {user?.firstName || user?.name?.split(' ')[0] || 'User'}!
            </span>
          </p>
        </div>

        {/* Progress card */}
        {!isLoading && totalHabits > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-md border border-gray-100 dark:border-gray-700 px-6 py-4 mb-6">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs font-bold tracking-widest text-gray-500 dark:text-gray-400 uppercase">
                Daily Progress
              </span>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-indigo-600 dark:text-indigo-400">
                  {completedTodayCount}/{totalHabits} done
                </span>
                {isPerfectDay && (
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 animate-bounce">
                    🎉 Perfect Day!
                  </span>
                )}
              </div>
            </div>
            <div
              className="rounded-full overflow-hidden"
              style={{ height: 8, background: 'rgba(255,255,255,0.08)', width: '100%' }}
            >
              <div
                className="h-full rounded-full transition-all duration-700 ease-out"
                style={{
                  width: `${progressPercent}%`,
                  background: isPerfectDay
                    ? 'linear-gradient(90deg, #10b981, #06b6d4)'   /* green → cyan  */
                    : progressPercent >= 50
                    ? 'linear-gradient(90deg, #7c3aed, #06b6d4)'   /* purple → cyan */
                    : 'linear-gradient(90deg, #ef4444, #f59e0b)',   /* red → orange  */
                }}
              />
            </div>
          </div>
        )}

        {/* Weekly View */}
        {!isLoading && totalHabits > 0 && (
          <WeeklyView habits={habits} allLogs={logs} />
        )}

        {/* Habits */}
        {isLoading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-indigo-200 border-t-indigo-600" />
          </div>
        ) : totalHabits === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 px-4 bg-white dark:bg-gray-800 rounded-3xl border-2 border-dashed border-gray-200 dark:border-gray-700 shadow-sm mt-8">
            <div className="text-7xl mb-4 bg-indigo-50 dark:bg-indigo-900/30 w-24 h-24 rounded-full flex items-center justify-center shrink-0">✨</div>
            <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-2 mt-2">No habits yet</h3>
            <p className="text-gray-600 dark:text-gray-300 text-center mb-10 max-w-sm text-base leading-relaxed">
              Add your first habit to start building discipline and tracking your daily progress.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {habits.map(habit => {
              const habitKey = habit._id;
              const todayLog = logs.find(l => (l.habit === habitKey || l.habitId === habitKey) && l.date === todayStr) || null;
              const habitLogs = logs.filter(l => l.habit === habitKey || l.habitId === habitKey);
              return (
                <HabitCard
                  key={habitKey}
                  habit={habit}
                  todayLog={todayLog}
                  allLogs={habitLogs}
                  onLog={handleLog}
                  isUpdating={loadingHabitId === habitKey}
                />
              );
            })}
          </div>
        )}
      </main>

      {/* FAB */}
      <button
        onClick={() => setIsModalOpen(true)}
        className="fixed bottom-8 right-8 md:bottom-12 md:right-12 w-16 h-16 bg-gradient-to-r from-indigo-500 to-purple-600 text-white rounded-full flex items-center justify-center shadow-lg shadow-indigo-500/40 hover:shadow-xl hover:shadow-indigo-500/50 hover:scale-110 active:scale-95 transition-all duration-200 focus:outline-none focus:ring-4 focus:ring-indigo-300 z-40 group"
      >
        <svg className="w-8 h-8 group-hover:rotate-90 transition-transform duration-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 4v16m8-8H4" />
        </svg>
      </button>

      <AddHabitModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        defaultTrackingPeriod={Number(localStorage.getItem('defaultTrackingPeriod')) || 30}
      />

      {/* 100-day streak celebration — shows once per habit */}
      <StreakCelebrationModal
        habit={celebrationHabit}
        onClose={() => setCelebrationHabit(null)}
      />
    </div>
  );
}

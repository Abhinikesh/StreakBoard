import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../../api/axios';

export default function HabitCard({ habit, todayLog, allLogs = [], onLog, isUpdating }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteText, setNoteText] = useState(todayLog?.note || '');

  const todayStatus = todayLog?.status || null;
  const todayLogId = todayLog?._id || null;
  const hasNote = !!(todayLog?.note);

  const streak = useMemo(() => {
    if (!allLogs?.length) return 0;
    const doneDates = new Set(allLogs.filter(l => l.status === 'done').map(l => l.date));
    let count = 0;
    const today = new Date();
    const pad = n => String(n).padStart(2, '0');
    const todayStr = `${today.getFullYear()}-${pad(today.getMonth()+1)}-${pad(today.getDate())}`;
    if (doneDates.has(todayStr)) count++;
    let curr = new Date(today);
    curr.setDate(curr.getDate() - 1);
    while (true) {
      const ds = `${curr.getFullYear()}-${pad(curr.getMonth()+1)}-${pad(curr.getDate())}`;
      if (doneDates.has(ds)) { count++; curr.setDate(curr.getDate() - 1); }
      else break;
    }
    return count;
  }, [allLogs]);

  const noteMut = useMutation({
    mutationFn: ({ logId, note }) => api.patch(`/api/logs/${logId}/note`, { note }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['logs'] });
      toast('Note saved 📝', {
        style: { background: '#4F46E5', color: 'white', fontWeight: '600' },
        duration: 2000,
      });
      setNoteOpen(false);
    },
    onError: () => toast.error('Failed to save note.'),
  });

  const handleNoteToggle = () => {
    if (!todayStatus) {
      toast('Mark the habit first before adding a note', {
        icon: '💡',
        style: { background: '#F59E0B', color: 'white', fontWeight: '600' },
      });
      return;
    }
    setNoteText(todayLog?.note || '');
    setNoteOpen(v => !v);
  };

  const handleNoteSave = () => {
    if (!todayLogId) return;
    noteMut.mutate({ logId: todayLogId, note: noteText });
  };

  const isDone = todayStatus === 'done';
  const isMissed = todayStatus === 'missed';
  const is100Day = !!(habit.badges?.some(b => b.type === '100_day_streak'));

  const cardBg = isDone
    ? 'bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 border-l-4 border-l-green-500 dark:border-l-green-700'
    : isMissed
    ? 'bg-gradient-to-r from-red-50 to-rose-50 dark:from-red-900/30 dark:to-rose-900/30 border-l-4 border-l-red-400 dark:border-l-red-700'
    : 'bg-white dark:bg-gray-800';

  const cardStyle = (!isDone && !isMissed)
    ? { borderLeft: `4px solid ${habit.colorHex || '#4F46E5'}` }
    : {};

  const statusText = isDone
    ? <span className="text-sm font-semibold text-green-600 dark:text-green-400">✓ Done for today!</span>
    : isMissed
    ? <span className="text-sm font-medium text-red-500 dark:text-red-400">✕ Marked as missed</span>
    : (streak > 0
        ? <span className="flex items-center gap-1.5 text-sm font-medium text-gray-500 dark:text-gray-400"><span>🔥</span>{streak} day streak</span>
        : <span className="text-sm font-medium text-gray-500 dark:text-gray-400">Start your streak!</span>
      );

  return (
    <div
      className={`relative rounded-2xl shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 border border-gray-100 dark:border-gray-700 overflow-hidden ${cardBg} ${
        is100Day ? 'ring-2 ring-yellow-400 dark:ring-yellow-500 shadow-[0_0_20px_rgba(250,204,21,0.25)]' : ''
      }`}
      style={cardStyle}
    >
      {/* 100-day badge icon */}
      {is100Day && (
        <span
          className="absolute top-2 right-2 text-lg leading-none z-10 select-none"
          title="100-day streak badge!"
        >
          🏆
        </span>
      )}
      {/* Main row */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="text-2xl sm:text-3xl bg-white/70 dark:bg-gray-700/70 rounded-full w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center shrink-0 shadow-sm">
            {habit.icon || '🎯'}
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-base text-gray-900 dark:text-white leading-tight mb-0.5 truncate">{habit.name}</h3>
            <p className="text-xs sm:text-sm">{statusText}</p>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-1.5">
          {/* Tick */}
          <button
            onClick={() => onLog(habit._id, 'done')}
            disabled={isUpdating}
            className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-200 disabled:opacity-50 ${
              isDone
                ? 'bg-green-500 border-green-500 text-white shadow-md shadow-green-500/30 scale-105'
                : 'border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500 hover:border-green-400 dark:hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 hover:text-green-500 active:scale-95'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
            </svg>
          </button>

          {/* Cross */}
          <button
            onClick={() => onLog(habit._id, 'missed')}
            disabled={isUpdating}
            className={`w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-200 disabled:opacity-50 ${
              isMissed
                ? 'bg-red-500 border-red-500 text-white shadow-md shadow-red-500/30 scale-105'
                : 'border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500 hover:border-red-400 dark:hover:border-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 hover:text-red-500 active:scale-95'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="w-px h-8 bg-gray-200 dark:bg-gray-600 mx-0.5 hidden sm:block" />

          {/* Note button */}
          <button
            onClick={handleNoteToggle}
            className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors active:scale-95 ${
              hasNote
                ? 'text-indigo-500 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20'
                : 'text-gray-400 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-indigo-500 dark:hover:text-indigo-400'
            }`}
            title={hasNote ? 'Edit today\'s note' : 'Add a note'}
          >
            📝
          </button>

          {/* Calendar */}
          <button
            onClick={() => navigate(`/calendar?habit=${habit._id}`)}
            className="w-10 h-10 rounded-full flex items-center justify-center text-gray-400 dark:text-gray-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 hover:text-indigo-500 dark:hover:text-indigo-400 transition-colors active:scale-95"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </button>
        </div>
      </div>

      {/* Note panel — slides open */}
      <div className={`transition-all duration-300 overflow-hidden ${noteOpen ? 'max-h-48 opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="px-4 sm:px-6 pb-4 pt-1 border-t border-gray-100 dark:border-gray-700/50">
          <textarea
            rows={2}
            maxLength={280}
            value={noteText}
            onChange={e => setNoteText(e.target.value)}
            placeholder="Add a note for today... (optional)"
            className="w-full text-sm bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-gray-700 dark:text-gray-300 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-300 mt-2"
          />
          <div className="flex items-center justify-between mt-1.5">
            <span className="text-xs text-gray-400">{noteText.length} / 280</span>
            <button
              onClick={handleNoteSave}
              disabled={noteMut.isPending}
              className="text-xs px-3 py-1.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg transition-all font-medium disabled:opacity-60"
            >
              {noteMut.isPending ? 'Saving...' : 'Save note'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

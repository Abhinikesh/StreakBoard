import React, { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../api/axios';
import Navbar from '../components/layout/Navbar';
import Spinner from '../components/ui/Spinner';
import { useAuth } from '../context/AuthContext';

const CLIENT_URL = window.location.origin;
const MEDAL = ['🥇', '🥈', '🥉'];

export default function FriendsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [addCode, setAddCode] = useState('');

  // ── Share info ─────────────────────────────────────────────
  const { data: shareInfo = {}, isLoading: shareLoading } = useQuery({
    queryKey: ['shareInfo'],
    queryFn: async () => { const r = await api.get('/api/social/my-share'); return r.data; }
  });

  // ── Friends ────────────────────────────────────────────────
  const { data: friends = [], isLoading: friendsLoading } = useQuery({
    queryKey: ['friends'],
    queryFn: async () => { const r = await api.get('/api/social/friends'); return r.data; }
  });

  // ── My logs for leaderboard ────────────────────────────────
  const { data: myLogs = [] } = useQuery({
    queryKey: ['logs'],
    queryFn: async () => { const r = await api.get('/api/logs/all'); return r.data.logs || r.data || []; }
  });

  // ── Mutations ──────────────────────────────────────────────
  const enableMut = useMutation({
    mutationFn: () => api.post('/api/social/enable'),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['shareInfo'] }); toast.success('Profile is now public! 🌐'); },
    onError: (e) => toast.error(e.response?.data?.message || 'Failed to enable sharing'),
  });

  const disableMut = useMutation({
    mutationFn: () => api.post('/api/social/disable'),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['shareInfo'] }); toast('Profile set to private.'); },
    onError: () => toast.error('Failed to update sharing'),
  });

  // ── Auto-enable if no shareCode yet (silent, no toast) ─────
  useEffect(() => {
    if (!shareLoading && shareInfo && !shareInfo.shareCode) {
      api.post('/api/social/enable').then(() => {
        queryClient.invalidateQueries({ queryKey: ['shareInfo'] });
      }).catch(() => {});
    }
  }, [shareLoading, shareInfo, queryClient]);

  const addFriendMut = useMutation({
    mutationFn: (shareCode) => api.post('/api/social/friends/add', { shareCode }),
    onSuccess: (_, sc) => {
      queryClient.invalidateQueries({ queryKey: ['friends'] });
      toast.success('Friend added! 🎉');
      setAddCode('');
    },
    onError: (e) => toast.error(e.response?.data?.message || 'Could not add friend'),
  });

  // Strip full URL if user pastes a profile link instead of just the code
  const cleanCode = (raw) => {
    let code = raw.trim();
    if (code.includes('/u/')) {
      code = code.split('/u/').pop().trim();
    }
    return code;
  };

  const removeFriendMut = useMutation({
    mutationFn: (sc) => api.delete(`/api/social/friends/${sc}`),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['friends'] }); toast('Friend removed.'); },
    onError: () => toast.error('Failed to remove friend'),
  });

  const copyLink = () => {
    if (!shareInfo.shareUrl) return;
    const url = `${CLIENT_URL}/u/${shareInfo.shareCode}`;
    navigator.clipboard.writeText(url).then(() => toast('Link copied! 📋'));
  };

  // ── Leaderboard ────────────────────────────────────────────
  const leaderboard = useMemo(() => {
    const monday = (() => {
      const d = new Date(); d.setHours(0,0,0,0);
      d.setDate(d.getDate() - (d.getDay() === 0 ? 6 : d.getDay() - 1));
      return d.toISOString().split('T')[0];
    })();
    const today = new Date().toISOString().split('T')[0];

    const myWeekDone = Array.isArray(myLogs)
      ? myLogs.filter(l => l.date >= monday && l.date <= today && l.status === 'done').length
      : 0;

    const rows = [
      { name: user?.name || 'You', shareCode: shareInfo.shareCode, weekDone: myWeekDone, isMe: true },
      ...friends.map(f => ({ name: f.name, shareCode: f.shareCode, weekDone: f.weekDone || 0, isMe: false })),
    ];
    return rows.sort((a, b) => b.weekDone - a.weekDone).slice(0, 10);
  }, [friends, myLogs, user, shareInfo]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 pb-24 font-sans">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 pt-10 space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white tracking-tight">Friends</h1>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-1">See how your friends are building habits</p>
        </div>

        {/* ── Section 1: Share Link ── */}
        <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          {/* Header row */}
          <div className="flex items-center justify-between mb-4 border-b border-gray-100 dark:border-gray-700 pb-3 gap-3 flex-wrap">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">Your public profile</h2>
            {!shareLoading && shareInfo.isProfilePublic ? (
              <span className="inline-flex items-center gap-1.5 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 text-xs font-bold px-3 py-1 rounded-full border border-green-200 dark:border-green-800">
                🌐 Your profile is public
              </span>
            ) : !shareLoading ? (
              <span className="inline-flex items-center gap-1.5 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-400 text-xs font-bold px-3 py-1 rounded-full border border-yellow-200 dark:border-yellow-800">
                🔒 Private
              </span>
            ) : null}
          </div>

          {shareLoading ? <Spinner size="sm" /> : (
            <div className="space-y-4">

              {/* Warning banner when private */}
              {!shareInfo.isProfilePublic && (
                <div className="flex items-start gap-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl px-4 py-3">
                  <span className="text-lg shrink-0">⚠️</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-yellow-800 dark:text-yellow-300">
                      Your profile is currently private — you won't appear on the Leaderboard
                    </p>
                  </div>
                </div>
              )}

              {/* Share link — always shown once shareCode exists */}
              {shareInfo.shareCode ? (
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-gray-50 dark:bg-gray-700 rounded-xl px-4 py-3 font-mono text-sm text-gray-800 dark:text-gray-200 truncate">
                    {CLIENT_URL}/u/{shareInfo.shareCode}
                  </code>
                  <button
                    onClick={copyLink}
                    className="shrink-0 bg-indigo-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-indigo-700 transition-all"
                  >
                    Copy
                  </button>
                </div>
              ) : (
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl px-4 py-3">
                  <p className="text-sm text-gray-400 dark:text-gray-500 font-mono">Generating your share link…</p>
                </div>
              )}

              {/* Action row */}
              <div className="flex items-center gap-3 flex-wrap">
                {shareInfo.shareCode && (
                  <button
                    onClick={() => window.open(`/u/${shareInfo.shareCode}`, '_blank')}
                    className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    View my public profile ↗
                  </button>
                )}

                {shareInfo.isProfilePublic ? (
                  /* Subtle secondary button — not prominent */
                  <button
                    onClick={() => disableMut.mutate()}
                    disabled={disableMut.isPending}
                    className="ml-auto text-xs font-medium text-gray-400 dark:text-gray-500 border border-gray-200 dark:border-gray-600 px-3 py-1.5 rounded-lg hover:text-red-500 dark:hover:text-red-400 hover:border-red-300 dark:hover:border-red-700 transition-all disabled:opacity-50"
                  >
                    {disableMut.isPending ? 'Updating…' : 'Make Private'}
                  </button>
                ) : (
                  /* Prominent CTA */
                  <button
                    onClick={() => enableMut.mutate()}
                    disabled={enableMut.isPending}
                    className="ml-auto bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-5 py-2 rounded-xl transition-all disabled:opacity-60 shadow-md"
                  >
                    {enableMut.isPending ? 'Updating…' : '🌐 Make Public'}
                  </button>
                )}
              </div>
            </div>
          )}
        </section>

        {/* ── Section 2: Add Friend ── */}
        <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 border-b border-gray-100 dark:border-gray-700 pb-3">Add a friend</h2>
          <div className="flex gap-2">
            <input
              type="text" value={addCode} onChange={e => setAddCode(e.target.value)}
              placeholder="Enter share code or paste profile link"
              className="flex-1 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-2.5 text-sm font-medium text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-400"
              onKeyDown={e => e.key === 'Enter' && addCode && addFriendMut.mutate(cleanCode(addCode))}
            />
            <button onClick={() => addCode && addFriendMut.mutate(cleanCode(addCode))} disabled={addFriendMut.isPending || !addCode}
              className="bg-indigo-600 text-white font-semibold px-5 py-2.5 rounded-xl hover:bg-indigo-700 transition-all disabled:opacity-60 text-sm shrink-0">
              {addFriendMut.isPending ? '...' : 'Add Friend'}
            </button>
          </div>
        </section>

        {/* ── Section 3: Friends List ── */}
        <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <div className="flex items-center gap-2 mb-4 border-b border-gray-100 dark:border-gray-700 pb-3">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">My Friends</h2>
            {friends.length > 0 && (
              <span className="bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 text-xs font-bold px-2 py-0.5 rounded-full">{friends.length}</span>
            )}
          </div>
          {friendsLoading ? <Spinner size="sm" /> : friends.length === 0 ? (
            <div className="text-center py-6">
              <div className="text-4xl mb-3">👥</div>
              <p className="text-sm text-gray-500 dark:text-gray-400">No friends added yet. Share your code and add friends!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {friends.map(friend => (
                <div key={friend.shareCode} className="flex items-center gap-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-2xl relative">
                  <div className="w-10 h-10 rounded-full bg-indigo-600 text-white flex items-center justify-center font-bold shrink-0">
                    {friend.name?.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-white text-sm truncate">{friend.name}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 font-mono">{friend.shareCode}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {friend.todayDone > 0 && (
                      <span className="text-xs font-semibold text-green-600 dark:text-green-400">{friend.todayDone} done today</span>
                    )}
                    <button onClick={() => window.open(`/u/${friend.shareCode}`, '_blank')}
                      className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline">
                      View ↗
                    </button>
                    <button onClick={() => removeFriendMut.mutate(friend.shareCode)}
                      className="w-6 h-6 rounded-full text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 flex items-center justify-center text-sm transition-colors">
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Leaderboard ── */}
        {leaderboard.length > 1 && (
          <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
            <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4 border-b border-gray-100 dark:border-gray-700 pb-3">This week's leaderboard 🏆</h2>
            <div className="space-y-2">
              {leaderboard.map((entry, i) => (
                <div key={entry.shareCode || entry.name}
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl ${entry.isMe ? 'bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-200 dark:border-indigo-800' : 'bg-gray-50 dark:bg-gray-700/50'}`}>
                  <span className="text-lg w-8 text-center">{MEDAL[i] || `#${i + 1}`}</span>
                  <div className="w-8 h-8 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-bold shrink-0">
                    {entry.name?.charAt(0).toUpperCase()}
                  </div>
                  <span className={`flex-1 text-sm font-semibold ${entry.isMe ? 'text-indigo-700 dark:text-indigo-300' : 'text-gray-900 dark:text-white'}`}>
                    {entry.name} {entry.isMe && <span className="text-xs font-normal opacity-70">(you)</span>}
                  </span>
                  <span className="text-sm font-bold text-green-600 dark:text-green-400">{entry.weekDone} done</span>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

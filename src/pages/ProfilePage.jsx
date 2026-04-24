import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../api/axios';
import Navbar from '../components/layout/Navbar';
import AvatarUpload from '../components/AvatarUpload';
import Spinner from '../components/ui/Spinner';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import useNotifications from '../hooks/useNotifications';

export default function ProfilePage() {
  const { user, updateUser, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const queryClient = useQueryClient();
  const isDark = theme === 'dark';

  // ── Local state ────────────────────────────────────────────────────────────
  const [isEditingName, setIsEditingName]   = useState(false);
  const [editName,      setEditName]        = useState(user?.name || '');
  const [soundEnabled,  setSoundEnabled]    = useState(
    () => localStorage.getItem('soundEnabled') !== 'false'
  );
  const [localReminderTime, setLocalReminderTime] = useState('21:00');
  const debounceRef = useRef(null);

  // ── Sound toggle side-effect ───────────────────────────────────────────────
  useEffect(() => {
    localStorage.setItem('soundEnabled', String(soundEnabled));
  }, [soundEnabled]);

  // ── Notifications hook ────────────────────────────────────────────────────
  const {
    isSupported, permission, isSubscribed,
    isLoading: notifLoading,
    subscribe: subscribePush,
    unsubscribe: unsubscribePush,
    updateSettings,
  } = useNotifications();

  // ── Fetch profile from backend (fixes createdAt "Unknown" bug) ────────────
  const { data: profileData, isLoading: profileLoading } = useQuery({
    queryKey: ['userProfile'],
    queryFn: async () => {
      const r = await api.get('/api/user/profile');
      return r.data;
    },
    staleTime: 60_000,
  });

  // ── Fetch share info ──────────────────────────────────────────────────────
  const { data: shareInfo = {}, isLoading: shareLoading } = useQuery({
    queryKey: ['shareInfo'],
    queryFn: async () => {
      const r = await api.get('/api/social/my-share');
      return r.data;
    },
    staleTime: 60_000,
  });

  // ── Fetch notification settings ───────────────────────────────────────────
  const { data: savedSettings } = useQuery({
    queryKey: ['notificationSettings'],
    queryFn: async () => {
      const res = await api.get('/api/notifications/settings');
      return res.data;
    },
    staleTime: 60_000,
  });

  // Helper: convert UTC "HH:MM" → local "HH:MM"
  const utcToLocal = (utcStr) => {
    const [h, m] = (utcStr || '21:00').split(':').map(Number);
    const d = new Date();
    d.setUTCHours(h, m, 0, 0);
    return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  };

  // Sync time picker with DB value
  useEffect(() => {
    if (savedSettings?.reminderTime) {
      setLocalReminderTime(utcToLocal(savedSettings.reminderTime));
    }
  }, [savedSettings]);

  // ── Display name helpers ──────────────────────────────────────────────────
  const displayName = profileData?.name || user?.name || user?.email?.split('@')[0] || 'User';
  const avatarUrl   = profileData?.avatar || user?.avatar || user?.avatarUrl;
  const memberSince = profileData?.createdAt
    ? new Date(profileData.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : null;

  // ── Update display name mutation ──────────────────────────────────────────
  const updateNameMut = useMutation({
    mutationFn: (name) => api.put('/api/auth/me', { name }),
    onSuccess: (_, name) => {
      updateUser({ name });
      queryClient.invalidateQueries({ queryKey: ['userProfile'] });
      setIsEditingName(false);
      toast.success('Name updated!');
    },
    onError: () => toast.error('Failed to update name'),
  });

  const handleSaveName = () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== (profileData?.name || user?.name)) {
      updateNameMut.mutate(trimmed);
    } else {
      setIsEditingName(false);
    }
  };

  const copyLink = () => {
    if (!shareInfo.shareCode) return;
    const url = `${window.location.origin}/u/${shareInfo.shareCode}`;
    navigator.clipboard.writeText(url).then(() => toast('Link copied! 📋'));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 pb-24 text-gray-900 dark:text-white">
      <Navbar />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 pt-10 space-y-5">

        {/* ── Page heading ── */}
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Profile &amp; Settings</h1>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-1">
            Manage your account, preferences, and public profile
          </p>
        </div>

        {/* ──────────────────────────────────────────────────────────────────── */}
        {/* SECTION 1 — Profile Photo                                           */}
        {/* ──────────────────────────────────────────────────────────────────── */}
        <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 flex flex-col items-center gap-3">
          {profileLoading ? (
            <Spinner size="md" />
          ) : (
            <>
              <AvatarUpload
                avatarUrl={avatarUrl}
                name={displayName}
                size={100}
                onUpdate={(newUrl) => {
                  updateUser({ avatar: newUrl, avatarUrl: newUrl });
                  queryClient.invalidateQueries({ queryKey: ['userProfile'] });
                }}
              />
              <p className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 cursor-pointer select-none">
                📷 Click photo to change
              </p>
              <p className="text-xl font-bold text-gray-900 dark:text-white">{displayName}</p>
            </>
          )}
        </section>

        {/* ──────────────────────────────────────────────────────────────────── */}
        {/* SECTION 2 — Account Details                                         */}
        {/* ──────────────────────────────────────────────────────────────────── */}
        <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <h2 className="text-base font-bold mb-4 pb-3 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
            <span>👤</span> Account Details
          </h2>

          <div className="space-y-5">
            {/* Display name */}
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                Display Name
              </label>
              {isEditingName ? (
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="flex-1 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 dark:text-white"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                  />
                  <button
                    onClick={handleSaveName}
                    disabled={updateNameMut.isPending}
                    className="bg-indigo-600 text-white font-semibold px-4 py-2 rounded-xl hover:bg-indigo-700 transition-all text-sm disabled:opacity-60"
                  >
                    {updateNameMut.isPending ? 'Saving…' : 'Save'}
                  </button>
                  <button
                    onClick={() => { setEditName(profileData?.name || user?.name || ''); setIsEditingName(false); }}
                    className="bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold px-4 py-2 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-600 transition-all text-sm"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <p className="text-base font-semibold">{profileData?.name || user?.name || '—'}</p>
                  <button
                    onClick={() => { setEditName(profileData?.name || user?.name || ''); setIsEditingName(true); }}
                    className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    Edit
                  </button>
                </div>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                Email Address
              </label>
              <p className="text-base font-medium text-gray-500 dark:text-gray-400">
                {profileData?.email || user?.email || '—'}
              </p>
            </div>

            {/* Member since */}
            <div>
              <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                Member Since
              </label>
              <p className="text-base font-medium text-gray-500 dark:text-gray-400">
                {profileLoading ? '…' : (memberSince || 'April 2025')}
              </p>
            </div>
          </div>
        </section>

        {/* ──────────────────────────────────────────────────────────────────── */}
        {/* SECTION 3 — Public Link                                             */}
        {/* ──────────────────────────────────────────────────────────────────── */}
        <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <h2 className="text-base font-bold mb-4 pb-3 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
            <span>🔗</span> Public Profile Link
          </h2>
          {shareLoading ? (
            <Spinner size="sm" />
          ) : shareInfo.shareCode ? (
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                  Share Code
                </label>
                <code className="block bg-gray-50 dark:bg-gray-700 rounded-xl px-4 py-3 font-mono text-sm text-gray-800 dark:text-gray-200">
                  {shareInfo.shareCode}
                </code>
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                  Profile URL
                </label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-gray-50 dark:bg-gray-700 rounded-xl px-4 py-3 font-mono text-sm text-gray-800 dark:text-gray-200 truncate">
                    {window.location.origin}/u/{shareInfo.shareCode}
                  </code>
                  <button
                    onClick={copyLink}
                    className="shrink-0 bg-indigo-600 text-white text-sm font-semibold px-4 py-3 rounded-xl hover:bg-indigo-700 transition-all"
                  >
                    Copy
                  </button>
                </div>
              </div>
              <button
                onClick={() => window.open(`/u/${shareInfo.shareCode}`, '_blank')}
                className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                View my public profile ↗
              </button>
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No public profile found. Visit the{' '}
              <a href="/friends" className="text-indigo-500 hover:underline">Friends page</a>{' '}
              to enable it.
            </p>
          )}
        </section>

        {/* ──────────────────────────────────────────────────────────────────── */}
        {/* SECTION 4 — Preferences                                             */}
        {/* ──────────────────────────────────────────────────────────────────── */}
        <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <h2 className="text-base font-bold mb-4 pb-3 border-b border-gray-100 dark:border-gray-700 flex items-center gap-2">
            <span>⚙️</span> Preferences
          </h2>
          <div className="space-y-0">

            {/* Dark mode */}
            <div className="flex items-center justify-between py-4">
              <div>
                <h3 className="font-semibold text-gray-800 dark:text-gray-200 text-base mb-0.5">Dark Mode</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Switch between light and dark theme.</p>
              </div>
              <button
                type="button"
                onClick={toggleTheme}
                className={`relative w-14 h-7 rounded-full transition-colors duration-300 focus:outline-none flex-shrink-0 ${isDark ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-600'}`}
                aria-label="Toggle dark mode"
              >
                <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md flex items-center justify-center text-sm transition-transform duration-300 ${isDark ? 'translate-x-7' : 'translate-x-0.5'}`}>
                  {isDark ? '🌙' : '☀️'}
                </span>
              </button>
            </div>

            <div className="w-full h-px bg-gray-100 dark:bg-gray-700" />

            {/* Sound effects */}
            <div className="flex items-center justify-between py-4">
              <div>
                <h3 className="font-semibold text-gray-800 dark:text-gray-200 text-base mb-0.5">Sound Effects</h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">Play sounds when marking habits.</p>
              </div>
              <button
                type="button"
                onClick={() => setSoundEnabled(v => !v)}
                className={`relative w-14 h-7 rounded-full transition-colors duration-300 focus:outline-none flex-shrink-0 ${soundEnabled ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-600'}`}
                aria-label="Toggle sound effects"
              >
                <span className={`absolute top-0.5 w-6 h-6 rounded-full bg-white shadow-md flex items-center justify-center text-sm transition-transform duration-300 ${soundEnabled ? 'translate-x-7' : 'translate-x-0.5'}`}>
                  {soundEnabled ? '🔊' : '🔇'}
                </span>
              </button>
            </div>
          </div>
        </section>

        {/* ──────────────────────────────────────────────────────────────────── */}
        {/* SECTION 5 — Daily Reminders                                         */}
        {/* ──────────────────────────────────────────────────────────────────── */}
        <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-base font-bold flex items-center gap-2">
              <span>🔔</span> Daily Reminders
            </h2>
            {/* Master toggle */}
            <button
              role="switch"
              aria-checked={isSubscribed}
              onClick={() => isSubscribed ? unsubscribePush() : subscribePush()}
              disabled={notifLoading}
              className={`relative w-12 h-6 rounded-full transition-colors duration-200 focus:outline-none ${notifLoading ? 'opacity-50 pointer-events-none' : ''} ${isSubscribed ? 'bg-indigo-600' : 'bg-gray-200 dark:bg-gray-700'}`}
            >
              <span className={`absolute top-0.5 left-0 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${isSubscribed ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          {/* Browser not supported */}
          {!isSupported && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-4 mt-4">
              <p className="text-sm text-amber-700 dark:text-amber-400">
                Push notifications are not supported in this browser.
                Try Chrome or Edge on desktop, or Chrome on Android.
              </p>
            </div>
          )}

          {/* Permission blocked */}
          {isSupported && permission === 'denied' && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl p-4 mt-4">
              <p className="text-sm text-red-600 dark:text-red-400">
                Notifications are blocked. Please click the 🔒 icon in your
                browser's address bar and allow notifications for this site.
              </p>
            </div>
          )}

          {/* Supported + not blocked */}
          {isSupported && permission !== 'denied' && (
            isSubscribed ? (
              <>
                <div className="flex items-center justify-between mt-4">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Remind me daily at
                  </label>
                  <input
                    type="time"
                    value={localReminderTime}
                    onChange={(e) => {
                      const val = e.target.value;
                      setLocalReminderTime(val);
                      clearTimeout(debounceRef.current);
                      debounceRef.current = setTimeout(async () => {
                        await updateSettings(true, val);
                        queryClient.invalidateQueries({ queryKey: ['notificationSettings'] });
                        toast.success('Reminder time updated ✅');
                      }, 800);
                    }}
                    className="bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-xl px-3 py-2 text-sm font-semibold text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:outline-none cursor-pointer"
                  />
                </div>
                <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-xl p-3 mt-4 flex items-start gap-3">
                  <span className="text-lg shrink-0">💡</span>
                  <p className="text-xs text-indigo-700 dark:text-indigo-300">
                    You'll receive a browser notification at this time every day.
                    Make sure your browser is open or running in the background.
                    On mobile, add StreakBoard to your home screen for best results.
                  </p>
                </div>
              </>
            ) : (
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-xl p-4 mt-4 flex items-center gap-4">
                <span className="text-3xl shrink-0">🔔</span>
                <div>
                  <p className="text-sm font-bold text-gray-900 dark:text-white">Never miss a day</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Enable reminders and we'll nudge you every evening to log your habits.
                  </p>
                </div>
              </div>
            )
          )}
        </section>

        {/* ──────────────────────────────────────────────────────────────────── */}
        {/* SECTION 6 — Account Access / Danger Zone                            */}
        {/* ──────────────────────────────────────────────────────────────────── */}
        <section className="bg-white dark:bg-gray-800 rounded-2xl border-l-4 border-red-500 shadow-sm border border-gray-100 dark:border-gray-700 p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-base font-bold text-red-500 dark:text-red-400 mb-1">Account Access</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Your data is safely backed up and will be here when you return.
            </p>
          </div>
          <button
            onClick={() => { if (window.confirm('Are you sure you want to logout?')) logout(); }}
            className="w-full sm:w-auto px-6 py-2.5 whitespace-nowrap border-2 border-red-500 dark:border-red-400 text-red-500 dark:text-red-400 font-semibold rounded-xl hover:bg-red-500 dark:hover:bg-red-500 hover:text-white dark:hover:text-white transition-all duration-200 shadow-sm active:scale-95"
          >
            Logout of StreakBoard
          </button>
        </section>

      </main>
    </div>
  );
}

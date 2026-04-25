import React, { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';

import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { useAuth } from './context/AuthContext';
import ProtectedRoute from './components/layout/ProtectedRoute';

import LoginPage from './pages/LoginPage';
import AuthCallbackPage from './pages/AuthCallbackPage';
import DashboardPage from './pages/DashboardPage';
import CalendarPage from './pages/CalendarPage';
import StatsPage from './pages/StatsPage';
import ProfilePage from './pages/ProfilePage';
import JournalPage from './pages/JournalPage';
import FriendsPage from './pages/FriendsPage';
import PublicProfilePage from './pages/PublicProfilePage';
import LeaderboardPage from './pages/LeaderboardPage';
import NotFoundPage from './pages/NotFoundPage';
import FeedbackWidget from './components/FeedbackWidget';
import ComingSoonAnnouncement from './components/ComingSoonAnnouncement';
import NotificationPrompt from './components/notifications/NotificationPrompt';
import api from './api/axios';

const queryClient = new QueryClient();

// ── Inner component — must live inside AuthProvider to use useAuth ────────────
function NotificationPromptManager() {
  const { user } = useAuth();
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    if (!user) return;

    // Don't show if browser already has a decision (granted or denied)
    if (typeof Notification !== 'undefined' && Notification.permission !== 'default') return;

    // Don't show if user already accepted
    if (localStorage.getItem('notificationPromptSeen')) return;

    // Don't show if currently snoozed
    const snoozed = localStorage.getItem('notificationPromptSnoozed');
    if (snoozed && Date.now() < parseInt(snoozed, 10)) return;

    // Delay 3 s so the page finishes loading before the prompt appears
    const timer = setTimeout(() => setShowPrompt(true), 3000);
    return () => clearTimeout(timer);
  }, [user]);

  if (!showPrompt) return null;

  return (
    <NotificationPrompt onDismiss={() => setShowPrompt(false)} />
  );
}

// ── SwActionHandler ───────────────────────────────────────────────────────────
// Bridges service-worker postMessage → authenticated API call.
// Two entry points:
//   1. window 'message' event (app was already open when notification was tapped)
//   2. URL param ?action=mark-all-done (SW opened a fresh window as fallback)
// Both paths hit the same POST /api/habits/mark-all-done endpoint.
function SwActionHandler() {
  const { user } = useAuth();

  // Shared executor — calls the backend and invalidates the habits query cache
  const runMarkAllDone = useCallback(async () => {
    try {
      const { data } = await api.post('/api/habits/mark-all-done');
      toast.success(`✅ ${data.message || 'All habits marked done!'}`, {
        duration: 4000,
        style: { background: '#10b981', color: '#fff', fontWeight: '700', borderRadius: '12px' },
      });
      // Invalidate habits + logs queries so UI refreshes immediately
      queryClient.invalidateQueries({ queryKey: ['habits'] });
      queryClient.invalidateQueries({ queryKey: ['logs'] });
    } catch (err) {
      console.error('[SwActionHandler] mark-all-done failed:', err);
      toast.error('Could not mark habits done. Please try again.');
    }
  }, []);

  // Listener for postMessage from SW (app window was already open)
  useEffect(() => {
    if (!user) return;
    const handleMessage = (event) => {
      if (event.data?.type === 'MARK_ALL_DONE') {
        runMarkAllDone();
      }
    };
    navigator.serviceWorker?.addEventListener('message', handleMessage);
    return () => navigator.serviceWorker?.removeEventListener('message', handleMessage);
  }, [user, runMarkAllDone]);

  // URL-param fallback: SW opened /dashboard?action=mark-all-done
  useEffect(() => {
    if (!user) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('action') === 'mark-all-done') {
      // Clean the URL so a refresh doesn't re-trigger
      window.history.replaceState({}, '', window.location.pathname);
      runMarkAllDone();
    }
  }, [user, runMarkAllDone]);

  return null; // no UI
}

// ── Root App ──────────────────────────────────────────────────────────────────
export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <ComingSoonAnnouncement />
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <FeedbackWidget />
            <NotificationPromptManager />
            <SwActionHandler />
            <Toaster 
              position="top-right" 
              toastOptions={{
                duration: 4000,
                style: {
                  background: '#333',
                  color: '#fff',
                  fontWeight: 'bold',
                  borderRadius: '12px',
                },
              }}
            />
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/auth/callback" element={<AuthCallbackPage />} />
              {/* Public — no auth required */}
              <Route path="/u/:shareCode" element={<PublicProfilePage />} />
              
              <Route element={<ProtectedRoute />}>
                <Route path="/dashboard" element={<DashboardPage />} />
                <Route path="/calendar" element={<CalendarPage />} />
                <Route path="/stats" element={<StatsPage />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/journal" element={<JournalPage />} />
                <Route path="/friends" element={<FriendsPage />} />
                <Route path="/leaderboard" element={<LeaderboardPage />} />
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
              </Route>

              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </AuthProvider>
        </QueryClientProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}


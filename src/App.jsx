import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';

import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
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

const queryClient = new QueryClient();

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <ComingSoonAnnouncement />
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <FeedbackWidget />
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

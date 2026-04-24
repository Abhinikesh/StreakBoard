import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import api from '../api/axios';
import Navbar from '../components/layout/Navbar';
import AvatarUpload from '../components/AvatarUpload';
import { useAuth } from '../context/AuthContext';
import Spinner from '../components/ui/Spinner';

export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const queryClient = useQueryClient();
  const [isEditingName, setIsEditingName] = useState(false);
  const [editName, setEditName] = useState(user?.name || '');

  // Fetch share code information
  const { data: shareInfo = {}, isLoading: shareLoading } = useQuery({
    queryKey: ['shareInfo'],
    queryFn: async () => {
      const r = await api.get('/api/social/my-share');
      return r.data;
    },
  });

  // Update profile name
  const updateProfileMut = useMutation({
    mutationFn: (newName) => api.put('/api/user/profile', { name: newName }),
    onSuccess: (_, newName) => {
      updateUser({ name: newName });
      setIsEditingName(false);
      toast.success('Profile updated!');
    },
    onError: () => toast.error('Failed to update profile'),
  });

  const handleSaveName = () => {
    if (editName.trim() && editName !== user?.name) {
      updateProfileMut.mutate(editName.trim());
    } else {
      setIsEditingName(false);
    }
  };

  const copyLink = () => {
    if (!shareInfo.shareCode) return;
    const url = `${window.location.origin}/u/${shareInfo.shareCode}`;
    navigator.clipboard.writeText(url).then(() => toast('Link copied! 📋'));
  };

  // Format the member since date
  const memberSince = user?.createdAt
    ? new Date(user.createdAt).toLocaleDateString('en-US', {
        month: 'long',
        year: 'numeric',
      })
    : 'Unknown';

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-900 dark:to-gray-800 pb-24 font-sans text-gray-900 dark:text-white">
      <Navbar />
      <main className="max-w-2xl mx-auto px-4 sm:px-6 pt-10 space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Profile & Settings</h1>
          <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mt-1">
            Manage your account details and public profile link
          </p>
        </div>

        {/* ── Profile Photo Section ── */}
        <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 flex flex-col items-center">
          <AvatarUpload
            avatarUrl={user?.avatar || user?.avatarUrl}
            name={user?.name || user?.email}
            size={100}
            onUpdate={(newUrl) => {
              if (updateUser) updateUser({ avatar: newUrl, avatarUrl: newUrl });
            }}
          />
          <p className="mt-4 text-sm font-semibold text-gray-600 dark:text-gray-300">
            Change Photo
          </p>
        </section>

        {/* ── Profile Info Section ── */}
        <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6 space-y-6">
          <h2 className="text-lg font-bold border-b border-gray-100 dark:border-gray-700 pb-3">
            Account Details
          </h2>

          <div className="space-y-4">
            {/* Display Name */}
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
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
                    disabled={updateProfileMut.isPending}
                    className="bg-indigo-600 text-white font-semibold px-4 py-2 rounded-xl hover:bg-indigo-700 transition-all text-sm disabled:opacity-60"
                  >
                    {updateProfileMut.isPending ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={() => {
                      setEditName(user?.name || '');
                      setIsEditingName(false);
                    }}
                    disabled={updateProfileMut.isPending}
                    className="bg-gray-200 dark:bg-gray-600 text-gray-800 dark:text-white font-semibold px-4 py-2 rounded-xl hover:bg-gray-300 dark:hover:bg-gray-500 transition-all text-sm disabled:opacity-60"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <p className="text-base font-medium">{user?.name || 'No name set'}</p>
                  <button
                    onClick={() => setIsEditingName(true)}
                    className="text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                  >
                    Edit
                  </button>
                </div>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                Email Address
              </label>
              <p className="text-base font-medium text-gray-500 dark:text-gray-400">
                {user?.email}
              </p>
            </div>

            {/* Member Since */}
            <div>
              <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                Member Since
              </label>
              <p className="text-base font-medium text-gray-500 dark:text-gray-400">
                {memberSince}
              </p>
            </div>
          </div>
        </section>

        {/* ── Share Code Section ── */}
        <section className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700 p-6">
          <h2 className="text-lg font-bold mb-4 border-b border-gray-100 dark:border-gray-700 pb-3">
            Public Link
          </h2>
          {shareLoading ? (
            <Spinner size="sm" />
          ) : shareInfo.shareCode ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Share Code
                </label>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-gray-50 dark:bg-gray-700 rounded-xl px-4 py-3 font-mono text-sm text-gray-800 dark:text-gray-200 truncate">
                    {shareInfo.shareCode}
                  </code>
                </div>
              </div>
              <div>
                <label className="block text-sm font-bold text-gray-700 dark:text-gray-300 mb-1">
                  Profile Link
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
              <div className="pt-2">
                <button
                  onClick={() => window.open(`/u/${shareInfo.shareCode}`, '_blank')}
                  className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  View my public profile ↗
                </button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              No public profile found. Go to the Friends page to enable it.
            </p>
          )}
        </section>
      </main>
    </div>
  );
}

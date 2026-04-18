import React, { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import api from '../api/axios';
import Navbar from '../components/layout/Navbar';
import Spinner from '../components/ui/Spinner';
import AddHabitModal from '../components/habits/AddHabitModal';
import { useAuth } from '../context/AuthContext';

export default function ProfilePage() {
  const { user, login, token, logout } = useAuth();
  const queryClient = useQueryClient();

  // Settings State via localStorage
  const [defaultTrackingPeriod, setDefaultTrackingPeriod] = useState(
    () => Number(localStorage.getItem('defaultTrackingPeriod')) || 30
  );
  const [reminderTime, setReminderTime] = useState(
    () => localStorage.getItem('reminderTime') || '09:00'
  );
  const [theme, setTheme] = useState(
    () => localStorage.getItem('theme') || 'Light'
  );

  useEffect(() => { localStorage.setItem('defaultTrackingPeriod', String(defaultTrackingPeriod)) }, [defaultTrackingPeriod]);
  useEffect(() => { localStorage.setItem('reminderTime', reminderTime) }, [reminderTime]);
  useEffect(() => { localStorage.setItem('theme', theme) }, [theme]);

  // Profile Edit State
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [editProfileName, setEditProfileName] = useState('');

  // Add Habit Modal State
  const [isAddHabitModalOpen, setIsAddHabitModalOpen] = useState(false);

  // Inline Habit Edit State
  const [editingHabitId, setEditingHabitId] = useState(null);
  const [editHabitName, setEditHabitName] = useState('');
  const [editHabitIcon, setEditHabitIcon] = useState('💪');
  const [editHabitColor, setEditHabitColor] = useState('#4F46E5');
  const [editHabitPeriod, setEditHabitPeriod] = useState(30);

  // Inline Delete State
  const [deletingHabitId, setDeletingHabitId] = useState(null);

  // Constants
  const icons = ['💪', '📚', '🧘', '🏃', '💧', '🥗', '😴', '✍️', '🎯', '🎸', '🧹', '💊'];
  const colors = [
    { name: 'indigo', hex: '#4F46E5' },
    { name: 'green', hex: '#22C55E' },
    { name: 'amber', hex: '#F59E0B' },
    { name: 'red', hex: '#EF4444' },
    { name: 'pink', hex: '#EC4899' },
    { name: 'teal', hex: '#14B8A6' },
  ];

  // --- Queries ---
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

  const habits = Array.isArray(habitsData) ? habitsData : [];
  const logs = Array.isArray(logsData) ? logsData : [];

  // --- Profile Meta Math ---
  const userName = user?.name || user?.firstName || '';
  const displayName = userName || user?.email?.split('@')[0] || 'User';
  const initChar = displayName.charAt(0).toUpperCase();
  const createdAtDisplay = user?.createdAt ? format(new Date(user?.createdAt), 'MMMM yyyy') : 'April 2025';

  const memberSinceStr = `Member since ${createdAtDisplay}`;

  const { totalLogs, totalDone, uniqueActiveDates } = useMemo(() => {
    let done = 0;
    const uniqueDates = new Set();
    logs.forEach(log => {
      if (log.status === 'done') {
        done++;
        uniqueDates.add(log.date);
      }
    });
    return {
      totalLogs: logs.length,
      totalDone: done,
      uniqueActiveDates: uniqueDates.size,
    };
  }, [logs]);

  // --- Mutations ---
  const updateProfileMut = useMutation({
    mutationFn: async (payload) => {
      return api.put('/api/auth/me', payload); // Adjust endpoint if needed
    },
    onSuccess: async () => {
      await login(token); // Rehydrate context to reflect changes globally
      toast.success('Profile updated!');
      setIsEditingProfile(false);
    },
    onError: () => toast.error('Failed to update profile.')
  });

  // Extracted Mutation logic into modal

  const updateHabitMut = useMutation({
    mutationFn: async ({ id, payload }) => api.put(`/api/habits/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['habits'] });
      setEditingHabitId(null);
      toast.success('Habit updated!');
    },
    onError: () => toast.error('Failed to update habit.')
  });

  const deleteHabitMut = useMutation({
    mutationFn: async (id) => api.delete(`/api/habits/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['habits'] });
      setDeletingHabitId(null);
      toast.success('Habit removed.');
    },
    onError: () => toast.error('Failed to remove habit.')
  });

  // --- Handlers ---
  const handleSaveProfile = (e) => {
    e.preventDefault();
    if (!editProfileName.trim()) return;
    updateProfileMut.mutate({ name: editProfileName, firstName: editProfileName });
  };

  const openAddModal = () => {
    setIsAddHabitModalOpen(true);
  };

  const startEditingHabit = (h) => {
    setEditingHabitId(h._id);
    setEditHabitName(h.name);
    setEditHabitIcon(h.icon || '💪');
    setEditHabitColor(h.colorHex || '#4F46E5');
    setEditHabitPeriod(h.trackingPeriod || 30);
    setDeletingHabitId(null); // Cancel any open delete toggles
  };

  const handleSaveHabitEdit = (e, id) => {
    e.preventDefault();
    if (!editHabitName.trim()) return;
    updateHabitMut.mutate({
      id,
      payload: {
        name: editHabitName,
        icon: editHabitIcon,
        colorHex: editHabitColor,
        trackingPeriod: editHabitPeriod
      }
    });
  };

  const handleLogout = () => {
    if (window.confirm("Are you sure you want to logout?")) {
      logout();
    }
  };

  // --- View Setup ---
  if (habitsLoading || logsLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col pt-24 items-center">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 font-sans pb-24">
      <Navbar />

      <main className="max-w-3xl mx-auto px-4 sm:px-6 pt-10">
        <h1 className="text-4xl md:text-5xl font-extrabold text-gray-900 tracking-tight mb-8">Profile</h1>

        <div className="space-y-6">
          
          {/* Section 1: Profile Header Card */}
          <section className="bg-white rounded-3xl p-6 sm:p-10 shadow-sm border border-gray-100 flex flex-col items-center">
            
            {/* Avatar block */}
            <div className="mb-4 relative">
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt="Avatar" className="w-20 h-20 rounded-full border-4 border-indigo-50 shadow-sm object-cover" />
              ) : (
                <div className="w-20 h-20 rounded-full bg-indigo-600 text-white flex items-center justify-center text-3xl font-bold shadow-md shadow-indigo-600/30">
                  {initChar}
                </div>
              )}
            </div>

            {/* Profile Info block */}
            {!isEditingProfile ? (
              <div className="text-center space-y-1 w-full max-w-sm">
                <div className="flex items-center justify-center gap-2 mb-1">
                  <h2 className="text-2xl font-black text-gray-900">{displayName}</h2>
                  <span className="bg-green-100 text-green-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Active</span>
                </div>
                {user?.email && <p className="text-sm font-medium text-gray-500">{user.email}</p>}
                
                <button
                  onClick={() => {
                    setEditProfileName(displayName);
                    setIsEditingProfile(true);
                  }}
                  className="mt-4 bg-gray-50 hover:bg-gray-100 text-gray-700 font-semibold px-4 py-2 rounded-lg text-sm transition-colors border border-gray-200"
                >
                  Edit Profile
                </button>
              </div>
            ) : (
              <form onSubmit={handleSaveProfile} className="w-full max-w-xs space-y-4">
                <div>
                  <input
                    type="text"
                    value={editProfileName}
                    onChange={e => setEditProfileName(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-600 font-bold block text-center text-xl text-gray-900"
                    placeholder="Your name"
                    autoFocus
                  />
                </div>
                <div className="flex gap-2 justify-center">
                  <button type="submit" disabled={updateProfileMut.isPending} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-2 rounded-lg text-sm transition-colors shadow-sm disabled:opacity-75">
                    {updateProfileMut.isPending ? 'Saving...' : 'Save'}
                  </button>
                  <button type="button" onClick={() => setIsEditingProfile(false)} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold py-2 rounded-lg text-sm transition-colors">
                    Cancel
                  </button>
                </div>
              </form>
            )}

            <div className="mt-8 pt-6 border-t border-gray-100 w-full text-center">
              <p className="text-xs font-semibold text-gray-400 tracking-wide uppercase">{memberSinceStr}</p>
            </div>
          </section>

          {/* Section 2: Account Stats Row */}
          <section className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-100">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-gray-50/80 rounded-2xl p-4 text-center border border-gray-100">
                <div className="text-3xl font-black text-indigo-600 mb-1">{habits.length}</div>
                <div className="text-xs font-bold text-gray-500 uppercase tracking-widest">Habits Tracking</div>
              </div>
              <div className="bg-gray-50/80 rounded-2xl p-4 text-center border border-gray-100">
                <div className="text-3xl font-black text-indigo-600 mb-1">{totalLogs}</div>
                <div className="text-xs font-bold text-gray-500 uppercase tracking-widest">Total Logs</div>
              </div>
              <div className="bg-gray-50/80 rounded-2xl p-4 text-center border border-gray-100">
                <div className="text-3xl font-black text-indigo-600 mb-1">{totalDone}</div>
                <div className="text-xs font-bold text-gray-500 uppercase tracking-widest">Done Logs</div>
              </div>
              <div className="bg-gray-50/80 rounded-2xl p-4 text-center border border-gray-100">
                <div className="text-3xl font-black text-indigo-600 mb-1">{uniqueActiveDates}</div>
                <div className="text-xs font-bold text-gray-500 uppercase tracking-widest">Days Active</div>
              </div>
            </div>
          </section>

          {/* Section 3: My Habits (Manage List) */}
          <section className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-6 border-b border-gray-100 pb-4">
              <h2 className="text-2xl font-bold text-gray-900 tracking-tight">My Habits</h2>
              <button 
                onClick={openAddModal}
                className="text-indigo-600 font-bold hover:text-indigo-800 transition-colors text-sm flex items-center gap-1 active:scale-95"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M12 4v16m8-8H4"></path></svg>
                Add New
              </button>
            </div>

            {habits.length === 0 ? (
              <div className="text-center py-10 bg-gray-50 border border-dashed border-gray-200 rounded-2xl">
                <p className="text-gray-500 font-medium">No habits yet. Add your first one!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {habits.map(habit => (
                  <div key={habit._id} className="bg-white border hover:border-gray-300 border-gray-100 rounded-2xl transition-all shadow-sm group">
                    
                    {/* View Read Mode block mapping */}
                    {editingHabitId !== habit._id ? (
                      <div className="p-4 flex flex-col sm:flex-row gap-4 sm:items-center justify-between">
                        <div className="flex items-center gap-4 border-l-4 pl-3" style={{ borderLeftColor: habit.colorHex || '#4F46E5' }}>
                          <span 
                            className="w-12 h-12 rounded-full flex items-center justify-center text-2xl shrink-0 border"
                            style={{ backgroundColor: `${habit.colorHex}15`, color: habit.colorHex, borderColor: `${habit.colorHex}30` }}
                          >
                            {habit.icon || '🎯'}
                          </span>
                          <div>
                            <span className="block font-bold text-gray-900 text-lg mb-0.5 leading-tight">{habit.name}</span>
                            <span className="text-[11px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md tracking-wide uppercase">
                              {habit.trackingPeriod || 30} days
                            </span>
                          </div>
                        </div>

                        {/* Actions Control Right Align */}
                        <div className="flex items-center gap-2 sm:ml-auto">
                          {deletingHabitId === habit._id ? (
                            <div className="flex items-center gap-3 bg-red-50 py-1.5 px-3 rounded-lg border border-red-100">
                              <span className="text-sm font-semibold text-red-700">Are you sure?</span>
                              <button 
                                onClick={() => deleteHabitMut.mutate(habit._id)} 
                                disabled={deleteHabitMut.isPending}
                                className="text-xs font-bold bg-red-600 text-white px-2 py-1 rounded shadow-sm hover:bg-red-700 disabled:opacity-70"
                              >
                                Yes, remove
                              </button>
                              <button 
                                onClick={() => setDeletingHabitId(null)} 
                                className="text-xs font-bold text-gray-500 hover:text-gray-700 hover:bg-gray-200 px-2 py-1 rounded"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <>
                              <button 
                                onClick={() => startEditingHabit(habit)} 
                                className="w-10 h-10 rounded-full bg-gray-50 hover:bg-indigo-50 border border-gray-100 hover:border-indigo-100 flex items-center justify-center transition-all opacity-100 sm:opacity-50 sm:group-hover:opacity-100 active:scale-95" 
                                title="Edit Habit"
                                aria-label="Edit"
                              >
                                ✏️
                              </button>
                              <button 
                                onClick={() => setDeletingHabitId(habit._id)} 
                                className="w-10 h-10 rounded-full bg-gray-50 hover:bg-red-50 border border-gray-100 hover:border-red-100 flex items-center justify-center transition-all opacity-100 sm:opacity-50 sm:group-hover:opacity-100 active:scale-95" 
                                title="Delete Habit"
                                aria-label="Delete"
                              >
                                🗑️
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ) : (
                      // Inline Form Editing Interface Reconstructing
                      <form onSubmit={(e) => handleSaveHabitEdit(e, habit._id)} className="p-5 sm:p-6 bg-gray-50/80 rounded-2xl border border-gray-200/60 shadow-inner">
                        <div className="space-y-5">
                          <div>
                            <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1.5">Habit Name</label>
                            <input 
                              type="text" 
                              required
                              value={editHabitName}
                              onChange={(e) => setEditHabitName(e.target.value)}
                              className="w-full px-4 py-2.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-indigo-600 font-semibold text-gray-900 bg-white"
                            />
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                            <div>
                              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1.5">Icon Selection</label>
                              <div className="grid grid-cols-6 gap-2">
                                {icons.map(icon => (
                                  <button
                                    key={icon}
                                    type="button"
                                    onClick={() => setEditHabitIcon(icon)}
                                    className={`w-9 h-9 sm:w-10 sm:h-10 text-xl rounded-lg flex items-center justify-center transition-all ${
                                      editHabitIcon === icon ? 'bg-indigo-100 shadow-sm outline outline-2 outline-indigo-400' : 'bg-white border border-gray-200 hover:bg-gray-100 cursor-pointer'
                                    }`}
                                  >{icon}</button>
                                ))}
                              </div>
                            </div>
                            
                            <div>
                              <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1.5">Color Base</label>
                              <div className="flex gap-2">
                                {colors.map(color => (
                                  <button
                                    key={color.hex}
                                    type="button"
                                    onClick={() => setEditHabitColor(color.hex)}
                                    className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center border-2 border-white transition-transform focus:outline-none"
                                    style={{ 
                                      backgroundColor: color.hex,
                                      outline: editHabitColor === color.hex ? `3px solid ${color.hex}` : undefined,
                                      outlineOffset: '2px',
                                      transform: editHabitColor === color.hex ? 'scale(1.1)' : 'scale(1)'
                                    }}
                                  >
                                    {editHabitColor === color.hex && <div className="w-3 h-3 bg-white rounded-full"></div>}
                                  </button>
                                ))}
                              </div>
                            </div>
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-gray-600 uppercase tracking-wide mb-1.5">Tracking Period Constraint</label>
                            <div className="flex gap-2 bg-gray-200/50 p-1 rounded-lg">
                              {[30, 60, 90].map(days => (
                                <button
                                  key={days}
                                  type="button"
                                  onClick={() => setEditHabitPeriod(days)}
                                  className={`flex-1 py-1.5 text-sm font-bold rounded-md transition-all ${
                                    editHabitPeriod === days ? 'bg-white text-indigo-700 shadow-sm border border-gray-200' : 'text-gray-500 hover:text-gray-800'
                                  }`}
                                >{days} Days</button>
                              ))}
                            </div>
                          </div>
                          
                          <div className="flex gap-3 justify-end pt-2 border-t border-gray-200/60 mt-4">
                            <button 
                              type="button" 
                              onClick={() => setEditingHabitId(null)}
                              className="px-5 py-2 rounded-lg font-bold text-gray-600 bg-white border border-gray-300 hover:bg-gray-100 transition-colors"
                            >
                              Cancel
                            </button>
                            <button 
                              type="submit"
                              disabled={updateHabitMut.isPending}
                              className="px-5 py-2 rounded-lg font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-colors disabled:opacity-75"
                            >
                              {updateHabitMut.isPending ? 'Saving...' : 'Save Changes'}
                            </button>
                          </div>
                        </div>
                      </form>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Section 4: Tracking Settings Form Elements Control Map Storage */}
          <section className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-100">
            <h2 className="text-2xl font-bold text-gray-900 mb-6 tracking-tight border-b border-gray-100 pb-4">Tracking Settings</h2>
            
            <div className="space-y-6">
              
              {/* Context Option */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold text-gray-900 leading-none mb-1 text-lg">Default Goal Length</h3>
                  <p className="text-sm font-medium text-gray-500">Automatically preselect tracking length for new routines.</p>
                </div>
                <div className="flex bg-gray-100 p-1.5 rounded-xl border border-gray-200/60 shrink-0 self-start sm:self-auto">
                  {[30, 60, 90].map(days => (
                    <button
                      key={days}
                      type="button"
                      onClick={() => setDefaultTrackingPeriod(days)}
                      className={`px-4 sm:px-6 py-2.5 text-sm font-bold rounded-lg transition-all ${
                        defaultTrackingPeriod === days ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-gray-200/50' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-200/50'
                      }`}
                    >
                      {days} days
                    </button>
                  ))}
                </div>
              </div>

              <div className="w-full h-px bg-gray-100/80"></div>

              {/* Time Alert Notification Interface Maps Options Elements Logic Storage */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold text-gray-900 leading-none mb-1 text-lg">Daily Reminder</h3>
                  <p className="text-sm font-medium text-gray-500">Set a notification prompt to review tracking.</p>
                </div>
                <div className="flex flex-col items-start sm:items-end w-full sm:w-auto">
                  <label htmlFor="reminderTime" className="sr-only">Remind me daily at</label>
                  <input 
                    id="reminderTime"
                    type="time" 
                    value={reminderTime}
                    onChange={(e) => setReminderTime(e.target.value)}
                    className="bg-white border-2 border-gray-200 hover:border-indigo-400 focus:border-indigo-600 focus:ring-0 rounded-xl px-4 py-2 font-bold text-gray-900 text-lg sm:text-xl transition-colors cursor-pointer outline-none w-full sm:w-auto"
                  />
                  <p className="text-[11px] font-bold text-gray-400 italic mt-2 self-start sm:self-center">Browser notifications coming soon</p>
                </div>
              </div>

              <div className="w-full h-px bg-gray-100/80"></div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <h3 className="font-bold text-gray-900 leading-none mb-1 text-lg">App Theme</h3>
                  <p className="text-sm font-medium text-gray-500">Customize the visual mode of interfaces.</p>
                </div>
                <div className="flex bg-gray-100 p-1.5 rounded-xl border border-gray-200/60 shrink-0 self-start sm:self-auto">
                  {['Light', 'Dark'].map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setTheme(t)}
                      className={`px-5 py-2.5 text-sm font-bold rounded-lg transition-all ${
                        theme === t ? 'bg-white text-indigo-700 shadow-sm ring-1 ring-gray-200/50' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-200/50'
                      }`}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>

            </div>
          </section>

          {/* Section 5: Danger Zone */}
          <section className="bg-white rounded-3xl p-6 sm:p-8 shadow-sm border border-gray-100 border-l-[6px] border-l-red-500 flex flex-col sm:flex-row items-center sm:items-center justify-between gap-6">
            <div>
              <h2 className="text-2xl font-black text-red-600 mb-1 tracking-tight">Account Access</h2>
              <p className="text-sm font-medium text-gray-500">Your data is safely backed up and mapped locally to remain exactly as you left it until your return.</p>
            </div>
            
            <button
              onClick={handleLogout}
              className="w-full sm:w-auto px-6 py-3.5 whitespace-nowrap bg-white text-red-600 font-extrabold rounded-xl border-[3px] border-red-100 hover:border-red-600 hover:bg-red-50 transition-colors shadow-sm active:scale-95"
            >
              Logout of StreakBoard
            </button>
          </section>

        </div>
      </main>

      {/* Reusable Add Habit Modal Form */}
      <AddHabitModal
        isOpen={isAddHabitModalOpen}
        onClose={() => setIsAddHabitModalOpen(false)}
        defaultTrackingPeriod={defaultTrackingPeriod}
      />

    </div>
  );
}

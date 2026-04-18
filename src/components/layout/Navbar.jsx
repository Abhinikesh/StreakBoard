import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function Navbar() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Avatar UI
  const userName = user?.name || user?.firstName || '';
  const displayName = userName || user?.email?.split('@')[0] || 'U';
  const initChar = displayName.charAt(0).toUpperCase();

  const handleLogout = () => {
    if (window.confirm("Are you sure you want to logout?")) {
      logout();
    }
  };

  const navLinks = [
    { name: 'Dashboard', path: '/dashboard' },
    { name: 'Calendar', path: '/calendar' },
    { name: 'Stats', path: '/stats' },
  ];

  return (
    <nav className="sticky top-0 z-50 bg-white border-b border-gray-100 shadow-sm">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">
        <div className="flex justify-between h-16">
          
          {/* Left Side */}
          <div className="flex items-center">
            <button 
              onClick={() => navigate('/dashboard')}
              className="flex-shrink-0 flex items-center focus:outline-none"
            >
              <span className="text-xl sm:text-2xl font-extrabold text-indigo-600 tracking-tight">StreakBoard</span>
            </button>
            <div className="hidden md:ml-10 md:flex md:space-x-8 h-full">
              {navLinks.map((link) => {
                const isActive = location.pathname.startsWith(link.path);
                return (
                  <NavLink
                    key={link.name}
                    to={link.path}
                    className={`inline-flex items-center px-1 pt-1 border-b-2 text-sm font-bold transition-colors ${
                      isActive
                        ? 'border-indigo-600 text-indigo-600'
                        : 'border-transparent text-gray-500 hover:text-indigo-500 hover:border-gray-300'
                    }`}
                  >
                    {link.name}
                  </NavLink>
                );
              })}
            </div>
          </div>

          {/* Right Side */}
          <div className="hidden md:flex items-center gap-6">
            <button
              onClick={handleLogout}
              className="text-sm font-bold text-red-500 hover:text-red-700 transition-colors"
            >
              Logout
            </button>
            <button 
              onClick={() => navigate('/profile')}
              className="flex items-center outline-none ring-2 ring-transparent focus:ring-indigo-500 rounded-full transition-all hover:scale-105"
            >
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt="Profile" className="w-9 h-9 rounded-full object-cover shadow-sm bg-gray-50" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm shadow-sm ring-1 ring-indigo-200">
                  {initChar}
                </div>
              )}
            </button>
          </div>

          {/* Mobile menu button */}
          <div className="flex items-center md:hidden">
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500"
            >
              <span className="sr-only">Open main menu</span>
              {isMobileMenuOpen ? (
                <svg className="block h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              ) : (
                <svg className="block h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Panel */}
      {isMobileMenuOpen && (
        <div className="md:hidden absolute w-full bg-white shadow-xl border-b border-gray-100">
          <div className="pt-2 pb-4 space-y-1 px-4">
            {navLinks.map((link) => {
              const isActive = location.pathname.startsWith(link.path);
              return (
                <NavLink
                  key={link.name}
                  to={link.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`block pl-3 pr-4 py-3 border-l-4 text-base font-bold transition-colors rounded-r-lg ${
                    isActive
                      ? 'bg-indigo-50 border-indigo-600 text-indigo-700'
                      : 'border-transparent text-gray-600 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800'
                  }`}
                >
                  {link.name}
                </NavLink>
              );
            })}
          </div>
          <div className="pt-4 pb-4 border-t border-gray-100 px-4">
            <div className="flex items-center px-4 mb-4 gap-3 bg-gray-50 py-3 rounded-xl cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => { setIsMobileMenuOpen(false); navigate('/profile'); }}>
              {user?.avatarUrl ? (
                <img src={user.avatarUrl} alt="Profile" className="w-10 h-10 rounded-full object-cover shadow-sm bg-white" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold shadow-sm ring-1 ring-indigo-200">
                  {initChar}
                </div>
              )}
              <div>
                <p className="text-base font-bold text-gray-800 leading-tight">{displayName}</p>
                <p className="text-sm font-medium text-gray-500">View Profile</p>
              </div>
            </div>
            <button
              onClick={() => { setIsMobileMenuOpen(false); handleLogout(); }}
              className="mt-2 block w-full text-center px-4 py-3 text-base font-bold text-red-600 hover:bg-red-50 rounded-xl transition-colors"
            >
              Logout of StreakBoard
            </button>
          </div>
        </div>
      )}
    </nav>
  );
}

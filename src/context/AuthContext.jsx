import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api/axios';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Fetch the current user from /api/auth/me
  const fetchMe = useCallback(async (savedToken) => {
    try {
      // Ensure the axios instance uses the token even before interceptors execute
      const { data } = await api.get('/api/auth/me', {
        headers: { Authorization: `Bearer ${savedToken}` },
      });
      setUser(data.user ?? data);
    } catch {
      localStorage.removeItem('token');
      setToken(null);
      setUser(null);
    }
  }, []);

  // On mount, hydrate from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('token');
    if (saved) {
      setToken(saved);
      fetchMe(saved).finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [fetchMe]);

  /**
   * login(token) — persist token, fetch user, update state.
   */
  const login = useCallback(async (newToken) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
    await fetchMe(newToken);
  }, [fetchMe]);

  /**
   * logout() — clear everything and redirect to /login.
   */
  const logout = useCallback(() => {
    localStorage.clear();
    setToken(null);
    setUser(null);
    navigate('/login');
  }, [navigate]);

  /**
   * updateUser(updatedFields) — merges updated fields into current user state
   */
  const updateUser = useCallback((updatedFields) => {
    setUser((prev) => (prev ? { ...prev, ...updatedFields } : prev));
  }, []);

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, updateUser }}>
      {children}
    </AuthContext.Provider>
  );
}

// Convenience hook — also exported from hooks/useAuth.js
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

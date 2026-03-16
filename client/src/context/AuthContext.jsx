import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { fetchMe } from '../lib/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('chiboub_token'));
  const [user, setUser] = useState(null);
  const [upgrades, setUpgrades] = useState({});
  const [loading, setLoading] = useState(true);

  // Handle OAuth callback token from URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlToken = params.get('token');
    if (urlToken) {
      localStorage.setItem('chiboub_token', urlToken);
      setToken(urlToken);
      // Clean the URL
      window.history.replaceState({}, '', '/');
    }
  }, []);

  // Load user data
  const loadUser = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }
    try {
      const data = await fetchMe(token);
      setUser(data.user);
      setUpgrades(data.upgrades || {});
    } catch {
      // Token invalid
      localStorage.removeItem('chiboub_token');
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadUser();
  }, [loadUser]);

  const login = () => {
    window.location.href = '/auth/discord';
  };

  const logout = () => {
    localStorage.removeItem('chiboub_token');
    setToken(null);
    setUser(null);
    setUpgrades({});
  };

  const updateUserData = (userData, upgradesData) => {
    if (userData) setUser(userData);
    if (upgradesData) setUpgrades(upgradesData);
  };

  return (
    <AuthContext.Provider value={{
      token, user, upgrades, loading,
      login, logout, updateUserData, loadUser,
      isAuthenticated: !!user,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}

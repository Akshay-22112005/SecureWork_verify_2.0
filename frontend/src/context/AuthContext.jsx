import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../services/api';
import { setSessionExpiredHandler } from '../services/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const saved = localStorage.getItem('securework_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem('securework_token'));
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  // Register 401 session expiry hook
  useEffect(() => {
    setSessionExpiredHandler(() => {
      setUser(null);
      setToken(null);
    });
  }, []);

  // Fetch current user details on mount if token exists
  useEffect(() => {
    async function loadMe() {
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const res = await api.auth.getMe();
        if (res && res.success) {
          setUser(res.data.user);
          localStorage.setItem('securework_user', JSON.stringify(res.data.user));
        }
      } catch (err) {
        console.warn('Session verification failed, logging out', err);
        logout();
      } finally {
        setLoading(false);
      }
    }
    loadMe();
  }, [token]);

  async function login(email, password) {
    setAuthError(null);
    const res = await api.auth.login({ email, password });
    if (res && res.success) {
      const { user: loggedInUser, token: authToken } = res.data;
      setUser(loggedInUser);
      setToken(authToken);
      localStorage.setItem('securework_token', authToken);
      localStorage.setItem('securework_user', JSON.stringify(loggedInUser));
      return loggedInUser;
    }
    throw new Error(res?.error?.message || 'Login failed');
  }

  async function register(data) {
    setAuthError(null);
    const res = await api.auth.register(data);
    if (res && res.success) {
      const { user: registeredUser, token: authToken } = res.data;
      setUser(registeredUser);
      setToken(authToken);
      localStorage.setItem('securework_token', authToken);
      localStorage.setItem('securework_user', JSON.stringify(registeredUser));
      return registeredUser;
    }
    throw new Error(res?.error?.message || 'Registration failed');
  }

  function logout() {
    setUser(null);
    setToken(null);
    localStorage.removeItem('securework_token');
    localStorage.removeItem('securework_user');
  }

  const role = user?.role || 'GUEST';
  const isAdmin = role === 'ADMIN';
  const isAuditor = role === 'AUDITOR';
  const isIssuer = role === 'ISSUER';
  const isHr = role === 'HR';
  const isUser = role === 'USER';

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        role,
        loading,
        authError,
        setAuthError,
        login,
        register,
        logout,
        isAdmin,
        isAuditor,
        isIssuer,
        isHr,
        isUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}

export default AuthContext;

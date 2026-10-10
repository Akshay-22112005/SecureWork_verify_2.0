import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import api from '../services/api';
import { setSessionExpiredHandler } from '../services/client';

const AuthContext = createContext(null);

/**
 * Reads token from sessionStorage first (non-persistent), then localStorage (persistent).
 */
function readStoredToken() {
  const sessionToken = sessionStorage.getItem('securework_token');
  if (sessionToken && sessionToken !== 'null' && sessionToken !== 'undefined') {
    return sessionToken;
  }
  const localToken = localStorage.getItem('securework_token');
  if (localToken && localToken !== 'null' && localToken !== 'undefined') {
    return localToken;
  }
  return null;
}

function clearAllStorage() {
  localStorage.removeItem('securework_token');
  localStorage.removeItem('securework_user');
  sessionStorage.removeItem('securework_token');
  sessionStorage.removeItem('securework_user');
}

export function AuthProvider({ children }) {
  // Start with loading=true, user=null (do NOT trust localStorage as auth proof)
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  // Track whether session expired for redirect message
  const sessionExpiredRef = useRef(false);

  // Register 401 session expiry hook
  useEffect(() => {
    setSessionExpiredHandler(() => {
      sessionExpiredRef.current = true;
      setUser(null);
      setToken(null);
      clearAllStorage();
    });
  }, []);

  // On mount: validate stored token with server (do NOT trust localStorage alone)
  useEffect(() => {
    let cancelled = false;
    async function validateSession() {
      const storedToken = readStoredToken();

      if (!storedToken) {
        if (!cancelled) setLoading(false);
        return;
      }

      // Temporarily set token in state so apiClient can include it
      if (!cancelled) setToken(storedToken);

      try {
        const res = await api.auth.getMe();
        if (!cancelled) {
          if (res && res.success) {
            setUser(res.data.user);
          } else {
            clearAllStorage();
            setUser(null);
            setToken(null);
          }
        }
      } catch (err) {
        console.warn('Session validation failed, clearing session', err);
        if (!cancelled) {
          clearAllStorage();
          setUser(null);
          setToken(null);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    validateSession();
    return () => { cancelled = true; };
  }, []);

  /**
   * login(email, password, rememberMe)
   * rememberMe=true  -> localStorage (persistent across sessions)
   * rememberMe=false -> sessionStorage (cleared when tab/browser closes)
   */
  async function login(email, password, rememberMe = false) {
    setAuthError(null);
    const res = await api.auth.login({ email, password });
    if (res && res.success) {
      const { user: loggedInUser, token: authToken } = res.data;
      setUser(loggedInUser);
      setToken(authToken);

      if (rememberMe) {
        localStorage.setItem('securework_token', authToken);
        localStorage.setItem('securework_user', JSON.stringify(loggedInUser));
        sessionStorage.removeItem('securework_token');
        sessionStorage.removeItem('securework_user');
      } else {
        sessionStorage.setItem('securework_token', authToken);
        sessionStorage.setItem('securework_user', JSON.stringify(loggedInUser));
        localStorage.removeItem('securework_token');
        localStorage.removeItem('securework_user');
      }
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
      // Registration defaults to session storage (non-persistent) for security
      sessionStorage.setItem('securework_token', authToken);
      sessionStorage.setItem('securework_user', JSON.stringify(registeredUser));
      localStorage.removeItem('securework_token');
      localStorage.removeItem('securework_user');
      return registeredUser;
    }
    throw new Error(res?.error?.message || 'Registration failed');
  }

  function logout() {
    setUser(null);
    setToken(null);
    clearAllStorage();
  }

  const role = user?.role || 'GUEST';
  // isAuthenticated is only true once loading completes AND user+token are valid
  const isAuthenticated = !loading && Boolean(user && token);
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
        isAuthenticated,
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
        isUser,
        sessionExpiredRef
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

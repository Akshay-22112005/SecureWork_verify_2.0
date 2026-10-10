import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LoadingScreen from './LoadingScreen';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading, sessionExpiredRef } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <LoadingScreen 
        message="SecureWork Verify" 
        submessage="Verifying cryptographic authentication session..." 
      />
    );
  }

  if (!isAuthenticated) {
    // Detect if this is a session expiry (token was there but is now invalid)
    const isExpiry = Boolean(sessionExpiredRef?.current);
    if (isExpiry) {
      sessionExpiredRef.current = false; // Reset so it doesn't show again
    }

    return (
      <Navigate
        to="/login"
        state={{
          from: location,
          sessionExpired: isExpiry || undefined
        }}
        replace
      />
    );
  }

  return children;
}

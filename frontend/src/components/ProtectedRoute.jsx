import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield } from 'lucide-react';

export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="crypto-loader-container">
          <div className="crypto-loader-rings">
            <div className="ring ring-outer"></div>
            <div className="ring ring-middle"></div>
            <div className="ring ring-inner"></div>
            <div className="loader-core-icon">
              <Shield size={34} />
            </div>
          </div>
          <div className="crypto-loader-text">
            <h3>SecureWork Verify</h3>
            <p>Verifying Authentication Session...</p>
          </div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
}

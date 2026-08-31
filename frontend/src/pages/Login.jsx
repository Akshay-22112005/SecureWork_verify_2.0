import React, { useState } from 'react';
import { Shield, Lock, Mail, AlertCircle, ArrowRight, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Login({ onNavigate }) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      onNavigate('dashboard');
    } catch (err) {
      setError(err.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  }

  function handleQuickLogin(userEmail, userPass) {
    setEmail(userEmail);
    setPassword(userPass);
  }

  return (
    <div className="auth-container">
      <div className="glass-card auth-card">
        <div className="auth-header">
          <div className="logo-badge" style={{ margin: '0 auto 1rem auto' }}>
            <Shield size={28} />
          </div>
          <h2>Sign In to SecureWork</h2>
          <p className="text-secondary text-sm">
            Decentralized, zero-cost, tamper-evident cryptographic workforce verification.
          </p>
        </div>

        {error && (
          <div className="alert-banner danger">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label>Email Address</label>
            <div className="input-icon-wrapper">
              <Mail size={16} className="input-icon" />
              <input
                type="email"
                placeholder="name@organization.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Password</label>
            <div className="input-icon-wrapper">
              <Lock size={16} className="input-icon" />
              <input
                type="password"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button type="submit" className="action-btn primary full-width" disabled={loading}>
            {loading ? 'Authenticating...' : 'Sign In'}
            <ArrowRight size={16} />
          </button>
        </form>

        <div className="demo-accounts-box">
          <div className="demo-title">Preset Test Credentials</div>
          <div className="demo-btn-grid">
            <button 
              className="demo-btn"
              onClick={() => handleQuickLogin('admin@securework.local', 'AdminSecurePass123!')}
            >
              <strong>Admin</strong>: admin@securework.local
            </button>
            <button 
              className="demo-btn"
              onClick={() => handleQuickLogin('auditor@securework.local', 'AdminSecurePass123!')}
            >
              <strong>Auditor</strong>: auditor@securework.local
            </button>
            <button 
              className="demo-btn"
              onClick={() => handleQuickLogin('scholar@stanford.edu', 'SecureUserPass123!')}
            >
              <strong>User</strong>: scholar@stanford.edu
            </button>
          </div>
        </div>

        <div className="auth-footer">
          <span>Need an account?</span>
          <button className="link-btn" onClick={() => onNavigate('register')}>
            Create an Account
          </button>
        </div>
      </div>
    </div>
  );
}

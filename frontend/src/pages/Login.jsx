import React, { useState, useEffect } from 'react';
import { Shield, Lock, Mail, AlertCircle, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLocation, useNavigate } from 'react-router-dom';
import AnimatedBackground from '../components/AnimatedBackground';
import { getDefaultDashboard, hasRouteAccess, ROUTE_PERMISSIONS } from '../config/permissions';

function getPostLoginDestination(role, requestedPath) {
  if (!requestedPath || requestedPath === '/' || requestedPath === '/login') {
    return getDefaultDashboard(role);
  }
  if (hasRouteAccess(role, requestedPath)) return requestedPath;
  if (role === 'ADMIN') return requestedPath;

  // Preserve safe deep links (for example, /verify/:credentialId) by checking
  // the nearest configured route base against the signed-in role.
  const routeBase = Object.keys(ROUTE_PERMISSIONS)
    .filter((path) => requestedPath.startsWith(`${path}/`))
    .sort((left, right) => right.length - left.length)[0];
  if (routeBase && hasRouteAccess(role, routeBase)) return requestedPath;
  return getDefaultDashboard(role);
}

export default function Login({ onNavigate }) {
  const { login, logout, isAuthenticated, loading, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  // Pre-fill persona if redirected from persona switcher
  const preselectedPersona = location.state?.persona || null;
  const personaMismatchMsg = location.state?.personaMessage || null;
  const sessionExpiredMsg = location.state?.sessionExpired
    ? 'Your session has expired. Please sign in again.'
    : null;
  const fromPath = location.state?.from?.pathname || null;
  const prefillCredentialId = location.state?.credentialId || null;

  // Active persona tracking to ensure smooth switching with preset buttons
  const [activePersona, setActivePersona] = useState(preselectedPersona);

  // If user is already authenticated (valid session), redirect to role-specific dashboard
  useEffect(() => {
    if (!loading && isAuthenticated && user) {
      navigate(getPostLoginDestination(user.role, fromPath), { replace: true });
    }
  }, [isAuthenticated, loading, user, fromPath, navigate]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }
    setError('');
    setIsLoading(true);
    try {
      const loggedInUser = await login(email, password, rememberMe);

      // If came from persona switcher, verify role matches
      if (activePersona && loggedInUser.role !== activePersona) {
        // Role mismatch — logout and show error
        logout();
        setError(
          `This account has role "${loggedInUser.role}", but "${activePersona}" is required. ` +
          `Please sign in with a ${activePersona} account.`
        );
        setIsLoading(false);
        return;
      }

      // Navigate back to original location or role home page
      const destination = getPostLoginDestination(loggedInUser.role, fromPath);
      if (destination === fromPath && fromPath && fromPath !== '/login' && fromPath !== '/') {
        navigate(destination, {
          replace: true,
          state: prefillCredentialId ? { credentialId: prefillCredentialId, autoVerify: true } : undefined
        });
      } else {
        navigate(destination, { replace: true });
      }
    } catch (err) {
      setError(err.message || 'Invalid email or password');
    } finally {
      setIsLoading(false);
    }
  }

  function handleQuickLogin(userEmail, userPass, role) {
    setEmail(userEmail);
    setPassword(userPass);
    if (role) {
      setActivePersona(role);
    }
    setError('');
  }

  return (
    <div className="persona-theme auth-wrapper-page">
      <AnimatedBackground />
      <div className="auth-container">
        <div className="glass-card auth-card">
          <div className="auth-header">
            <div className="logo-badge" style={{ margin: '0 auto 1rem auto' }}>
              <Shield size={28} />
            </div>
            <h2>
              {activePersona
                ? `Sign In as ${activePersona}`
                : 'Sign In to SecureWork'}
            </h2>
            <p className="text-secondary text-sm">
              Decentralized, zero-cost, tamper-evident cryptographic workforce verification.
            </p>
          </div>

          {/* Session expired banner */}
          {sessionExpiredMsg && (
            <div className="alert-banner warning" style={{ marginBottom: '0.75rem' }}>
              <AlertCircle size={16} />
              <span>{sessionExpiredMsg}</span>
            </div>
          )}

          {/* Persona mismatch message */}
          {personaMismatchMsg && !error && (
            <div className="alert-banner info" style={{ marginBottom: '0.75rem' }}>
              <AlertCircle size={16} />
              <span>{personaMismatchMsg}</span>
            </div>
          )}

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
              <div className="input-icon-wrapper" style={{ position: 'relative' }}>
                <Lock size={16} className="input-icon" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  style={{ paddingRight: '2.5rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  style={{
                    position: 'absolute',
                    right: '0.75rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Remember Me checkbox */}
            <div className="form-group" style={{ flexDirection: 'row', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
              <label
                htmlFor="remember-me"
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', userSelect: 'none' }}
              >
                <input
                  id="remember-me"
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  style={{ width: '15px', height: '15px', cursor: 'pointer', accentColor: 'var(--accent-indigo)' }}
                />
                Remember me
              </label>
              <span style={{ marginLeft: 'auto', fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
                {rememberMe ? 'Persistent (localStorage)' : 'Session only'}
              </span>
            </div>

            <button type="submit" className="action-btn primary full-width" disabled={isLoading}>
              {isLoading ? 'Authenticating...' : 'Sign In'}
              <ArrowRight size={16} />
            </button>
          </form>

          <div className="demo-accounts-box">
            <div className="demo-title">Preset Test Credentials</div>
            <div className="demo-btn-grid">
              <button
                type="button"
                className="demo-btn"
                onClick={() => handleQuickLogin('admin@securework.local', 'AdminSecurePass123!', 'ADMIN')}
              >
                <strong>Admin</strong>: admin@securework.local
              </button>
              <button
                type="button"
                className="demo-btn"
                onClick={() => handleQuickLogin('issuer_auth@stanford.edu', 'SecureUserPass123!', 'ISSUER')}
              >
                <strong>Issuer</strong>: issuer_auth@stanford.edu
              </button>
              <button
                type="button"
                className="demo-btn"
                onClick={() => handleQuickLogin('hr_lead@enterprise.local', 'SecureUserPass123!', 'HR')}
              >
                <strong>HR</strong>: hr_lead@enterprise.local
              </button>
              <button
                type="button"
                className="demo-btn"
                onClick={() => handleQuickLogin('auditor@securework.local', 'AdminSecurePass123!', 'AUDITOR')}
              >
                <strong>Auditor</strong>: auditor@securework.local
              </button>
              <button
                type="button"
                className="demo-btn"
                onClick={() => handleQuickLogin('scholar@stanford.edu', 'SecureUserPass123!', 'USER')}
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
    </div>
  );
}

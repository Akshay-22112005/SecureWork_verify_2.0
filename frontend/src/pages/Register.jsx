import React, { useEffect, useState } from 'react';
import { Shield, Lock, Mail, User, AlertCircle, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import AnimatedBackground from '../components/AnimatedBackground';
import api from '../services/api';

export default function Register({ onNavigate }) {
  const { register } = useAuth();
  const searchParams = new URLSearchParams(window.location.search);
  const signedInvitationToken = searchParams.get('invite') || '';
  const invitationToken = signedInvitationToken || searchParams.get('token') || '';
  const invitedEmail = searchParams.get('email') || '';
  const [name, setName] = useState('');
  const [email, setEmail] = useState(invitedEmail);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [invitation, setInvitation] = useState(null);
  const [invitationLoading, setInvitationLoading] = useState(Boolean(signedInvitationToken));

  useEffect(() => {
    if (!signedInvitationToken) return undefined;
    let cancelled = false;
    api.auth.getInvitationDetails(signedInvitationToken)
      .then((res) => {
        if (cancelled) return;
        const details = res?.data || res;
        setInvitation(details);
        setEmail(details?.email || invitedEmail);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'This invitation is invalid or expired.');
      })
      .finally(() => { if (!cancelled) setInvitationLoading(false); });
    return () => { cancelled = true; };
  }, [signedInvitationToken]);

  async function handleSubmit(e) {
    e.preventDefault();
    if ((!invitationToken && (!name || !email)) || !password) {
      setError('Please fill in all required fields.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await register({ name, email, password, ...(invitationToken ? { invitationToken } : {}) });
      onNavigate('dashboard');
    } catch (err) {
      setError(err.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
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
          <h2>{invitationToken ? 'Accept Your Invitation' : 'Create Your Account'}</h2>
          <p className="text-secondary text-sm">
            {invitationToken ? 'Set a password to activate your organization account.' : 'Join the cryptographically verified workforce credential platform.'}
          </p>
        </div>

        {signedInvitationToken && invitation && (
          <div className="alert-banner success" role="status" style={{ marginBottom: '1rem' }}>
            You were invited to join {invitation.organizationName} as an HR Verifier.
          </div>
        )}
        {invitationLoading && <div className="text-muted text-xs" role="status">Validating your invitation…</div>}

        {error && (
          <div className="alert-banner danger">
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label>Full Name</label>
            <div className="input-icon-wrapper">
              <User size={16} className="input-icon" />
              <input
                type="text"
                placeholder="Dr. Jane Doe"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required={!invitationToken}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Work Email</label>
            <div className="input-icon-wrapper">
              <Mail size={16} className="input-icon" />
              <input
                type="email"
                placeholder="jane.doe@organization.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                readOnly={Boolean(signedInvitationToken)}
                required={!invitationToken}
              />
            </div>
          </div>

          <div className="form-group">
            <label>Password</label>
            <div className="input-icon-wrapper">
              <Lock size={16} className="input-icon" />
              <input
                type="password"
                placeholder="Minimum 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Confirm Password</label>
            <div className="input-icon-wrapper">
              <Lock size={16} className="input-icon" />
              <input
                type="password"
                placeholder="Re-type password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button type="submit" className="action-btn primary full-width" disabled={loading}>
            {loading ? 'Creating Account...' : 'Register Account'}
            <ArrowRight size={16} />
          </button>
        </form>

        <div className="auth-footer">
          <span>Already registered?</span>
          <button className="link-btn" onClick={() => onNavigate('login')}>
            Sign In Instead
          </button>
        </div>
      </div>
    </div>
  </div>
  );
}

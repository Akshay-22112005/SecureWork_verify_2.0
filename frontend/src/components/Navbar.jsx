import React, { useState } from 'react';
import { 
  Shield, 
  Bell, 
  LogOut, 
  User as UserIcon, 
  Sparkles,
  ChevronDown,
  Mail,
  Key,
  Copy,
  Check,
  ShieldCheck,
  Building,
  Menu,
  X,
  Globe
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { useNavigate } from 'react-router-dom';
import StatusBadge from './StatusBadge';
import ThemeToggle from './ThemeToggle';

export default function Navbar({ onNavigate, activePage, onToggleMobileMenu, mobileMenuOpen }) {
  const { user, role, logout, isAdmin } = useAuth();
  const { unreadCount, toggleDrawer } = useNotifications();
  const navigate = useNavigate();
  const [showProfileCard, setShowProfileCard] = useState(false);
  const [copiedField, setCopiedField] = useState(null);

  function handleCopy(text, field) {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  }

  function handleLogout() {
    logout();
    navigate('/', { replace: true });
  }

  // Quick Persona switchers for development & evaluation
  const demoPersonas = [
    { label: 'ADMIN', role: 'ADMIN', email: 'admin@securework.local' },
    { label: 'AUDITOR', role: 'AUDITOR', email: 'auditor@securework.local' },
    { label: 'ISSUER', role: 'ISSUER', email: 'issuer_auth@stanford.edu' },
    { label: 'HR', role: 'HR', email: 'hr_lead@enterprise.local' },
    { label: 'USER', role: 'USER', email: 'scholar@stanford.edu' }
  ];

  /**
   * Persona switching rules:
   * - ADMIN may switch to any persona view without re-login (they have all access).
   * - Any other role switching to a different persona must logout and go to /login
   *   with the target persona preselected and a message.
   */
  function handlePersonaSwitch(persona) {
    if (persona.role === role) {
      // Already on this persona, do nothing
      return;
    }

    if (isAdmin) {
      // ADMIN can view any persona view without re-login.
      // For now we just show a note – in practice ADMIN sees all sidebar sections already.
      // Navigate to dashboard to refresh the view.
      navigate('/dashboard');
      return;
    }

    // Non-admin switching persona: logout and redirect to login with persona preselected
    logout();
    navigate('/login', {
      replace: true,
      state: {
        persona: persona.role,
        personaMessage: `Please sign in as a ${persona.label} to continue.`
      }
    });
  }

  return (
    <nav className="top-nav">
      <div className="nav-left-cluster">
        {/* Mobile Hamburger Menu Button */}
        <button 
          className="mobile-hamburger-btn" 
          onClick={onToggleMobileMenu}
          title="Toggle Navigation Menu"
          aria-label="Toggle Navigation Menu"
        >
          {mobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        <div className="brand-logo" onClick={() => onNavigate('dashboard')} style={{ cursor: 'pointer' }}>
          <div className="logo-badge">
            <Shield size={20} />
          </div>
          <div>
            <div className="brand-name">
              SecureWork Verify
              <span className="brand-tag">v1.0 Production</span>
            </div>
          </div>
        </div>
      </div>

      <div className="nav-right-cluster">
        {/* Quick Persona Switcher */}
        <div className="persona-selector">
          <span className="persona-title"><Sparkles size={13} /> Persona:</span>
          {demoPersonas.map((p) => (
            <button
              key={p.role}
              className={`persona-pill ${role === p.role ? 'active' : ''}`}
              onClick={() => handlePersonaSwitch(p)}
              title={
                isAdmin
                  ? `View as ${p.role} (ADMIN access)`
                  : role === p.role
                    ? `Current role: ${p.role}`
                    : `Switch to ${p.role} — will require login`
              }
            >
              {p.label}
            </button>
          ))}
        </div>

        {/* Public Landing / Verification Portal Shortcut */}
        <button 
          className="btn btn-ghost btn-xs"
          onClick={() => onNavigate('landing')}
          title="Go to Public Landing Page"
        >
          <Globe size={14} />
          <span>Public Portal</span>
        </button>

        {/* Dark/Light Theme Toggle */}
        <ThemeToggle size="sm" />

        {/* In-App Notification Bell */}
        <button 
          className="icon-action-btn notif-bell-btn" 
          onClick={toggleDrawer}
          title="In-App Notifications"
        >
          <Bell size={18} />
          {unreadCount > 0 && <span className="bell-badge">{unreadCount > 9 ? '9+' : unreadCount}</span>}
        </button>

        {/* User Info & Role Badge with Rich Hover Profile Card */}
        {user ? (
          <div 
            className="user-profile-wrapper"
            onMouseEnter={() => setShowProfileCard(true)}
            onMouseLeave={() => setShowProfileCard(false)}
          >
            <div className="user-profile-badge">
              <div className="user-avatar">
                <UserIcon size={16} />
              </div>
              <div className="user-info-text">
                <span className="user-name">{user.name || user.email}</span>
                <StatusBadge status={user.role} label={user.role} className="user-role-tag" />
              </div>
              <button 
                className="logout-btn" 
                onClick={(e) => {
                  e.stopPropagation();
                  handleLogout();
                }} 
                title="Sign Out"
              >
                <LogOut size={16} />
              </button>
            </div>

            {/* Hover Profile Popover Card */}
            <div className={`user-hover-card ${showProfileCard ? 'visible' : ''}`}>
              <div className="hover-card-header">
                <div className="hover-card-avatar">
                  <UserIcon size={22} />
                </div>
                <div className="hover-card-title-group">
                  <div className="hover-card-name">{user.name || 'Verified User'}</div>
                  <div className="hover-card-role-row">
                    <StatusBadge status={user.role} label={user.role} />
                    <span className="hover-status-pill active">
                      <span className="status-live-pulse"></span> Active
                    </span>
                  </div>
                </div>
              </div>

              <div className="hover-card-divider"></div>

              <div className="hover-card-details">
                <div className="hover-detail-item">
                  <span className="hover-detail-label">
                    <Mail size={12} /> Email Address
                  </span>
                  <div className="hover-copy-row">
                    <span className="hover-detail-value">{user.email}</span>
                    <button 
                      className="icon-action-btn hover-copy-btn" 
                      onClick={() => handleCopy(user.email, 'email')}
                      title="Copy Email"
                    >
                      {copiedField === 'email' ? <Check size={12} className="text-success" /> : <Copy size={12} />}
                    </button>
                  </div>
                </div>

                <div className="hover-detail-item">
                  <span className="hover-detail-label">
                    <Key size={12} /> Subject User ID
                  </span>
                  <div className="hover-copy-row">
                    <span className="code-snippet text-xs">{user.userId || 'N/A'}</span>
                    <button 
                      className="icon-action-btn hover-copy-btn" 
                      onClick={() => handleCopy(user.userId, 'userId')}
                      title="Copy User ID"
                    >
                      {copiedField === 'userId' ? <Check size={12} className="text-success" /> : <Copy size={12} />}
                    </button>
                  </div>
                </div>

                <div className="hover-detail-item">
                  <span className="hover-detail-label">
                    <ShieldCheck size={12} /> Trust & Session State
                  </span>
                  <span className="text-success text-xs" style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <ShieldCheck size={13} /> Authenticated Session (HMAC-SHA256)
                  </span>
                </div>
              </div>

              <div className="hover-card-footer">
                <button 
                  className="action-btn secondary text-xs full-width" 
                  onClick={handleLogout}
                  style={{ display: 'flex', justifyContent: 'center', gap: '0.4rem' }}
                >
                  <LogOut size={13} /> Sign Out
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="auth-btn-row" style={{ display: 'flex', gap: '0.5rem' }}>
            <button className="action-btn secondary text-xs" onClick={() => onNavigate('login')}>
              Sign In
            </button>
            <button className="action-btn primary text-xs" onClick={() => onNavigate('register')}>
              Create Account
            </button>
          </div>
        )}
      </div>
    </nav>
  );
}

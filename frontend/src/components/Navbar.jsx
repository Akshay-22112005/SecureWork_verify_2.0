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
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import StatusBadge from './StatusBadge';

export default function Navbar({ onNavigate, activePage, onToggleMobileMenu, mobileMenuOpen }) {
  const { user, role, logout, login } = useAuth();
  const { unreadCount, toggleDrawer } = useNotifications();
  const [showProfileCard, setShowProfileCard] = useState(false);
  const [copiedField, setCopiedField] = useState(null);

  function handleCopy(text, field) {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  }

  // Quick Persona switchers for development & evaluation
  const demoPersonas = [
    { label: 'ADMIN', email: 'admin@securework.local', role: 'ADMIN' },
    { label: 'AUDITOR', email: 'auditor@securework.local', role: 'AUDITOR' },
    { label: 'ISSUER', email: 'issuer_auth@stanford.edu', role: 'ISSUER' },
    { label: 'HR', email: 'hr_lead@enterprise.local', role: 'HR' },
    { label: 'USER', email: 'scholar@stanford.edu', role: 'USER' }
  ];

  async function handleQuickSwitch(persona) {
    try {
      if (persona.role === 'ADMIN') {
        await login('admin@securework.local', 'AdminSecurePass123!');
      } else {
        await login(persona.email, 'SecureUserPass123!');
      }
    } catch {
      try {
        await login(persona.email, 'AdminSecurePass123!');
      } catch (e) {
        console.warn('Persona switch failed', e);
      }
    }
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
        {/* Quick Persona Switcher for Evaluation */}
        <div className="persona-selector">
          <span className="persona-title"><Sparkles size={13} /> Persona:</span>
          {demoPersonas.map((p) => (
            <button
              key={p.role}
              className={`persona-pill ${role === p.role ? 'active' : ''}`}
              onClick={() => handleQuickSwitch(p)}
              title={`Switch active session to ${p.role}`}
            >
              {p.label}
            </button>
          ))}
        </div>

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
                  logout();
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
                  onClick={logout}
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

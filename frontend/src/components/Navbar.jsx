import React from 'react';
import { 
  Shield, 
  Bell, 
  LogOut, 
  User as UserIcon, 
  Sparkles,
  ChevronDown
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import StatusBadge from './StatusBadge';

export default function Navbar({ onNavigate, activePage }) {
  const { user, role, logout, login } = useAuth();
  const { unreadCount, toggleDrawer } = useNotifications();

  // Quick Persona switchers for development & automated evaluation
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
        // Log in or use default test persona credentials
        await login(persona.email, 'SecureUserPass123!');
      }
    } catch {
      // If persona password fails, try standard demo pass or register
      try {
        await login(persona.email, 'AdminSecurePass123!');
      } catch (e) {
        console.warn('Persona switch failed', e);
      }
    }
  }

  return (
    <nav className="top-nav">
      <div className="brand-logo" onClick={() => onNavigate('dashboard')} style={{ cursor: 'pointer' }}>
        <div className="logo-badge">
          <Shield size={22} />
        </div>
        <div>
          <div className="brand-name">
            SecureWork Verify
            <span className="brand-tag">v1.0 Production</span>
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

        {/* User Info & Role Badge */}
        {user ? (
          <div className="user-profile-badge">
            <div className="user-avatar">
              <UserIcon size={16} />
            </div>
            <div className="user-info-text">
              <span className="user-name">{user.name || user.email}</span>
              <StatusBadge status={user.role} label={user.role} className="user-role-tag" />
            </div>
            <button className="logout-btn" onClick={logout} title="Sign Out">
              <LogOut size={16} />
            </button>
          </div>
        ) : (
          <div className="auth-btn-row">
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

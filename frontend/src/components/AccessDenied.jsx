import React from 'react';
import { ShieldAlert, LayoutDashboard, ShieldCheck, LogIn, UserPlus, Lock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import StatusBadge from './StatusBadge';

export default function AccessDenied({ targetPage, requiredRoles = [], onNavigate }) {
  const { user, role, isAuthenticated } = useAuth();
  const isUnauthenticated = !isAuthenticated || role === 'GUEST';

  return (
    <div className="page-content" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '65vh' }}>
      <div className="glass-card" style={{ maxWidth: '580px', width: '100%', padding: '2.5rem', textAlign: 'center', border: `1px solid ${isUnauthenticated ? 'rgba(234, 179, 8, 0.3)' : 'rgba(239, 68, 68, 0.3)'}` }}>
        <div 
          style={{ 
            width: '64px', 
            height: '64px', 
            borderRadius: '50%', 
            background: isUnauthenticated ? 'rgba(234, 179, 8, 0.15)' : 'rgba(239, 68, 68, 0.15)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            margin: '0 auto 1.5rem auto',
            color: isUnauthenticated ? 'var(--accent-amber, #eab308)' : 'var(--accent-red, #ef4444)' 
          }}
        >
          {isUnauthenticated ? <Lock size={34} /> : <ShieldAlert size={34} />}
        </div>

        <span 
          className="section-eyebrow-badge" 
          style={{ 
            borderColor: isUnauthenticated ? 'rgba(234, 179, 8, 0.4)' : 'rgba(239, 68, 68, 0.4)', 
            color: isUnauthenticated ? '#facc15' : '#f87171' 
          }}
        >
          {isUnauthenticated ? '401 UNAUTHORIZED • AUTHENTICATION REQUIRED' : '403 FORBIDDEN • RBAC ACCESS RESTRICTION'}
        </span>

        <h2 style={{ fontSize: '1.6rem', margin: '0.75rem 0 0.5rem 0', color: 'var(--text-primary)' }}>
          {isUnauthenticated ? 'Authentication Required' : 'Access Restricted'}
        </h2>

        <p style={{ color: 'var(--text-secondary)', fontSize: '0.92rem', lineHeight: '1.5', marginBottom: '1.5rem' }}>
          {isUnauthenticated ? (
            <>
              This portal section is protected and requires an active, authenticated persona session.
              Please sign in to access your dashboard, or use public verification without signing in.
            </>
          ) : (
            <>
              Based on <strong>Role-Based Access Control (RBAC)</strong> policies, your active role 
              (<strong className="text-cyan">{role}</strong>) does not have sufficient permissions to access this section.
            </>
          )}
        </p>

        <div 
          style={{ 
            background: 'rgba(15, 23, 42, 0.6)', 
            borderRadius: '8px', 
            padding: '1rem', 
            marginBottom: '1.75rem', 
            textAlign: 'left',
            border: '1px solid var(--border-subtle)'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Target Section:</span>
            <span className="code-snippet text-xs">{targetPage}</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Your Current Status:</span>
            <StatusBadge status={role || 'GUEST'} label={role || 'GUEST'} />
          </div>

          {requiredRoles && requiredRoles.length > 0 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Required Role(s):</span>
              <div style={{ display: 'flex', gap: '4px' }}>
                {requiredRoles.map((r) => (
                  <span key={r} className="level-badge" style={{ fontSize: '0.7rem' }}>{r}</span>
                ))}
              </div>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          {isUnauthenticated ? (
            <>
              <button 
                className="action-btn primary text-xs" 
                onClick={() => onNavigate('login')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <LogIn size={14} />
                Sign In
              </button>

              <button 
                className="action-btn secondary text-xs" 
                onClick={() => onNavigate('verify_document')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <ShieldCheck size={14} />
                Public Verification (No Login)
              </button>

              <button 
                className="action-btn text-xs" 
                onClick={() => onNavigate('register')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', border: '1px solid var(--border-subtle)' }}
              >
                <UserPlus size={14} />
                Create Account
              </button>
            </>
          ) : (
            <>
              <button 
                className="action-btn primary text-xs" 
                onClick={() => onNavigate('dashboard')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <LayoutDashboard size={14} />
                Return to Dashboard
              </button>

              <button 
                className="action-btn secondary text-xs" 
                onClick={() => onNavigate('verify_document')}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <ShieldCheck size={14} />
                Public Verification
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

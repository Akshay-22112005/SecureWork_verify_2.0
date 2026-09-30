import React, { useState, useEffect } from 'react';
import { Users, Shield, RefreshCw, AlertCircle, CheckCircle2, UserCheck } from 'lucide-react';
import api from '../services/api';
import StatusBadge from '../components/StatusBadge';

export default function AdminUsers({ onNavigate }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function loadUsers() {
    setLoading(true);
    try {
      const res = await api.users.list({ limit: 50 });
      if (res && res.success) {
        setUsers(res.data.users || []);
      }
    } catch (err) {
      console.warn('Failed to load users', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function handleRoleChange(userId, newRole) {
    setUpdatingId(userId);
    setMessage('');
    setError('');
    try {
      const res = await api.users.updateRole(userId, newRole);
      if (res && res.success) {
        setMessage(`User ${userId} promoted to ${newRole}.`);
        setUsers((prev) => prev.map((u) => (u.userId === userId ? { ...u, role: newRole } : u)));
      }
    } catch (err) {
      setError(err.message || 'Failed to update user role');
    } finally {
      setUpdatingId(null);
    }
  }

  return (
    <div className="page-content">
      {/* Admin Governance Flow Banner */}
      {onNavigate && (
        <div className="glass-card" style={{ padding: '0.75rem 1.25rem', marginBottom: '1.25rem', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(139, 92, 246, 0.25)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.8rem' }}>
            <span className="text-muted" style={{ fontWeight: 700 }}>ADMIN FLOW:</span>
            <span style={{ cursor: 'pointer', color: 'var(--accent-purple)' }} onClick={() => onNavigate('dashboard')}>Admin Dashboard</span>
            <span className="text-muted">→</span>
            <strong style={{ color: 'var(--accent-cyan)', textDecoration: 'underline' }}>Users & RBAC (Step 1)</strong>
            <span className="text-muted">→</span>
            <span style={{ cursor: 'pointer', color: 'var(--accent-blue)' }} onClick={() => onNavigate('admin_organizations')}>Organizations</span>
            <span className="text-muted">→</span>
            <span style={{ cursor: 'pointer', color: 'var(--accent-purple)' }} onClick={() => onNavigate('admin_issuers')}>Issuers</span>
            <span className="text-muted">→</span>
            <span style={{ cursor: 'pointer', color: 'var(--accent-cyan)' }} onClick={() => onNavigate('admin_trusted_sources')}>Trusted Sources</span>
            <span className="text-muted">→</span>
            <span style={{ cursor: 'pointer', color: '#10b981' }} onClick={() => onNavigate('admin_settings')}>System Health</span>
          </div>
        </div>
      )}

      <div className="page-header">
        <div>
          <h2>User Directory & RBAC Governance</h2>
          <p className="page-subtitle">
            Authoritative identity registry and role-based access control management.
          </p>
        </div>
        <button className="action-btn secondary text-xs" onClick={loadUsers} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'pulse-dot' : ''} /> Refresh
        </button>
      </div>

      {message && (
        <div className="alert-banner success" style={{ marginBottom: '1rem' }}>
          <CheckCircle2 size={16} />
          <span>{message}</span>
        </div>
      )}

      {error && (
        <div className="alert-banner danger" style={{ marginBottom: '1rem' }}>
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      <div className="glass-card table-container">
        {loading ? (
          <div className="empty-state">Loading users...</div>
        ) : users.length === 0 ? (
          <div className="empty-state">
            <Users size={36} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
            <p>No registered users found.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>User ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Current Role</th>
                <th>Registered</th>
                <th>Modify Role (RBAC)</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.userId}>
                  <td className="code-snippet">{u.userId}</td>
                  <td><strong>{u.name}</strong></td>
                  <td>{u.email}</td>
                  <td><StatusBadge status={u.role} /></td>
                  <td className="text-muted text-xs">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td>
                    <select
                      className="select-input select-compact"
                      value={u.role}
                      disabled={updatingId === u.userId}
                      onChange={(e) => handleRoleChange(u.userId, e.target.value)}
                    >
                      <option value="USER">USER</option>
                      <option value="ISSUER">ISSUER</option>
                      <option value="HR">HR</option>
                      <option value="AUDITOR">AUDITOR</option>
                      <option value="ADMIN">ADMIN</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Admin Governance Navigation Footer */}
      {onNavigate && (
        <div className="glass-card" style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <span className="text-muted text-xs">Admin Governance Workflow: Step 1 of 5 (User Directory & RBAC Governance)</span>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button 
              className="action-btn secondary text-xs" 
              onClick={() => onNavigate('dashboard')}
            >
              ← Back to Admin Dashboard
            </button>
            <button 
              className="action-btn primary text-xs"
              onClick={() => onNavigate('admin_organizations')}
            >
              Next: Organizations & Trust Governance →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

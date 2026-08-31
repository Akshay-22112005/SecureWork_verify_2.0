import React, { useState, useEffect } from 'react';
import { Users, Shield, RefreshCw, AlertCircle, CheckCircle2, UserCheck } from 'lucide-react';
import api from '../services/api';
import StatusBadge from '../components/StatusBadge';

export default function AdminUsers() {
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
    </div>
  );
}

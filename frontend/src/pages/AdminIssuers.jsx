import React, { useState, useEffect } from 'react';
import { FileBadge, ShieldCheck, CheckCircle2, AlertTriangle, RefreshCw, X } from 'lucide-react';
import api from '../services/api';
import StatusBadge from '../components/StatusBadge';

export default function AdminIssuers({ onNavigate }) {
  const [issuers, setIssuers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function loadIssuers() {
    setLoading(true);
    try {
      const res = await api.issuers.list();
      if (res && res.success) {
        setIssuers(res.data.issuers || []);
      }
    } catch (err) {
      console.warn('Failed to load issuers', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadIssuers();
  }, []);

  async function handleApprove(issuerId) {
    if (!confirm('Approve this issuer profile? Sponsoring organization must be VERIFIED.')) return;
    setMessage('');
    setError('');
    try {
      const res = await api.issuers.approve(issuerId);
      if (res && res.success) {
        setMessage(`Issuer ${issuerId} approved and accredited.`);
        loadIssuers();
      }
    } catch (err) {
      setError(err.message || 'Failed to approve issuer');
    }
  }

  async function handleSuspend(issuerId) {
    const reason = prompt('Enter suspension reason:', 'Issuer compliance audit pending');
    if (!reason) return;
    try {
      const res = await api.issuers.suspend(issuerId, reason);
      if (res && res.success) {
        setMessage(`Issuer ${issuerId} suspended.`);
        loadIssuers();
      }
    } catch (err) {
      alert(err.message || 'Failed to suspend issuer');
    }
  }

  async function handleRevoke(issuerId) {
    const reason = prompt('Enter revocation reason (irreversible accreditation revocation):', 'Revocation of accreditation');
    if (!reason) return;
    try {
      const res = await api.issuers.revoke(issuerId, reason);
      if (res && res.success) {
        setMessage(`Issuer ${issuerId} revoked.`);
        loadIssuers();
      }
    } catch (err) {
      alert(err.message || 'Failed to revoke issuer');
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
            <span style={{ cursor: 'pointer', color: 'var(--accent-cyan)' }} onClick={() => onNavigate('admin_users')}>Users</span>
            <span className="text-muted">→</span>
            <span style={{ cursor: 'pointer', color: 'var(--accent-blue)' }} onClick={() => onNavigate('admin_organizations')}>Organizations</span>
            <span className="text-muted">→</span>
            <strong style={{ color: 'var(--accent-purple)', textDecoration: 'underline' }}>Issuer Accreditation (Step 3)</strong>
            <span className="text-muted">→</span>
            <span style={{ cursor: 'pointer', color: 'var(--accent-cyan)' }} onClick={() => onNavigate('admin_trusted_sources')}>Trusted Sources</span>
            <span className="text-muted">→</span>
            <span style={{ cursor: 'pointer', color: '#10b981' }} onClick={() => onNavigate('admin_settings')}>System Health</span>
          </div>
        </div>
      )}

      <div className="page-header">
        <div>
          <h2>Issuer Accreditation & Approval Workflow</h2>
          <p className="page-subtitle">
            Review and govern institutional signing authority profiles and authorization mandates.
          </p>
        </div>
        <button className="action-btn secondary text-xs" onClick={loadIssuers} disabled={loading}>
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
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      <div className="glass-card table-container">
        {loading ? (
          <div className="empty-state">Loading issuers...</div>
        ) : issuers.length === 0 ? (
          <div className="empty-state">
            <FileBadge size={36} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
            <p>No issuer profiles registered.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Issuer ID</th>
                <th>Issuer Code</th>
                <th>Organization ID</th>
                <th>User Profile</th>
                <th>Status</th>
                <th>Approved By</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {issuers.map((i) => (
                <tr key={i.issuerId}>
                  <td className="code-snippet">{i.issuerId}</td>
                  <td><strong>{i.issuerCode}</strong></td>
                  <td className="code-snippet text-muted">{i.organizationId}</td>
                  <td className="code-snippet text-muted">{i.userId}</td>
                  <td><StatusBadge status={i.status} /></td>
                  <td className="text-muted text-xs">{i.approvedBy || 'Pending'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      {i.status !== 'ACTIVE' && i.status !== 'REVOKED' && (
                        <button
                          className="action-btn primary text-xs"
                          onClick={() => handleApprove(i.issuerId)}
                          style={{ padding: '0.2rem 0.5rem' }}
                        >
                          Approve
                        </button>
                      )}
                      {i.status === 'ACTIVE' && (
                        <button
                          className="action-btn secondary text-xs"
                          onClick={() => handleSuspend(i.issuerId)}
                          style={{ padding: '0.2rem 0.5rem' }}
                        >
                          Suspend
                        </button>
                      )}
                      {i.status !== 'REVOKED' && (
                        <button
                          className="action-btn danger text-xs"
                          onClick={() => handleRevoke(i.issuerId)}
                          style={{ padding: '0.2rem 0.5rem' }}
                        >
                          Revoke
                        </button>
                      )}
                    </div>
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
            <span className="text-muted text-xs">Admin Governance Workflow: Step 3 of 5 (Issuer Accreditation & Approvals)</span>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button 
              className="action-btn secondary text-xs" 
              onClick={() => onNavigate('admin_organizations')}
            >
              ← Back to Organizations
            </button>
            <button 
              className="action-btn primary text-xs"
              onClick={() => onNavigate('admin_trusted_sources')}
            >
              Next: Trusted Sources (SSRF Safe) →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { Building, ShieldCheck, CheckCircle2, AlertTriangle, RefreshCw, Plus, X } from 'lucide-react';
import api from '../services/api';
import StatusBadge from '../components/StatusBadge';

export default function AdminOrganizations({ onNavigate }) {
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [name, setName] = useState('');
  const [type, setType] = useState('UNIVERSITY');
  const [officialDomain, setOfficialDomain] = useState('');
  const [organizationCode, setOrganizationCode] = useState('');

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function loadOrganizations() {
    setLoading(true);
    try {
      const res = await api.organizations.list({ limit: 50 });
      if (res && res.success) {
        setOrganizations(res.data.organizations || []);
      }
    } catch (err) {
      console.warn('Failed to load organizations', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadOrganizations();
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      const res = await api.organizations.create({
        name,
        type,
        officialDomain,
        organizationCode: organizationCode || `ORG_${Date.now()}`
      });
      if (res && res.success) {
        setMessage(`Organization "${name}" created successfully.`);
        setShowCreateModal(false);
        setName('');
        setOfficialDomain('');
        setOrganizationCode('');
        loadOrganizations();
      }
    } catch (err) {
      setError(err.message || 'Failed to create organization');
    }
  }

  async function handleVerify(orgId) {
    if (!confirm('Verify and accredit this organization? Member issuers will become eligible for accreditation.')) return;
    try {
      const res = await api.organizations.verify(orgId);
      if (res && res.success) {
        setMessage(`Organization ${orgId} verified successfully.`);
        loadOrganizations();
      }
    } catch (err) {
      alert(err.message || 'Failed to verify organization');
    }
  }

  async function handleSuspend(orgId) {
    const reason = prompt('Enter suspension reason:', 'Administrative compliance review');
    if (!reason) return;
    try {
      const res = await api.organizations.suspend(orgId, reason);
      if (res && res.success) {
        setMessage(`Organization ${orgId} suspended.`);
        loadOrganizations();
      }
    } catch (err) {
      alert(err.message || 'Failed to suspend organization');
    }
  }

  async function handleRevoke(orgId) {
    const reason = prompt('Enter revocation reason (irreversible accreditation revocation):', 'Revocation of accreditation');
    if (!reason) return;
    try {
      const res = await api.organizations.revoke(orgId, reason);
      if (res && res.success) {
        setMessage(`Organization ${orgId} revoked.`);
        loadOrganizations();
      }
    } catch (err) {
      alert(err.message || 'Failed to revoke organization');
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
            <strong style={{ color: 'var(--accent-blue)', textDecoration: 'underline' }}>Organizations & Trust (Step 2)</strong>
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
          <h2>Organization Registry & Institutional Trust</h2>
          <p className="page-subtitle">
            Accreditation governance for universities, enterprises, and certification authorities.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="action-btn primary text-xs" onClick={() => setShowCreateModal(true)}>
            <Plus size={14} /> Register Organization
          </button>
          <button className="action-btn secondary text-xs" onClick={loadOrganizations} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'pulse-dot' : ''} /> Refresh
          </button>
        </div>
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
          <div className="empty-state">Loading organizations...</div>
        ) : organizations.length === 0 ? (
          <div className="empty-state">
            <Building size={36} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
            <p>No organizations registered yet.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Organization ID</th>
                <th>Name</th>
                <th>Type</th>
                <th>Official Domain</th>
                <th>Trust Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {organizations.map((org) => (
                <tr key={org.organizationId}>
                  <td className="code-snippet">{org.organizationId}</td>
                  <td><strong>{org.name}</strong></td>
                  <td><span className="badge-tag">{org.type}</span></td>
                  <td>{org.officialDomain}</td>
                  <td><StatusBadge status={org.organizationVerificationStatus} /></td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      {org.organizationVerificationStatus !== 'VERIFIED' && org.organizationVerificationStatus !== 'REVOKED' && (
                        <button 
                          className="action-btn primary text-xs"
                          onClick={() => handleVerify(org.organizationId)}
                          style={{ padding: '0.2rem 0.5rem' }}
                        >
                          Verify
                        </button>
                      )}
                      {org.organizationVerificationStatus === 'VERIFIED' && (
                        <button 
                          className="action-btn secondary text-xs"
                          onClick={() => handleSuspend(org.organizationId)}
                          style={{ padding: '0.2rem 0.5rem' }}
                        >
                          Suspend
                        </button>
                      )}
                      {org.organizationVerificationStatus !== 'REVOKED' && (
                        <button 
                          className="action-btn danger text-xs"
                          onClick={() => handleRevoke(org.organizationId)}
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

      {/* Create Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>Register New Organization</h3>
              <button className="close-btn" onClick={() => setShowCreateModal(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleCreate}>
                <div className="form-group">
                  <label>Organization Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Stanford University"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Organization Type</label>
                  <select
                    className="select-input"
                    value={type}
                    onChange={(e) => setType(e.target.value)}
                  >
                    <option value="UNIVERSITY">UNIVERSITY</option>
                    <option value="COMPANY">COMPANY</option>
                    <option value="CERTIFICATION_BODY">CERTIFICATION_BODY</option>
                    <option value="GOVERNMENT">GOVERNMENT</option>
                    <option value="INSTITUTION">INSTITUTION</option>
                    <option value="OTHER">OTHER</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Official Domain</label>
                  <input
                    type="text"
                    placeholder="e.g. stanford.edu"
                    value={officialDomain}
                    onChange={(e) => setOfficialDomain(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Organization Code (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. STANFORD"
                    value={organizationCode}
                    onChange={(e) => setOrganizationCode(e.target.value)}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                  <button type="button" className="action-btn secondary text-xs" onClick={() => setShowCreateModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="action-btn primary text-xs">
                    Create Organization
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* Admin Governance Navigation Footer */}
      {onNavigate && (
        <div className="glass-card" style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <span className="text-muted text-xs">Admin Governance Workflow: Step 2 of 5 (Organizations & Institutional Trust)</span>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button 
              className="action-btn secondary text-xs" 
              onClick={() => onNavigate('admin_users')}
            >
              ← Back to Users Directory
            </button>
            <button 
              className="action-btn primary text-xs"
              onClick={() => onNavigate('admin_issuers')}
            >
              Next: Issuer Accreditation →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

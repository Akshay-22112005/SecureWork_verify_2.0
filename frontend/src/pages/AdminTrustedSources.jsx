import React, { useState, useEffect } from 'react';
import { Link2, ShieldCheck, Plus, RefreshCw, X, AlertTriangle, CheckCircle2 } from 'lucide-react';
import api from '../services/api';
import StatusBadge from '../components/StatusBadge';

export default function AdminTrustedSources({ onNavigate }) {
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);

  const [sourceCode, setSourceCode] = useState('');
  const [name, setName] = useState('');
  const [organizationId, setOrganizationId] = useState('');
  const [sourceType, setSourceType] = useState('VERIFICATION_PORTAL');
  const [baseUrl, setBaseUrl] = useState('');
  const [verificationEndpoint, setVerificationEndpoint] = useState('');
  const [domain, setDomain] = useState('');

  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function loadSources() {
    setLoading(true);
    try {
      const res = await api.trustedSources.list();
      if (res && res.success) {
        setSources(res.data.sources || []);
      }
    } catch (err) {
      console.warn('Failed to load trusted sources', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSources();
  }, []);

  async function handleRegisterSource(e) {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      const res = await api.trustedSources.register({
        sourceCode: sourceCode.toUpperCase().trim(),
        name: name.trim(),
        organizationId: organizationId.trim(),
        sourceType,
        baseUrl: baseUrl.trim(),
        verificationEndpoint: verificationEndpoint.trim(),
        domain: domain.toLowerCase().trim()
      });
      if (res && res.success) {
        setMessage(`Trusted source ${sourceCode} registered.`);
        setShowCreateModal(false);
        setSourceCode('');
        setName('');
        setOrganizationId('');
        setBaseUrl('');
        setVerificationEndpoint('');
        setDomain('');
        loadSources();
      }
    } catch (err) {
      setError(err.message || 'Failed to register source');
    }
  }

  async function handleApprove(sourceId) {
    try {
      const res = await api.trustedSources.approve(sourceId);
      if (res && res.success) {
        setMessage(`Source ${sourceId} approved.`);
        loadSources();
      }
    } catch (err) {
      alert(err.message || 'Failed to approve source');
    }
  }

  async function handleSuspend(sourceId) {
    const reason = prompt('Enter suspension reason:', 'Source endpoint maintenance');
    if (!reason) return;
    try {
      const res = await api.trustedSources.suspend(sourceId, reason);
      if (res && res.success) {
        setMessage(`Source ${sourceId} suspended.`);
        loadSources();
      }
    } catch (err) {
      alert(err.message || 'Failed to suspend source');
    }
  }

  async function handleRevoke(sourceId) {
    const reason = prompt('Enter revocation reason (irreversible):', 'Permanent decommissioning');
    if (!reason) return;
    try {
      const res = await api.trustedSources.revoke(sourceId, reason);
      if (res && res.success) {
        setMessage(`Source ${sourceId} revoked.`);
        loadSources();
      }
    } catch (err) {
      alert(err.message || 'Failed to revoke source');
    }
  }

  async function handleVerifyDomain(sourceId) {
    try {
      const res = await api.trustedSources.verifyDomain(sourceId);
      if (res && res.success) {
        setMessage(`SSRF Domain validation passed for ${sourceId} (${res.data?.domain}).`);
        loadSources();
      }
    } catch (err) {
      alert(err.message || 'Domain validation failed');
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
            <span style={{ cursor: 'pointer', color: 'var(--accent-purple)' }} onClick={() => onNavigate('admin_issuers')}>Issuers</span>
            <span className="text-muted">→</span>
            <strong style={{ color: 'var(--accent-cyan)', textDecoration: 'underline' }}>Trusted Sources (Step 4)</strong>
            <span className="text-muted">→</span>
            <span style={{ cursor: 'pointer', color: '#10b981' }} onClick={() => onNavigate('admin_settings')}>System Health</span>
          </div>
        </div>
      )}

      <div className="page-header">
        <div>
          <h2>Whitelisted Trusted Sources (SSRF Protection)</h2>
          <p className="page-subtitle">
            Administered registry of official verification endpoints. Prevents arbitrary crawling and SSRF attacks.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="action-btn primary text-xs" onClick={() => setShowCreateModal(true)}>
            <Plus size={14} /> Register Source
          </button>
          <button className="action-btn secondary text-xs" onClick={loadSources} disabled={loading}>
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
          <div className="empty-state">Loading sources...</div>
        ) : sources.length === 0 ? (
          <div className="empty-state">
            <Link2 size={36} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
            <p>No trusted sources registered.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Source Code</th>
                <th>Name</th>
                <th>Type</th>
                <th>Domain</th>
                <th>Endpoint</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sources.map((s) => (
                <tr key={s.sourceCode}>
                  <td className="code-snippet">{s.sourceCode}</td>
                  <td><strong>{s.name}</strong></td>
                  <td><span className="badge-tag">{s.sourceType}</span></td>
                  <td>{s.domain}</td>
                  <td className="code-snippet text-muted">{s.verificationEndpoint}</td>
                  <td><StatusBadge status={s.status} /></td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      {s.status !== 'ACTIVE' && (
                        <button
                          className="action-btn primary text-xs"
                          onClick={() => handleApprove(s.sourceCode || s._id)}
                          style={{ padding: '0.2rem 0.5rem' }}
                        >
                          Approve
                        </button>
                      )}
                      {s.status === 'ACTIVE' && (
                        <button
                          className="action-btn secondary text-xs"
                          onClick={() => handleSuspend(s.sourceCode || s._id)}
                          style={{ padding: '0.2rem 0.5rem' }}
                        >
                          Suspend
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

      {/* Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <h3>Register Trusted Source</h3>
              <button className="close-btn" onClick={() => setShowCreateModal(false)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <form onSubmit={handleRegisterSource}>
                <div className="form-group">
                  <label>Source Code (Unique Identifier)</label>
                  <input
                    type="text"
                    placeholder="e.g. STANFORD_REGISTRY"
                    value={sourceCode}
                    onChange={(e) => setSourceCode(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Display Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Stanford University Official Registry"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Sponsoring Organization ID</label>
                  <input
                    type="text"
                    placeholder="org_..."
                    value={organizationId}
                    onChange={(e) => setOrganizationId(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Source Type</label>
                  <select
                    className="select-input"
                    value={sourceType}
                    onChange={(e) => setSourceType(e.target.value)}
                  >
                    <option value="VERIFICATION_PORTAL">VERIFICATION_PORTAL</option>
                    <option value="API">API</option>
                    <option value="OFFICIAL_WEBSITE">OFFICIAL_WEBSITE</option>
                    <option value="DOCUMENT_REPOSITORY">DOCUMENT_REPOSITORY</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Domain (Whitelisted)</label>
                  <input
                    type="text"
                    placeholder="e.g. stanford.edu"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Base URL</label>
                  <input
                    type="url"
                    placeholder="https://verify.stanford.edu"
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label>Verification Endpoint</label>
                  <input
                    type="text"
                    placeholder="/api/v1/verify"
                    value={verificationEndpoint}
                    onChange={(e) => setVerificationEndpoint(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                  <button type="button" className="action-btn secondary text-xs" onClick={() => setShowCreateModal(false)}>
                    Cancel
                  </button>
                  <button type="submit" className="action-btn primary text-xs">
                    Register Source
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

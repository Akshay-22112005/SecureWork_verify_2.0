import React, { useState, useEffect } from 'react';
import { Award, ShieldCheck, Eye, RefreshCw, X, Calendar, Key, FileText } from 'lucide-react';
import api from '../services/api';
import StatusBadge from '../components/StatusBadge';

export default function MyCredentials({ onNavigate }) {
  const [credentials, setCredentials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCred, setSelectedCred] = useState(null);

  async function loadCredentials() {
    setLoading(true);
    try {
      const res = await api.credentials.list({ limit: 50 });
      if (res && res.success) {
        setCredentials(res.data.credentials || []);
      }
    } catch (err) {
      console.warn('Failed to load credentials', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCredentials();
  }, []);

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h2>My Issued Workforce Credentials</h2>
          <p className="page-subtitle">
            Cryptographically signed credentials bound to your verified identity with immutable version history.
          </p>
        </div>
        <button className="action-btn secondary text-xs" onClick={loadCredentials} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'pulse-dot' : ''} />
          Refresh
        </button>
      </div>

      <div className="glass-card table-container">
        {loading ? (
          <div className="empty-state">Loading credentials...</div>
        ) : credentials.length === 0 ? (
          <div className="empty-state">
            <Award size={36} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
            <p>No credentials found for this identity.</p>
            <span className="text-muted text-xs">Credentials issued by verified organizations will appear here.</span>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Credential ID</th>
                <th>Type</th>
                <th>Title</th>
                <th>Issuer</th>
                <th>Status</th>
                <th>Issued At</th>
                <th>Expires</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {credentials.map((c) => (
                <tr key={c.credentialId}>
                  <td className="code-snippet">{c.credentialId}</td>
                  <td><span className="badge-tag">{c.credentialType}</span></td>
                  <td><strong>{c.title}</strong></td>
                  <td className="code-snippet text-muted">{c.issuerId}</td>
                  <td><StatusBadge status={c.status} /></td>
                  <td className="text-muted text-xs">{new Date(c.issuedAt).toLocaleDateString()}</td>
                  <td className="text-muted text-xs">{c.expiresAt ? new Date(c.expiresAt).toLocaleDateString() : 'Never'}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button 
                        className="icon-action-btn"
                        onClick={() => setSelectedCred(c)}
                        title="View Credential Detail & Canonical Payload"
                      >
                        <Eye size={15} />
                      </button>
                      <button 
                        className="action-btn primary text-xs"
                        onClick={() => onNavigate('verify_document', { credentialId: c.credentialId })}
                        title="Run Full Verification"
                        style={{ padding: '0.2rem 0.6rem' }}
                      >
                        Verify
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Credential Detail Modal */}
      {selectedCred && (
        <div className="modal-overlay" onClick={() => setSelectedCred(null)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '800px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <Award size={20} className="text-cyan" />
                <h3>{selectedCred.title}</h3>
              </div>
              <button className="close-btn" onClick={() => setSelectedCred(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div className="credential-detail-grid">
                <div className="detail-row">
                  <span className="detail-label">Credential ID</span>
                  <span className="code-snippet">{selectedCred.credentialId}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Current Version ID</span>
                  <span className="code-snippet">{selectedCred.currentVersionId}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Lifecycle Status</span>
                  <StatusBadge status={selectedCred.status} />
                </div>
                <div className="detail-row">
                  <span className="detail-label">Issuer ID</span>
                  <span className="code-snippet">{selectedCred.issuerId}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Recipient Subject</span>
                  <span className="code-snippet">{selectedCred.recipientId}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Document Hash</span>
                  <span className="code-snippet hash-text">{selectedCred.documentHash}</span>
                </div>
                {selectedCred.revokedAt && (
                  <div className="detail-row">
                    <span className="detail-label">Revocation Reason</span>
                    <span className="text-danger">{selectedCred.revocationReason || 'Administrative revocation'}</span>
                  </div>
                )}
              </div>

              {selectedCred.currentVersion && (
                <div style={{ marginTop: '1.5rem' }}>
                  <h4>Cryptographic Version Artifact</h4>
                  <div className="json-code-box">
                    <pre>{JSON.stringify(selectedCred.currentVersion.signedPayload || selectedCred.currentVersion, null, 2)}</pre>
                  </div>
                </div>
              )}

              <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button 
                  className="action-btn primary"
                  onClick={() => {
                    setSelectedCred(null);
                    onNavigate('verify_document', { credentialId: selectedCred.credentialId });
                  }}
                >
                  <ShieldCheck size={16} /> Run Cryptographic Verification
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

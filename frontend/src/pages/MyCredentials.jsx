import React, { useState, useEffect } from 'react';
import { Award, ShieldCheck, Eye, RefreshCw, X, Calendar, Key, FileText } from 'lucide-react';
import api from '../services/api';
import StatusBadge from '../components/StatusBadge';

export default function MyCredentials({ initialParams = {}, onNavigate }) {
  const [credentials, setCredentials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedCred, setSelectedCred] = useState(null);
  const [loadingModal, setLoadingModal] = useState(false);

  async function openCredentialDetail(cred) {
    setSelectedCred(cred);
    setLoadingModal(true);
    try {
      const res = await api.credentials.getById(cred.credentialId);
      if (res && res.success) {
        setSelectedCred({
          ...res.data.credential,
          currentVersion: res.data.currentVersion
        });
      }
    } catch (err) {
      console.warn('Failed to load full credential details', err);
    } finally {
      setLoadingModal(false);
    }
  }

  async function loadCredentials() {
    setLoading(true);
    setError('');
    try {
      const res = await api.credentials.list({ limit: 50 });
      if (res && res.success) {
        const list = res.data.credentials || [];
        setCredentials(list);
        if (initialParams.credentialId) {
          const matched = list.find((c) => c.credentialId === initialParams.credentialId);
          if (matched) {
            openCredentialDetail(matched);
          } else {
            openCredentialDetail({ credentialId: initialParams.credentialId });
          }
        }
      } else {
        setError(res?.error?.message || 'Failed to load credentials');
      }
    } catch (err) {
      setError(err.message || 'Failed to communicate with credentials service');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCredentials();
  }, [initialParams.credentialId]);

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

      {error && (
        <div className="alert-banner danger" style={{ marginBottom: '1rem' }}>
          <span>{error}</span>
          <button className="link-btn" onClick={loadCredentials} style={{ marginLeft: '1rem' }}>Retry</button>
        </div>
      )}

      <div className="glass-card table-container">
        {loading ? (
          <div className="empty-state">
            <RefreshCw size={28} className="pulse-dot" style={{ marginBottom: '0.75rem' }} />
            <p>Loading credentials from cryptographic registry...</p>
          </div>
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
                <tr 
                  key={c.credentialId}
                  onClick={() => openCredentialDetail(c)}
                  style={{ cursor: 'pointer' }}
                  title="Click to view full credential details"
                >
                  <td className="code-snippet" style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>{c.credentialId}</td>
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
                        onClick={(e) => {
                          e.stopPropagation();
                          openCredentialDetail(c);
                        }}
                        title="View Credential Detail & Canonical Payload"
                      >
                        <Eye size={15} />
                      </button>
                      <button 
                        className="action-btn primary text-xs"
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigate('verify_document', { 
                            credentialId: c.credentialId,
                            documentHash: c.documentHash,
                            documentId: c.documentId
                          });
                        }}
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
                <h3>{selectedCred.title || 'Credential Details'}</h3>
              </div>
              <button className="close-btn" onClick={() => setSelectedCred(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              {loadingModal && (
                <div style={{ padding: '0.5rem 0', color: 'var(--accent-cyan)', fontSize: '0.85rem' }}>
                  Loading canonical cryptographic payload...
                </div>
              )}
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
                  <span className="detail-label">Document ID</span>
                  <span className="code-snippet">{selectedCred.documentId || selectedCred.currentVersion?.documentId || 'N/A'}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Document SHA-256 Hash</span>
                  <span className="code-snippet hash-text">{selectedCred.documentHash || selectedCred.currentVersion?.documentHash || 'N/A'}</span>
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
                {selectedCred.currentVersion?.issuerKeyId && (
                  <div className="detail-row">
                    <span className="detail-label">Signing Key ID</span>
                    <span className="code-snippet">{selectedCred.currentVersion.issuerKeyId}</span>
                  </div>
                )}
                {selectedCred.revokedAt && (
                  <div className="detail-row">
                    <span className="detail-label">Revocation Reason</span>
                    <span className="text-danger">{selectedCred.revocationReason || 'Administrative revocation'}</span>
                  </div>
                )}
              </div>

              {selectedCred.currentVersion?.signature && (
                <div style={{ marginTop: '1.25rem' }}>
                  <h4>Digital Signature (Ed25519)</h4>
                  <div className="raw-text-box" style={{ wordBreak: 'break-all', fontSize: '0.75rem' }}>
                    {selectedCred.currentVersion.signature}
                  </div>
                </div>
              )}

              {selectedCred.currentVersion && (
                <div style={{ marginTop: '1.25rem' }}>
                  <h4>RFC 8785 Canonical Payload</h4>
                  <div className="json-code-box">
                    <pre>{JSON.stringify(selectedCred.currentVersion.signedPayload || selectedCred.currentVersion, null, 2)}</pre>
                  </div>
                </div>
              )}

              <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button 
                  className="action-btn primary"
                  onClick={() => {
                    const docId = selectedCred.documentId || selectedCred.currentVersion?.documentId;
                    const docHash = selectedCred.documentHash || selectedCred.currentVersion?.documentHash;
                    const cId = selectedCred.credentialId;
                    setSelectedCred(null);
                    onNavigate('verify_document', { 
                      credentialId: cId,
                      documentHash: docHash,
                      documentId: docId
                    });
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

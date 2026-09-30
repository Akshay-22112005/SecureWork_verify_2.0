import React, { useState, useEffect } from 'react';
import { Award, Eye, Trash2, RefreshCw, X, AlertTriangle, ShieldCheck, CheckCircle2, History, GitBranch, Key, Calendar } from 'lucide-react';
import api from '../services/api';
import StatusBadge from '../components/StatusBadge';

export default function CredentialList({ initialParams = {}, onNavigate }) {
  const [credentials, setCredentials] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCred, setSelectedCred] = useState(null);
  const [credVersions, setCredVersions] = useState([]);
  const [credTimeline, setCredTimeline] = useState([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState(null);
  const [revocationReason, setRevocationReason] = useState('');
  const [revoking, setRevoking] = useState(false);
  const [actionSuccess, setActionSuccess] = useState('');

  async function openCredentialDetail(cred) {
    setSelectedCred(cred);
    setCredVersions([]);
    setCredTimeline([]);
    setLoadingDetails(true);
    try {
      const [versionsRes, timelineRes] = await Promise.allSettled([
        api.credentials.getVersions(cred.credentialId),
        api.credentials.getTimeline(cred.credentialId)
      ]);
      if (versionsRes.status === 'fulfilled' && versionsRes.value?.success) {
        const vList = versionsRes.value.data.versions || [];
        setCredVersions(vList);
        const curV = vList.find((v) => v.versionId === cred.currentVersionId) || vList[0];
        if (curV) {
          setSelectedCred((prev) => ({
            ...prev,
            documentHash: curV.documentHash || prev?.documentHash,
            documentId: curV.documentId || prev?.documentId
          }));
        }
      }
      if (timelineRes.status === 'fulfilled' && timelineRes.value?.success) {
        setCredTimeline(timelineRes.value.data.timeline || []);
      }
    } catch (err) {
      console.warn('Failed to fetch versions or timeline', err);
    } finally {
      setLoadingDetails(false);
    }
  }

  async function loadCredentials() {
    setLoading(true);
    try {
      const res = await api.credentials.list({ limit: 100 });
      if (res && res.success) {
        const list = res.data.credentials || [];
        setCredentials(list);
        if (initialParams.credentialId) {
          const matched = list.find((c) => c.credentialId === initialParams.credentialId);
          if (matched) {
            openCredentialDetail(matched);
          } else {
            try {
              const single = await api.credentials.getById(initialParams.credentialId);
              if (single && single.success) {
                openCredentialDetail(single.data.credential);
              }
            } catch {}
          }
        }
      }
    } catch (err) {
      console.warn('Failed to load credentials', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCredentials();
  }, [initialParams.credentialId]);

  async function handleRevokeSubmit(e) {
    e.preventDefault();
    if (!revokeTarget) return;
    setRevoking(true);
    try {
      const res = await api.credentials.revoke(revokeTarget.credentialId, revocationReason || 'Administrative revocation');
      if (res && res.success) {
        setActionSuccess(`Credential ${revokeTarget.credentialId} revoked successfully.`);
        setRevokeTarget(null);
        setRevocationReason('');
        loadCredentials();
      }
    } catch (err) {
      alert(err.message || 'Failed to revoke credential');
    } finally {
      setRevoking(false);
    }
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h2>Issued Credential Registry</h2>
          <p className="page-subtitle">
            Manage all cryptographic workforce credentials, inspect version lineages, and execute auditable revocations.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="action-btn primary text-xs" onClick={() => onNavigate('issue_credential')}>
            <Award size={14} /> Issue New Credential
          </button>
          <button className="action-btn secondary text-xs" onClick={loadCredentials} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'pulse-dot' : ''} /> Refresh
          </button>
        </div>
      </div>

      {actionSuccess && (
        <div className="alert-banner success" style={{ marginBottom: '1rem' }}>
          <CheckCircle2 size={16} />
          <span>{actionSuccess}</span>
        </div>
      )}

      <div className="glass-card table-container">
        {loading ? (
          <div className="empty-state">Loading registry...</div>
        ) : credentials.length === 0 ? (
          <div className="empty-state">
            <Award size={36} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
            <p>No credentials found in registry.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Credential ID</th>
                <th>Type</th>
                <th>Title</th>
                <th>Recipient ID</th>
                <th>Lifecycle Status</th>
                <th>Issued At</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {credentials.map((c) => (
                <tr 
                  key={c.credentialId}
                  onClick={() => openCredentialDetail(c)}
                  style={{ cursor: 'pointer' }}
                  title="Click to view full credential details & version history"
                >
                  <td className="code-snippet" style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>{c.credentialId}</td>
                  <td><span className="badge-tag">{c.credentialType}</span></td>
                  <td><strong>{c.title}</strong></td>
                  <td className="code-snippet text-muted">{c.recipientId}</td>
                  <td><StatusBadge status={c.status} /></td>
                  <td className="text-muted text-xs">{new Date(c.issuedAt).toLocaleDateString()}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                      <button 
                        className="icon-action-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          openCredentialDetail(c);
                        }}
                        title="View Details & Version History"
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
                        title="Verify Credential in Engine"
                        style={{ padding: '0.2rem 0.6rem' }}
                      >
                        Verify
                      </button>
                      {c.status === 'ACTIVE' && (
                        <button 
                          className="icon-action-btn text-danger"
                          onClick={(e) => {
                            e.stopPropagation();
                            setRevokeTarget(c);
                          }}
                          title="Revoke Credential"
                        >
                          <Trash2 size={15} />
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

      {/* Credential Detail Modal with Versions & Timeline */}
      {selectedCred && (
        <div className="modal-overlay" onClick={() => setSelectedCred(null)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '850px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div className="modal-header">
              <div>
                <h3>{selectedCred.title}</h3>
                <span className="text-muted text-xs">Credential ID: <span className="code-snippet">{selectedCred.credentialId}</span></span>
              </div>
              <button className="close-btn" onClick={() => setSelectedCred(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div className="credential-detail-grid">
                <div className="detail-row">
                  <span className="detail-label">Status</span>
                  <StatusBadge status={selectedCred.status} />
                </div>
                <div className="detail-row">
                  <span className="detail-label">Credential Type</span>
                  <span className="badge-tag">{selectedCred.credentialType}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Current Version ID</span>
                  <span className="code-snippet">{selectedCred.currentVersionId}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Issuer ID</span>
                  <span className="code-snippet">{selectedCred.issuerId}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Recipient User</span>
                  <span className="code-snippet">{selectedCred.recipientId}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Document SHA-256</span>
                  <span className="code-snippet hash-text">{selectedCred.documentHash}</span>
                </div>
                {selectedCred.revocationReason && (
                  <div className="detail-row" style={{ gridColumn: 'span 2' }}>
                    <span className="detail-label">Revocation Reason</span>
                    <span className="text-danger">{selectedCred.revocationReason}</span>
                  </div>
                )}
              </div>

              {/* Version History Lineage */}
              <div style={{ marginTop: '1.5rem' }}>
                <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', fontSize: '0.95rem' }}>
                  <GitBranch size={16} className="text-cyan" />
                  Immutable Version Lineage History
                </h4>
                {loadingDetails ? (
                  <div className="empty-state" style={{ padding: '1rem' }}>Loading versions...</div>
                ) : credVersions.length === 0 ? (
                  <div className="text-muted text-xs">Single version release recorded.</div>
                ) : (
                  <div className="glass-card" style={{ padding: '0.5rem', background: 'rgba(0,0,0,0.2)' }}>
                    <table className="data-table" style={{ fontSize: '12px' }}>
                      <thead>
                        <tr>
                          <th>Ver #</th>
                          <th>Version ID</th>
                          <th>Status</th>
                          <th>Signing Key</th>
                          <th>Issued At</th>
                          <th>Document Hash</th>
                        </tr>
                      </thead>
                      <tbody>
                        {credVersions.map((v) => (
                          <tr key={v.versionId}>
                            <td><strong>v{v.versionNumber}</strong></td>
                            <td className="code-snippet">{v.versionId}</td>
                            <td><StatusBadge status={v.status} /></td>
                            <td className="code-snippet">{v.issuerKeyId}</td>
                            <td className="text-muted">{new Date(v.issuedAt).toLocaleDateString()}</td>
                            <td className="code-snippet text-muted hash-text">{v.documentHash?.slice(0, 16)}...</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Audit Timeline Milestones */}
              {credTimeline.length > 0 && (
                <div style={{ marginTop: '1.5rem' }}>
                  <h4 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem', fontSize: '0.95rem' }}>
                    <History size={16} className="text-purple" />
                    Chronological Audit Milestones
                  </h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {credTimeline.map((item, idx) => (
                      <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', padding: '0.5rem 0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: '6px' }}>
                        <span className="badge-tag">{item.type || item.action}</span>
                        <span style={{ flex: 1, fontSize: '12px' }}>{item.description || item.notes || `Event triggered by ${item.actorId || 'System'}`}</span>
                        <span className="text-muted text-xs">{new Date(item.timestamp || item.createdAt).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  className="action-btn primary text-xs"
                  onClick={() => {
                    const cid = selectedCred.credentialId;
                    const dHash = selectedCred.documentHash;
                    const dId = selectedCred.documentId;
                    setSelectedCred(null);
                    onNavigate('verify_document', { credentialId: cid, documentHash: dHash, documentId: dId });
                  }}
                >
                  <ShieldCheck size={14} /> Verify Credential
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Revocation Confirmation Modal */}
      {revokeTarget && (
        <div className="modal-overlay" onClick={() => setRevokeTarget(null)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertTriangle size={20} className="text-danger" />
                <h3>Revoke Credential</h3>
              </div>
              <button className="close-btn" onClick={() => setRevokeTarget(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <p className="text-secondary text-sm">
                Revoking credential <strong className="text-primary">{revokeTarget.credentialId}</strong> preserves historical version artifacts while marking the status as <strong>REVOKED</strong> in the hash-chained audit log.
              </p>

              <form onSubmit={handleRevokeSubmit} style={{ marginTop: '1rem' }}>
                <div className="form-group">
                  <label>Revocation Reason</label>
                  <textarea
                    rows={3}
                    placeholder="e.g. Inadvertent award designation, academic misconduct, or administrative update"
                    value={revocationReason}
                    onChange={(e) => setRevocationReason(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                  <button type="button" className="action-btn secondary text-xs" onClick={() => setRevokeTarget(null)}>
                    Cancel
                  </button>
                  <button type="submit" className="action-btn danger text-xs" disabled={revoking}>
                    {revoking ? 'Revoking...' : 'Confirm Revocation'}
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

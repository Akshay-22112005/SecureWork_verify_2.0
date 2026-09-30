import React, { useState, useEffect } from 'react';
import { History, ShieldCheck, Search, Eye, RefreshCw, X } from 'lucide-react';
import api from '../services/api';
import StatusBadge from '../components/StatusBadge';
import TrustEvidenceCard from '../components/TrustEvidenceCard';

export default function VerificationHistory({ initialParams = {}, onNavigate }) {
  const [verifications, setVerifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedVerification, setSelectedVerification] = useState(null);
  const [search, setSearch] = useState(initialParams.verificationId || '');

  async function loadHistory() {
    setLoading(true);
    setError('');
    try {
      const res = await api.verifications.list({ limit: 50 });
      if (res && res.success) {
        const list = res.data.verifications || [];
        setVerifications(list);

        if (initialParams.verificationId) {
          const matched = list.find((v) => v.verificationId === initialParams.verificationId);
          if (matched) {
            setSelectedVerification(matched);
          } else {
            // Fetch exact verification by ID if not in list
            try {
              const singleRes = await api.verifications.getById(initialParams.verificationId);
              if (singleRes && singleRes.success && singleRes.data.verification) {
                setSelectedVerification(singleRes.data.verification);
              }
            } catch (singleErr) {
              console.warn('Could not fetch single verification', singleErr);
            }
          }
        }
      } else {
        setError(res?.error?.message || 'Failed to load verification history');
      }
    } catch (err) {
      setError(err.message || 'Network error fetching verification history');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (initialParams.verificationId) {
      setSearch(initialParams.verificationId);
    }
    loadHistory();
  }, [initialParams.verificationId]);

  const filtered = verifications.filter((v) => {
    const q = search.toLowerCase();
    return (
      (v.verificationId && v.verificationId.toLowerCase().includes(q)) ||
      (v.credentialId && v.credentialId.toLowerCase().includes(q)) ||
      (v.documentHash && v.documentHash.toLowerCase().includes(q)) ||
      (v.finalResult && v.finalResult.toLowerCase().includes(q))
    );
  });

  return (
    <div className="page-content">
      {/* Workflow Navigation Banner */}
      <div className="glass-card" style={{ padding: '0.75rem 1.25rem', marginBottom: '1.25rem', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(0, 240, 255, 0.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.8rem' }}>
          <span className="text-muted" style={{ fontWeight: 600 }}>WORKFLOW:</span>
          <span 
            style={{ cursor: 'pointer', color: 'var(--accent-cyan)' }} 
            onClick={() => onNavigate && onNavigate('dashboard')}
          >
            HR Dashboard
          </span>
          <span className="text-muted">→</span>
          <span 
            style={{ cursor: 'pointer', color: 'var(--accent-cyan)' }} 
            onClick={() => onNavigate && onNavigate('verify_document', { 
              verificationId: initialParams?.verificationId,
              credentialId: initialParams?.credentialId 
            })}
          >
            Verify Document
          </span>
          <span className="text-muted">→</span>
          <span className="text-muted">Verification Engine</span>
          <span className="text-muted">→</span>
          <span className="text-cyan">Verification Result</span>
          <span className="text-muted">→</span>
          <span 
            style={{ cursor: 'pointer', color: 'var(--accent-purple)' }}
            onClick={() => onNavigate && onNavigate('verification_evidence', { 
              verificationId: initialParams?.verificationId,
              credentialId: initialParams?.credentialId 
            })}
          >
            Discrete Evidence
          </span>
          <span className="text-muted">→</span>
          <strong style={{ color: 'var(--accent-blue)', textDecoration: 'underline' }}>Candidate Verification Logs (Inspecting)</strong>
        </div>
      </div>

      <div className="page-header">
        <div>
          <h2>Candidate Verification Logs & Audit History</h2>
          <p className="page-subtitle">
            Immutable log of all evaluation runs, cryptographic checks, and auditor determinations.
          </p>
        </div>
        <button className="action-btn secondary text-xs" onClick={loadHistory} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'pulse-dot' : ''} />
          Refresh
        </button>
      </div>

      <div className="glass-card" style={{ marginBottom: '1.5rem' }}>
        <div className="search-bar-row">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search by Verification ID, Credential ID, or Document Hash..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="search-input"
          />
        </div>
      </div>

      {error && (
        <div className="alert-banner danger" style={{ marginBottom: '1rem' }}>
          <span>{error}</span>
          <button className="link-btn" onClick={loadHistory} style={{ marginLeft: '1rem' }}>Retry</button>
        </div>
      )}

      <div className="glass-card table-container">
        {loading ? (
          <div className="empty-state">
            <RefreshCw size={28} className="pulse-dot" style={{ marginBottom: '0.75rem' }} />
            <p>Loading verification records from append-only audit trail...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <History size={36} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
            <p>No matching verification records found.</p>
            {onNavigate && (
              <button className="action-btn primary text-xs" style={{ marginTop: '0.75rem' }} onClick={() => onNavigate('verify_document')}>
                Run New Verification
              </button>
            )}
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Verification ID</th>
                <th>Target Credential / Hash</th>
                <th>Cryptographic Status</th>
                <th>Categorical Result</th>
                <th>Trust Level</th>
                <th>Evaluated At</th>
                <th>Inspect</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((v) => (
                <tr 
                  key={v.verificationId}
                  onClick={() => setSelectedVerification(v)}
                  style={{ cursor: 'pointer' }}
                  title="Click to inspect this exact verification run"
                >
                  <td className="code-snippet" style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>{v.verificationId}</td>
                  <td>
                    {v.credentialId ? (
                      <span className="code-snippet">{v.credentialId}</span>
                    ) : (
                      <span className="code-snippet text-muted">{v.documentHash ? `${v.documentHash.slice(0, 16)}...` : 'N/A'}</span>
                    )}
                  </td>
                  <td><StatusBadge status={v.cryptographicStatus} /></td>
                  <td><StatusBadge status={v.finalResult || v.result} /></td>
                  <td><span className="level-badge">{v.trustLevel || 'LEVEL 0'}</span></td>
                  <td className="text-muted text-xs">{new Date(v.evaluatedAt || v.createdAt).toLocaleString()}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button 
                        className="icon-action-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedVerification(v);
                        }}
                        title="Inspect Categorical Evidence"
                      >
                        Inspect →
                      </button>
                      {onNavigate && (
                        <button 
                          className="icon-action-btn"
                          style={{ color: 'var(--accent-purple)' }}
                          onClick={(e) => {
                            e.stopPropagation();
                            onNavigate('verification_evidence', { verificationId: v.verificationId, credentialId: v.credentialId });
                          }}
                          title="View Discrete Evidence Artifacts"
                        >
                          Evidence
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

      {/* Modal Inspector */}
      {selectedVerification && (
        <div className="modal-overlay" onClick={() => setSelectedVerification(null)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px' }}>
            <div className="modal-header">
              <h3>Verification Evidence Details — {selectedVerification.verificationId}</h3>
              <button className="close-btn" onClick={() => setSelectedVerification(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <TrustEvidenceCard verification={selectedVerification} />

              {onNavigate && (
                <div style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <button 
                    className="action-btn secondary text-xs"
                    onClick={() => {
                      setSelectedVerification(null);
                      onNavigate('dashboard');
                    }}
                  >
                    Back to Dashboard
                  </button>
                  <button 
                    className="action-btn secondary text-xs"
                    onClick={() => {
                      const vId = selectedVerification.verificationId;
                      const cId = selectedVerification.credentialId;
                      setSelectedVerification(null);
                      onNavigate('verification_evidence', { verificationId: vId, credentialId: cId });
                    }}
                  >
                    Inspect Discrete Evidence Records →
                  </button>
                  <button 
                    className="action-btn primary text-xs"
                    onClick={() => {
                      const cId = selectedVerification.credentialId;
                      const dHash = selectedVerification.documentHash;
                      setSelectedVerification(null);
                      onNavigate('verify_document', { credentialId: cId, documentHash: dHash });
                    }}
                  >
                    Re-Verify in Pipeline
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

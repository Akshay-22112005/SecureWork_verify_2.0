import React, { useState, useEffect } from 'react';
import { CheckSquare, ShieldCheck, Search, Eye, RefreshCw, X, GitCommit } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import StatusBadge from '../components/StatusBadge';

export default function VerificationEvidence({ initialParams = {}, onNavigate }) {
  const { role, isAuditor, isAdmin } = useAuth();
  const [evidenceList, setEvidenceList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState(initialParams.verificationId || '');
  const [selectedEvidence, setSelectedEvidence] = useState(null);

  async function loadEvidence() {
    setLoading(true);
    setError('');
    try {
      const items = [];

      // 1. If exact verificationId provided, query direct evidence endpoint first
      if (initialParams.verificationId) {
        try {
          const directRes = await api.verifications.getEvidence(initialParams.verificationId);
          if (directRes && directRes.success && Array.isArray(directRes.data?.evidence) && directRes.data.evidence.length > 0) {
            items.push(...directRes.data.evidence);
            setSelectedEvidence(directRes.data.evidence[0]);
          }
        } catch (directErr) {
          console.warn('Could not fetch direct evidence for verificationId', directErr);
        }
      }

      // 2. Fetch historical verifications to populate overall evidence repository
      const res = await api.verifications.list({ limit: 50 });
      if (res && res.success) {
        const verifications = res.data.verifications || [];

        // Fetch discrete evidence records for each verification via GET /api/verifications/:id/evidence
        await Promise.all(
          verifications.map(async (v) => {
            if (v.verificationId === initialParams.verificationId && items.length > 0) {
              return; // Already loaded via direct query
            }
            try {
              const eviRes = await api.verifications.getEvidence(v.verificationId);
              if (eviRes && eviRes.success && Array.isArray(eviRes.data?.evidence) && eviRes.data.evidence.length > 0) {
                items.push(...eviRes.data.evidence);
                return;
              }
            } catch {
              // Fallback to top-level verification record if evidence subquery fails
            }

            items.push({
              verificationId: v.verificationId,
              evidenceType: 'DIGITAL_SIGNATURE',
              sourceId: v.issuerId || 'INTERNAL',
              credentialIdentifier: v.credentialId,
              documentHash: v.documentHash,
              evidenceStatus: v.cryptographicStatus === 'PASSED' ? 'CONFIRMED' : 'PENDING',
              createdAt: v.evaluatedAt || v.createdAt
            });
          })
        );

        setEvidenceList(items);

        if (initialParams.verificationId && !selectedEvidence) {
          const match = items.find((item) => item.verificationId === initialParams.verificationId);
          if (match) {
            setSelectedEvidence(match);
          }
        }
      } else {
        setError(res?.error?.message || 'Failed to load verification evidence');
      }
    } catch (err) {
      setError(err.message || 'Error fetching verification evidence repository');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (initialParams.verificationId) {
      setSearch(initialParams.verificationId);
    }
    loadEvidence();
  }, [initialParams.verificationId]);

  const filtered = evidenceList.filter((e) => {
    const q = search.toLowerCase();
    return (
      (e.verificationId && e.verificationId.toLowerCase().includes(q)) ||
      (e.evidenceType && e.evidenceType.toLowerCase().includes(q)) ||
      (e.credentialIdentifier && e.credentialIdentifier.toLowerCase().includes(q))
    );
  });

  return (
    <div className="page-content">
      {/* Workflow Navigation Banner */}
      <div className="glass-card" style={{ padding: '0.75rem 1.25rem', marginBottom: '1.25rem', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(0, 240, 255, 0.15)' }}>
        {(isAuditor || role === 'AUDITOR') ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.8rem' }}>
            <span className="text-muted" style={{ fontWeight: 700 }}>AUDITOR WORKFLOW:</span>
            <span 
              style={{ cursor: 'pointer', color: 'var(--accent-cyan)' }} 
              onClick={() => onNavigate && onNavigate('dashboard')}
            >
              Auditor Dashboard
            </span>
            <span className="text-muted">→</span>
            <span 
              style={{ cursor: 'pointer', color: 'var(--accent-blue)' }} 
              onClick={() => onNavigate && onNavigate('audit_logs')}
            >
              Audit Logs
            </span>
            <span className="text-muted">→</span>
            <span className="text-muted">Select Event</span>
            <span className="text-muted">→</span>
            <span className="text-muted">Event Details</span>
            <span className="text-muted">→</span>
            <strong style={{ color: 'var(--accent-purple)', textDecoration: 'underline' }}>Discrete Evidence (Inspecting)</strong>
            <span className="text-muted">→</span>
            <span 
              style={{ cursor: 'pointer', color: '#10b981', textDecoration: 'underline' }}
              onClick={() => onNavigate && onNavigate('chain_validation')}
            >
              Validate Hash Chain
            </span>
          </div>
        ) : (
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
            <strong style={{ color: 'var(--accent-purple)', textDecoration: 'underline' }}>Discrete Evidence (Inspecting)</strong>
            <span className="text-muted">→</span>
            <span 
              style={{ cursor: 'pointer', color: 'var(--accent-blue)' }}
              onClick={() => onNavigate && onNavigate('verification_history', { verificationId: initialParams?.verificationId })}
            >
              Candidate Verification Logs
            </span>
          </div>
        )}
      </div>

      <div className="page-header">
        <div>
          <h2>Historical Verification Evidence Repository</h2>
          <p className="page-subtitle">
            Discrete, immutable evidence artifacts collected during multi-check verification pipeline executions.
          </p>
        </div>
        <button className="action-btn secondary text-xs" onClick={loadEvidence} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'pulse-dot' : ''} /> Refresh
        </button>
      </div>

      <div className="glass-card" style={{ marginBottom: '1.5rem' }}>
        <div className="search-bar-row">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search by Evidence Type, Verification ID, or Credential Identifier..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="search-input"
          />
        </div>
      </div>

      {error && (
        <div className="alert-banner danger" style={{ marginBottom: '1rem' }}>
          <span>{error}</span>
          <button className="link-btn" onClick={loadEvidence} style={{ marginLeft: '1rem' }}>Retry</button>
        </div>
      )}

      <div className="glass-card table-container">
        {loading ? (
          <div className="empty-state">
            <RefreshCw size={28} className="pulse-dot" style={{ marginBottom: '0.75rem' }} />
            <p>Loading evidence records from cryptographic store...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <CheckSquare size={36} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
            <p>No historical evidence records found.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Verification ID</th>
                <th>Evidence Type</th>
                <th>Source ID</th>
                <th>Credential Identifier</th>
                <th>Evidence Status</th>
                <th>Recorded At</th>
                <th>Inspect</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item, idx) => (
                <tr 
                  key={item.evidenceId || idx}
                  onClick={() => setSelectedEvidence(item)}
                  style={{ cursor: 'pointer' }}
                  title="Click to inspect this discrete evidence artifact"
                >
                  <td className="code-snippet" style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>{item.verificationId}</td>
                  <td><span className="badge-tag">{item.evidenceType}</span></td>
                  <td className="code-snippet text-muted">{item.sourceId}</td>
                  <td>{item.credentialIdentifier || 'N/A'}</td>
                  <td><StatusBadge status={item.evidenceStatus} /></td>
                  <td className="text-muted text-xs">{new Date(item.createdAt).toLocaleString()}</td>
                  <td>
                    <button 
                      className="icon-action-btn" 
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedEvidence(item);
                      }} 
                      title="Inspect Evidence Artifact"
                    >
                      <Eye size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Selected Evidence Modal */}
      {selectedEvidence && (
        <div className="modal-overlay" onClick={() => setSelectedEvidence(null)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '650px' }}>
            <div className="modal-header">
              <h3>Evidence Record — {selectedEvidence.evidenceType}</h3>
              <button className="close-btn" onClick={() => setSelectedEvidence(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div className="credential-detail-grid">
                <div className="detail-row">
                  <span className="detail-label">Verification ID</span>
                  <span className="code-snippet">{selectedEvidence.verificationId}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Evidence Type</span>
                  <strong>{selectedEvidence.evidenceType}</strong>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Source ID</span>
                  <span>{selectedEvidence.sourceId}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Document Hash</span>
                  <span className="code-snippet hash-text">{selectedEvidence.documentHash || 'N/A'}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Evidence Status</span>
                  <StatusBadge status={selectedEvidence.evidenceStatus} />
                </div>
              </div>

              {selectedEvidence.sourceResponseSummary && (
                <div style={{ marginTop: '1.5rem' }}>
                  <h4>Source Response Summary</h4>
                  <div className="json-code-box">
                    <pre>{JSON.stringify(selectedEvidence.sourceResponseSummary, null, 2)}</pre>
                  </div>
                </div>
              )}

              {onNavigate && (
                <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
                  <button 
                    className="action-btn secondary text-xs"
                    onClick={() => setSelectedEvidence(null)}
                  >
                    Close
                  </button>
                  <div style={{ display: 'flex', gap: '0.6rem' }}>
                    <button 
                      className="action-btn primary text-xs"
                      onClick={() => {
                        const vId = selectedEvidence.verificationId;
                        setSelectedEvidence(null);
                        onNavigate('verification_history', { verificationId: vId });
                      }}
                    >
                      View in Verification History →
                    </button>
                    {(isAuditor || role === 'AUDITOR' || isAdmin) && (
                      <button 
                        className="action-btn secondary text-xs"
                        style={{ borderColor: 'rgba(16, 185, 129, 0.4)', color: '#10b981' }}
                        onClick={() => {
                          setSelectedEvidence(null);
                          onNavigate('chain_validation');
                        }}
                        title="Transition to cryptographic hash chain validation"
                      >
                        <GitCommit size={13} /> Validate Hash Chain →
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Workflow Navigation Footer */}
      {onNavigate && (
        <div className="glass-card" style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          {(isAuditor || role === 'AUDITOR') ? (
            <>
              <div>
                <span className="text-muted text-xs">Auditor Workflow: Discrete Evidence Artifacts → Validate Hash Chain Integrity</span>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button 
                  className="action-btn secondary text-xs" 
                  onClick={() => onNavigate('dashboard')}
                >
                  ← Back to Auditor Dashboard
                </button>
                <button 
                  className="action-btn secondary text-xs" 
                  onClick={() => onNavigate('audit_logs')}
                >
                  ← Back to Audit Logs
                </button>
                <button 
                  className="action-btn primary text-xs"
                  onClick={() => onNavigate('chain_validation')}
                >
                  Validate Hash Chain →
                </button>
              </div>
            </>
          ) : (
            <>
              <div>
                <span className="text-muted text-xs">HR & Verifier Workflow: Discrete Evidence → Candidate Verification Logs</span>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button 
                  className="action-btn secondary text-xs" 
                  onClick={() => onNavigate('dashboard')}
                >
                  ← Back to HR Dashboard
                </button>
                <button 
                  className="action-btn secondary text-xs" 
                  onClick={() => onNavigate('verify_document', { 
                    verificationId: initialParams?.verificationId,
                    credentialId: initialParams?.credentialId
                  })}
                >
                  Verify Another Document
                </button>
                <button 
                  className="action-btn primary text-xs"
                  onClick={() => onNavigate('verification_history', { 
                    verificationId: initialParams?.verificationId 
                  })}
                >
                  Open Candidate Verification Logs →
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

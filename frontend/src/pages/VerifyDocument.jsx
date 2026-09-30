import React, { useState, useEffect } from 'react';
import { ShieldCheck, Search, AlertCircle, RefreshCw, CheckCircle2, ShieldAlert } from 'lucide-react';
import api from '../services/api';
import TrustEvidenceCard from '../components/TrustEvidenceCard';
import { useAuth } from '../context/AuthContext';

export default function VerifyDocument({ initialParams = {}, onNavigate }) {
  const { user, isAdmin, isAuditor, isHr, role } = useAuth();
  const [credentialId, setCredentialId] = useState(initialParams.credentialId || '');
  const [documentHash, setDocumentHash] = useState(initialParams.documentHash || '');
  const [documentId, setDocumentId] = useState(initialParams.documentId || '');
  const [candidateCredentials, setCandidateCredentials] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [verificationResult, setVerificationResult] = useState(null);

  // Manual review fields
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewDecision, setReviewDecision] = useState('CONFIRMED');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewMessage, setReviewMessage] = useState('');

  // Load candidate credentials for quick selection
  useEffect(() => {
    async function loadCandidates() {
      try {
        const res = await api.credentials.list({ limit: 12 });
        if (res && res.success) {
          setCandidateCredentials(res.data.credentials || []);
        }
      } catch {}
    }
    loadCandidates();
  }, []);

  async function executeEvaluation(targetCredId, targetDocHash, targetDocId) {
    const cid = targetCredId !== undefined ? targetCredId : credentialId;
    const dhash = targetDocHash !== undefined ? targetDocHash : documentHash;
    const did = targetDocId !== undefined ? targetDocId : documentId;

    if (!cid && !dhash) {
      setError('Please provide at least a Credential ID or Document SHA-256 Hash.');
      return;
    }
    setError('');
    setLoading(true);
    setVerificationResult(null);
    setReviewMessage('');

    try {
      const payload = {};
      if (cid) payload.credentialId = cid.trim();
      if (dhash) payload.documentHash = dhash.trim();
      if (did) payload.documentId = did.trim();

      const res = await api.verifications.evaluate(payload);
      if (res && res.success) {
        setVerificationResult(res.data);
      } else {
        setError(res?.error?.message || 'Verification failed');
      }
    } catch (err) {
      setError(err.message || 'Verification service error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (initialParams.credentialId) setCredentialId(initialParams.credentialId);
    if (initialParams.documentHash) setDocumentHash(initialParams.documentHash);
    if (initialParams.documentId) setDocumentId(initialParams.documentId);

    if (initialParams.credentialId || initialParams.documentHash) {
      executeEvaluation(initialParams.credentialId, initialParams.documentHash, initialParams.documentId);
    }
  }, [initialParams.credentialId, initialParams.documentHash, initialParams.documentId]);

  async function handleVerify(e) {
    if (e) e.preventDefault();
    await executeEvaluation();
  }

  async function handleManualReviewSubmit(e) {
    e.preventDefault();
    if (!verificationResult || !verificationResult.verificationId) return;
    setSubmittingReview(true);
    setReviewMessage('');
    try {
      const res = await api.verifications.submitManualReview(
        verificationResult.verificationId,
        {
          decision: reviewDecision,
          reviewNotes: reviewNotes || 'Auditor manual verification evaluation'
        }
      );
      if (res && res.success) {
        setReviewMessage('Manual review submitted and hash-chained to audit log.');
        // Refresh verification state
        setVerificationResult((prev) => ({
          ...prev,
          finalResult: res.data.verification.finalResult,
          humanVerificationStatus: res.data.verification.humanVerificationStatus
        }));
      }
    } catch (err) {
      setError(err.message || 'Failed to submit manual review');
    } finally {
      setSubmittingReview(false);
    }
  }

  return (
    <div className="page-content">
      {/* Workflow Navigation Banner */}
      <div className="glass-card" style={{ padding: '0.75rem 1.25rem', marginBottom: '1.25rem', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(0, 240, 255, 0.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.8rem' }}>
          <span className="text-muted" style={{ fontWeight: 600 }}>PERSONA WORKFLOW:</span>
          <span 
            style={{ cursor: 'pointer', color: 'var(--accent-cyan)' }} 
            onClick={() => onNavigate && onNavigate('dashboard')}
            title="Return to HR Dashboard"
          >
            HR Dashboard
          </span>
          <span className="text-muted">→</span>
          <strong style={{ color: '#fff', textDecoration: 'underline' }}>Verify Document</strong>
          <span className="text-muted">→</span>
          <span className="text-muted">Credential / Document ID</span>
          <span className="text-muted">→</span>
          <span className="text-muted">Verification Engine</span>
          <span className="text-muted">→</span>
          <span className={verificationResult ? 'text-cyan' : 'text-muted'}>Verification Result</span>
          <span className="text-muted">→</span>
          <span className={verificationResult ? 'text-purple' : 'text-muted'}>Evidence Package</span>
          <span className="text-muted">→</span>
          <span className={verificationResult ? 'text-blue' : 'text-muted'}>Verification Logs</span>
        </div>
      </div>

      <div className="page-header">
        <div>
          <h2>{isHr ? 'HR Candidate Qualification Verification' : 'Cryptographic Credential Verification'}</h2>
          <p className="page-subtitle">
            {isHr
              ? 'Candidate workforce qualification verification • Evaluates degrees, certificates, and employment claims against 16 tamper-evident trust checks.'
              : 'Evidence-first verification engine • Evaluates 16 independent trust factors without reductive percentage claims.'}
          </p>
        </div>
      </div>

      {/* Verification Query Form */}
      <div className="glass-card" style={{ marginBottom: '2rem' }}>
        <h3>Verification Target</h3>
        <p className="text-secondary text-sm" style={{ marginBottom: '1.25rem' }}>
          Select an active applicant qualification or enter a Credential ID, raw document SHA-256 hash, or Document ID to execute the multi-check verification pipeline.
        </p>

        {error && (
          <div className="alert-banner danger" style={{ marginBottom: '1rem' }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleVerify} className="form-grid-3">
          {candidateCredentials.length > 0 && (
            <div className="form-group" style={{ gridColumn: 'span 3', marginBottom: '0.5rem' }}>
              <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>Quick-Select Candidate Credential</span>
                <span className="text-muted text-xs">Auto-populates target ID from registered applicant qualifications</span>
              </label>
              <select
                className="select-input"
                value={credentialId}
                onChange={(e) => {
                  const targetId = e.target.value;
                  setCredentialId(targetId);
                  const selected = candidateCredentials.find(c => c.credentialId === targetId);
                  if (selected && selected.currentVersion && selected.currentVersion.documentHash) {
                    setDocumentHash(selected.currentVersion.documentHash);
                  }
                }}
              >
                <option value="">-- Choose Candidate Credential or Enter Manually Below --</option>
                {candidateCredentials.map((c) => (
                  <option key={c.credentialId} value={c.credentialId}>
                    {c.title} ({c.credentialId}) — {c.credentialType} [{c.status}]
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="form-group">
            <label>Credential ID</label>
            <input
              type="text"
              placeholder="crd_0123456789abcdef"
              value={credentialId}
              onChange={(e) => setCredentialId(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Document SHA-256 Hash</label>
            <input
              type="text"
              placeholder="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
              value={documentHash}
              onChange={(e) => setDocumentHash(e.target.value)}
            />
          </div>

          <div className="form-group">
            <label>Document Artifact ID (Optional)</label>
            <input
              type="text"
              placeholder="doc_0123456789abcdef"
              value={documentId}
              onChange={(e) => setDocumentId(e.target.value)}
            />
          </div>

          <div className="form-submit-row" style={{ gridColumn: 'span 3', display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="action-btn primary" disabled={loading}>
              <ShieldCheck size={16} />
              {loading ? 'Evaluating 16-Check Evidence...' : 'Run Verification Pipeline'}
            </button>
          </div>
        </form>
      </div>

      {/* Categorical Trust Evidence Results */}
      {verificationResult && (
        <div>
          <TrustEvidenceCard verification={verificationResult} />

          {/* Action Row: Discrete Evidence & Verification History Navigation */}
          {onNavigate && (
            <div className="glass-card" style={{ marginTop: '1.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div>
                <span className="text-muted text-xs">
                  Evidence Package Verified • Preserved Verification ID: <code className="code-snippet text-xs">{verificationResult.verificationId}</code>
                </span>
              </div>
              <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button 
                  className="action-btn primary text-xs"
                  onClick={() => onNavigate('verification_evidence', { 
                    verificationId: verificationResult.verificationId,
                    credentialId: verificationResult.credentialId,
                    documentId: verificationResult.documentId
                  })}
                >
                  Inspect Discrete Evidence Records →
                </button>
                <button 
                  className="action-btn secondary text-xs"
                  onClick={() => onNavigate('verification_history', { 
                    verificationId: verificationResult.verificationId,
                    credentialId: verificationResult.credentialId
                  })}
                >
                  View Candidate Verification Logs →
                </button>
                <button 
                  className="action-btn secondary text-xs"
                  onClick={() => onNavigate('verify_source', { 
                    credentialIdentifier: verificationResult.credentialId,
                    documentHash: verificationResult.documentHash
                  })}
                >
                  Verify Official Source Registry
                </button>
              </div>
            </div>
          )}

          {/* Manual Review Governance (Admins, Auditors & HR) */}
          {(isAdmin || isAuditor || isHr) && (
            <div className="glass-card" style={{ marginTop: '2rem' }}>
              <div className="section-header">
                <h3>Manual HR & Auditor Review Workflow</h3>
                <span className="level-badge">RBAC: {user?.role}</span>
              </div>
              <p className="text-secondary text-sm" style={{ marginBottom: '1rem' }}>
                Authorized HR Verifiers and Compliance Auditors can record authoritative human determinations with audit trail immutability.
              </p>

              {reviewMessage && (
                <div className="alert-banner success" style={{ marginBottom: '1rem' }}>
                  <CheckCircle2 size={16} />
                  <span>{reviewMessage}</span>
                </div>
              )}

              <form onSubmit={handleManualReviewSubmit} className="manual-review-form">
                <div className="form-group">
                  <label>Reviewer Authoritative Determination</label>
                  <select 
                    value={reviewDecision} 
                    onChange={(e) => setReviewDecision(e.target.value)}
                    className="select-input"
                  >
                    <option value="CONFIRMED">CONFIRMED (Promote to MANUALLY_VERIFIED)</option>
                    <option value="REJECTED">REJECTED (Mark as ALTERED)</option>
                    <option value="INCONCLUSIVE">INCONCLUSIVE (Retain PENDING status)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>HR / Auditor Evaluation Notes & Verification Audit Summary</label>
                  <textarea
                    rows={3}
                    placeholder="Documented physical verification with university registrar, registrar verified seal..."
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    required
                  />
                </div>

                <button type="submit" className="action-btn secondary text-xs" disabled={submittingReview}>
                  {submittingReview ? 'Recording Decision...' : 'Commit Immutable Manual Review'}
                </button>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

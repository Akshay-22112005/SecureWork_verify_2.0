import React, { useState, useEffect } from 'react';
import { ShieldCheck, Search, AlertCircle, RefreshCw, CheckCircle2, ShieldAlert } from 'lucide-react';
import api from '../services/api';
import TrustEvidenceCard from '../components/TrustEvidenceCard';
import { useAuth } from '../context/AuthContext';

export default function VerifyDocument({ initialParams = {} }) {
  const { user, isAdmin, isAuditor } = useAuth();
  const [credentialId, setCredentialId] = useState(initialParams.credentialId || '');
  const [documentHash, setDocumentHash] = useState(initialParams.documentHash || '');
  const [documentId, setDocumentId] = useState(initialParams.documentId || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [verificationResult, setVerificationResult] = useState(null);

  // Manual review fields
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewDecision, setReviewDecision] = useState('CONFIRMED');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewMessage, setReviewMessage] = useState('');

  useEffect(() => {
    if (initialParams.credentialId || initialParams.documentHash) {
      handleVerify();
    }
  }, []);

  async function handleVerify(e) {
    if (e) e.preventDefault();
    if (!credentialId && !documentHash) {
      setError('Please provide at least a Credential ID or Document SHA-256 Hash.');
      return;
    }
    setError('');
    setLoading(true);
    setVerificationResult(null);
    setReviewMessage('');

    try {
      const payload = {};
      if (credentialId) payload.credentialId = credentialId.trim();
      if (documentHash) payload.documentHash = documentHash.trim();
      if (documentId) payload.documentId = documentId.trim();

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
      <div className="page-header">
        <div>
          <h2>Cryptographic Credential Verification</h2>
          <p className="page-subtitle">
            Evidence-first verification engine • Evaluates 16 independent trust factors without reductive percentage claims.
          </p>
        </div>
      </div>

      {/* Verification Query Form */}
      <div className="glass-card" style={{ marginBottom: '2rem' }}>
        <h3>Verification Target</h3>
        <p className="text-secondary text-sm" style={{ marginBottom: '1.25rem' }}>
          Enter a Credential ID, raw document SHA-256 hash, or associated Document ID to execute the multi-check verification pipeline.
        </p>

        {error && (
          <div className="alert-banner danger" style={{ marginBottom: '1rem' }}>
            <AlertCircle size={16} />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleVerify} className="form-grid-3">
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

          {/* Manual Review Governance (Admins & Auditors) */}
          {(isAdmin || isAuditor) && (
            <div className="glass-card" style={{ marginTop: '2rem' }}>
              <div className="section-header">
                <h3>Manual Auditor Review Workflow</h3>
                <span className="level-badge">RBAC: {user?.role}</span>
              </div>
              <p className="text-secondary text-sm" style={{ marginBottom: '1rem' }}>
                Auditors and Administrators can record authoritative human determinations with audit trail immutability.
              </p>

              {reviewMessage && (
                <div className="alert-banner success" style={{ marginBottom: '1rem' }}>
                  <CheckCircle2 size={16} />
                  <span>{reviewMessage}</span>
                </div>
              )}

              <form onSubmit={handleManualReviewSubmit} className="manual-review-form">
                <div className="form-group">
                  <label>Auditor Determination</label>
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
                  <label>Audit Notes & Investigation Summary</label>
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

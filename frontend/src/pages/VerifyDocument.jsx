import React, { useState, useEffect } from 'react';
import { useParams, useLocation } from 'react-router-dom';
import { 
  ShieldCheck, Search, AlertCircle, RefreshCw, CheckCircle2, ShieldAlert,
  Download, FileText, QrCode, Globe, ShieldX, Key, Hash, Award, CheckSquare, Zap, Copy, ExternalLink,
  User, Building, Clock, Check
} from 'lucide-react';
import api from '../services/api';
import TrustEvidenceCard from '../components/TrustEvidenceCard';
import StatusBadge from '../components/StatusBadge';
import ConfidenceRing from '../components/ConfidenceRing';
import { useAuth } from '../context/AuthContext';

export default function VerifyDocument({ initialParams = {}, onNavigate }) {
  const { user, isAdmin, isAuditor, isHr, role } = useAuth();
  const isHrMode = isHr || role === 'HR';
  const routeParams = useParams();
  const location = useLocation();

  // Parse query parameters (?credentialId=... or ?id=...)
  const queryParams = new URLSearchParams(location.search);
  const queryCredId = queryParams.get('credentialId') || queryParams.get('id') || '';
  const queryDocHash = queryParams.get('documentHash') || queryParams.get('hash') || '';
  const queryDocId = queryParams.get('documentId') || '';

  const effectiveCredId = routeParams?.credentialId || queryCredId || location?.state?.credentialId || initialParams?.credentialId || '';
  const effectiveDocHash = queryDocHash || location?.state?.documentHash || initialParams?.documentHash || '';
  const effectiveDocId = queryDocId || location?.state?.documentId || initialParams?.documentId || '';

  const [activeTab, setActiveTab] = useState(effectiveCredId ? 'direct' : (isHrMode ? 'hr_candidate' : 'direct'));
  const [credentialId, setCredentialId] = useState(effectiveCredId);
  const [documentHash, setDocumentHash] = useState(effectiveDocHash);
  const [documentId, setDocumentId] = useState(effectiveDocId);
  const [candidateCredentials, setCandidateCredentials] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [verificationResult, setVerificationResult] = useState(null);
  const [publicData, setPublicData] = useState(null);
  const [recordNotFound, setRecordNotFound] = useState(false);
  const [uploadHashToast, setUploadHashToast] = useState('');
  const [routingToast, setRoutingToast] = useState(location?.state?.routingNotice || '');
  const [hashMatch, setHashMatch] = useState(null);
  const [tamperingSimulated, setTamperingSimulated] = useState(false);
  const [tamperLoading, setTamperLoading] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  // HR Candidate Lookup State
  const [hrSubjectQuery, setHrSubjectQuery] = useState(initialParams.subjectIdOrEmail || '');
  const [hrLoading, setHrLoading] = useState(false);
  const [hrError, setHrError] = useState('');
  const [hrSubjectData, setHrSubjectData] = useState(null);
  const [hrCredentials, setHrCredentials] = useState([]);
  const [hrSelectedCred, setHrSelectedCred] = useState(null);
  const [hrSearched, setHrSearched] = useState(false);

  // Manual review fields
  const [reviewNotes, setReviewNotes] = useState('');
  const [reviewDecision, setReviewDecision] = useState('CONFIRMED');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewMessage, setReviewMessage] = useState('');

  // HR Candidate Lookup Handler
  async function handleHrCandidateLookup(e) {
    if (e) e.preventDefault();
    if (!hrSubjectQuery || !hrSubjectQuery.trim()) {
      setHrError('Please enter a User ID or Candidate Email address.');
      return;
    }
    setHrError('');
    setHrLoading(true);
    setHrSearched(true);
    setHrSubjectData(null);
    setHrCredentials([]);
    setHrSelectedCred(null);

    try {
      const res = await api.hr.getSubjectCredentials(hrSubjectQuery.trim());
      if (res && res.success) {
        setHrSubjectData(res.data.subject);
        setHrCredentials(res.data.credentials || []);
      } else {
        setHrError(res?.error?.message || 'Candidate lookup failed');
      }
    } catch (err) {
      setHrError(err.message || 'Candidate user not found or lookup failed');
    } finally {
      setHrLoading(false);
    }
  }

  // HR Execute Verification on a Specific Subject Credential
  async function handleHrVerifyCredential(cred) {
    setHrSelectedCred(cred);
    setCredentialId(cred.credentialId);
    setLoading(true);
    setError('');
    try {
      const res = await api.hr.verify({
        credentialId: cred.credentialId,
        subjectIdOrEmail: hrSubjectData?.userId || hrSubjectQuery.trim()
      });
      if (res && res.success) {
        setVerificationResult(res.data);
      }
    } catch (err) {
      setError(err.message || 'HR verification evaluation failed');
    } finally {
      setLoading(false);
    }
  }


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
    setPublicData(null);
    setRecordNotFound(false);
    setReviewMessage('');

    try {
      const payload = {};
      if (cid) payload.credentialId = cid.trim();
      if (dhash) payload.documentHash = dhash.trim();
      if (did) payload.documentId = did.trim();

      const [res, pubRes] = await Promise.all([
        api.verifications.evaluate(payload).catch((err) => ({ requestError: err })),
        cid ? api.public.verify(cid.trim()).catch((err) => ({ requestError: err })) : Promise.resolve(null)
      ]);

      if (res && res.success) {
        setVerificationResult(res.data);
      } else {
        const evalError = res?.requestError;
        setError(evalError?.message || res?.error?.message || 'Verification failed');
      }

      if (pubRes && pubRes.success) {
        setPublicData(pubRes.data);
      }
      const has404 = [res?.requestError, pubRes?.requestError].some((requestError) => requestError?.status === 404);
      const noRecordReturned = !res?.requestError && res?.success === false && !pubRes?.requestError && pubRes?.success === false;
      if (has404 || noRecordReturned) {
        setRecordNotFound(true);
        setError('');
      }
    } catch (err) {
      if (err?.status === 404) {
        setRecordNotFound(true);
        setError('');
      } else {
        setError(err.message || 'Verification service error');
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!routingToast) return undefined;
    const timer = window.setTimeout(() => setRoutingToast(''), 3000);
    return () => window.clearTimeout(timer);
  }, [routingToast]);

  useEffect(() => {
    if (effectiveCredId) {
      setCredentialId(effectiveCredId);
      setActiveTab('direct');
      setHashMatch(null);
    }
    if (effectiveDocHash) setDocumentHash(effectiveDocHash);
    if (effectiveDocId) setDocumentId(effectiveDocId);

    if (effectiveCredId) {
      executeEvaluation(effectiveCredId, effectiveDocHash, effectiveDocId);
    } else if (effectiveDocHash) {
      setHashMatch(null);
      (async () => {
        try {
          const lookup = await api.verify.documentHash(effectiveDocHash);
          const match = lookup?.data || lookup;
          setHashMatch(match?.matchedOrganization ? match : { matchedOrganization: null });
          if (match?.credentialId) setCredentialId(match.credentialId);
          await executeEvaluation(match?.credentialId || '', effectiveDocHash, effectiveDocId);
        } catch {
          setHashMatch({ matchedOrganization: null });
          await executeEvaluation('', effectiveDocHash, effectiveDocId);
        }
      })();
    }
  }, [effectiveCredId, effectiveDocHash, effectiveDocId]);

  async function handleVerify(e) {
    if (e) e.preventDefault();
    await executeEvaluation();
  }

  async function handleDirectFile(file) {
    if (!file) return;
    setError('');
    setUploadHashToast('');
    try {
      if (!window.crypto?.subtle) throw new Error('Secure SHA-256 hashing is unavailable in this browser.');
      const fileBytes = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Could not read the selected file.'));
        reader.readAsArrayBuffer(file);
      });
      const digest = await window.crypto.subtle.digest('SHA-256', fileBytes);
      const hash = Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
      setHashMatch(null);
      setCredentialId('');
      setDocumentId('');
      setDocumentHash(hash);
      setUploadHashToast(`Calculated File SHA-256: ${hash.slice(0, 20)}...`);
      const lookup = await api.verify.documentHash(hash);
      const match = lookup?.data || lookup;
      setHashMatch(match?.matchedOrganization ? match : { matchedOrganization: null });
      if (match?.credentialId) setCredentialId(match.credentialId);
      await executeEvaluation(match?.credentialId || '', hash, '');
    } catch (err) {
      setError(err.message || 'Unable to calculate the document hash.');
    }
  }

  function handleQuickTest(kind) {
    if (kind === 'credential') {
      const sampleCredentialId = 'crd_0d9eaeadeb0148ac';
      setCredentialId(sampleCredentialId);
      setDocumentHash('');
      setDocumentId('');
      executeEvaluation(sampleCredentialId, '', '');
      return;
    }
    const sampleHash = '931aab944aa9ce6a66a0...';
    setCredentialId('');
    setDocumentHash(sampleHash);
    setDocumentId('');
    executeEvaluation('', sampleHash, '');
  }

  async function handleSimulateTamper(tamperType) {
    if (!credentialId) return;
    setTamperLoading(true);
    try {
      await api.credentials.simulateTamper(credentialId, tamperType);
      setTamperingSimulated(true);
      // Re-run verification to immediately showcase mathematical failure
      await executeEvaluation(credentialId);
    } catch (err) {
      setError(err.message || 'Failed to simulate tamper');
    } finally {
      setTamperLoading(false);
    }
  }

  function handleCopyShareLink() {
    if (!credentialId) return;
    const url = `${window.location.origin}/verify/${credentialId}`;
    navigator.clipboard.writeText(url);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
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

  const downloadsDisabled = publicData?.status === 'NOT_FOUND' || publicData?.verified === false;

  return (
    <div className="page-content public-verify-page">
      <div className="public-verify-container">
      {/* Workflow Navigation Banner */}
      <div className="glass-card" style={{ padding: '0.75rem 1.25rem', marginBottom: '1.25rem', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(0, 240, 255, 0.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.8rem' }}>
          <span className="text-muted" style={{ fontWeight: 600 }}>PORTAL:</span>
          <span 
            style={{ cursor: 'pointer', color: 'var(--accent-cyan)' }} 
            onClick={() => onNavigate && onNavigate('dashboard')}
          >
            Dashboard
          </span>
          <span className="text-muted">→</span>
          <strong style={{ color: '#fff', textDecoration: 'underline' }}>Public Verification & Proof Engine</strong>
          <span className="text-muted">→</span>
          <span className={verificationResult ? 'text-cyan' : 'text-muted'}>
            {verificationResult ? `Status: ${verificationResult.finalResult || verificationResult.overallStatus}` : 'Awaiting Input'}
          </span>
        </div>
      </div>

      <div className="page-header">
        <div>
          <h2>{isHrMode ? 'HR & Candidate Verification Portal' : 'Public Cryptographic Verification Portal'}</h2>
          <p className="page-subtitle">
            Zero-trust verification engine • Validates candidate claims, Ed25519 digital signatures, RFC 8785 canonicalization, and tamper-evident audit-chain continuity.
          </p>
        </div>
        {(isHrMode || isAdmin) && (
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button 
              type="button"
              className={`action-btn ${activeTab === 'hr_candidate' ? 'primary' : 'secondary'} text-xs`}
              onClick={() => setActiveTab('hr_candidate')}
            >
              <User size={13} /> Candidate Subject Lookup
            </button>
            <button 
              type="button"
              className={`action-btn ${activeTab === 'direct' ? 'primary' : 'secondary'} text-xs`}
              onClick={() => setActiveTab('direct')}
            >
              <ShieldCheck size={13} /> Direct Credential / Hash
            </button>
          </div>
        )}
      </div>

      {routingToast && (
        <div role="status" className="alert-banner neutral" style={{ position: 'fixed', right: '1.5rem', bottom: '1.5rem', zIndex: 1000, boxShadow: '0 8px 24px rgba(0,0,0,.25)' }}>
          <Check size={16} /> <span>{routingToast}</span>
        </div>
      )}

      {/* ─── TAB 1: HR CANDIDATE LOOKUP FLOW ─── */}
      {activeTab === 'hr_candidate' && (
        <div style={{ marginBottom: '2rem' }}>
          <div className="glass-card" style={{ marginBottom: '1.5rem' }}>
            <h3>HR Candidate Subject Verification</h3>
            <p className="text-secondary text-sm" style={{ marginBottom: '1.25rem' }}>
              Enter a candidate's registered User ID or Email address to inspect all issued credentials and execute cryptographic proof evaluations.
            </p>

            {hrError && (
              <div className="alert-banner danger" style={{ marginBottom: '1rem' }}>
                <AlertCircle size={16} />
                <span>{hrError}</span>
              </div>
            )}

            <form onSubmit={handleHrCandidateLookup} style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '280px' }}>
                <input
                  type="text"
                  placeholder="Candidate User ID (usr_...) or Email (scholar@stanford.edu)"
                  value={hrSubjectQuery}
                  onChange={(e) => setHrSubjectQuery(e.target.value)}
                  required
                />
              </div>
              <button type="submit" className="action-btn primary" disabled={hrLoading}>
                <Search size={15} />
                {hrLoading ? 'Searching Candidate...' : 'Look Up Candidate'}
              </button>
            </form>
          </div>

          {/* Candidate Profile Summary */}
          {hrSubjectData && (
            <div className="glass-card" style={{ marginBottom: '1.5rem', border: '1px solid rgba(0, 240, 255, 0.25)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                  <div style={{ width: '42px', height: '42px', borderRadius: '50%', background: 'var(--gradient-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700 }}>
                    {hrSubjectData.name?.charAt(0) || 'C'}
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: '1.15rem' }}>{hrSubjectData.name}</h3>
                    <div className="text-secondary text-xs" style={{ display: 'flex', gap: '0.6rem', marginTop: '0.2rem' }}>
                      <span>{hrSubjectData.email}</span>
                      <span>·</span>
                      <span className="code-snippet text-xs">{hrSubjectData.userId}</span>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                  <span className="badge-tag">Status: {hrSubjectData.status}</span>
                  <span className="text-muted text-xs">Joined {new Date(hrSubjectData.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          )}

          {/* Candidate Credentials List */}
          {hrSubjectData && (
            <div style={{ marginBottom: '1.5rem' }}>
              <div className="section-header">
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Award size={18} className="text-cyan" />
                  <h3>Candidate Issued Credentials ({hrCredentials.length})</h3>
                </div>
                <span className="text-muted text-xs">All workforce credentials attached to this candidate</span>
              </div>

              {hrCredentials.length === 0 ? (
                <div className="glass-card empty-state">
                  <Award size={36} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
                  <p>No workforce credentials have been issued to this candidate yet.</p>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '1rem' }}>
                  {hrCredentials.map((cred) => {
                    const isSelected = hrSelectedCred?.credentialId === cred.credentialId;
                    const keyStatus = String(cred.keyStatus || cred.issuerKey?.status || (cred.digitalSignatureValid ? 'ACTIVE' : 'UNKNOWN')).toUpperCase();
                    const keyStatusStyle = keyStatus === 'ACTIVE'
                      ? { color: '#10b981', borderColor: 'rgba(16,185,129,.4)', background: 'rgba(16,185,129,.1)' }
                      : keyStatus === 'REVOKED'
                        ? { color: '#ef4444', borderColor: 'rgba(239,68,68,.4)', background: 'rgba(239,68,68,.1)' }
                        : keyStatus === 'EXPIRED'
                          ? { color: '#f59e0b', borderColor: 'rgba(245,158,11,.4)', background: 'rgba(245,158,11,.1)' }
                          : { color: 'var(--text-muted)' };
                    return (
                      <div 
                        key={cred.credentialId}
                        className="glass-card"
                        style={{
                          border: isSelected ? '2px solid var(--accent-cyan)' : '1px solid var(--border-subtle)',
                          position: 'relative',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          padding: '1.25rem'
                        }}
                      >
                        <div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
                            <div>
                              <span className="badge-tag" style={{ fontSize: '0.7rem', marginBottom: '0.35rem', display: 'inline-block' }}>
                                {cred.credentialType}
                              </span>
                              <h4 style={{ margin: 0, fontSize: '1rem', color: '#fff' }}>{cred.title}</h4>
                            </div>
                            <StatusBadge status={cred.status} />
                          </div>

                          <div className="detail-row" style={{ padding: '0.25rem 0' }}>
                            <span className="detail-label" style={{ fontSize: '0.75rem' }}>Credential ID</span>
                            <span className="code-snippet text-xs">{cred.credentialId}</span>
                          </div>

                          <div className="detail-row" style={{ padding: '0.25rem 0' }}>
                            <span className="detail-label" style={{ fontSize: '0.75rem' }}>Issuing Organization</span>
                            <span style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Building size={12} className="text-muted" />
                              {cred.organization?.name || cred.issuer?.issuerName}
                              {cred.organization?.isVerified && (
                                <span style={{ color: '#10b981', display: 'inline-flex', alignItems: 'center' }} title="Verified Organization">
                                  <Check size={13} />
                                </span>
                              )}
                            </span>
                          </div>

                          <div className="detail-row" style={{ padding: '0.25rem 0' }}>
                            <span className="detail-label" style={{ fontSize: '0.75rem' }}>Org Trust Status</span>
                            <span className="badge-tag" style={{ fontSize: '0.7rem', color: cred.organization?.isVerified ? '#10b981' : 'var(--text-muted)' }}>
                              {cred.organization?.verificationStatus || 'UNVERIFIED'}
                            </span>
                          </div>

                          <div className="detail-row" style={{ padding: '0.25rem 0' }}>
                            <span className="detail-label" style={{ fontSize: '0.75rem' }}>Key Status</span>
                            <span className="badge-tag" style={{ fontSize: '0.7rem', ...keyStatusStyle }}>
                              {keyStatus === 'ACTIVE' ? 'VERIFIED / ACTIVE' : keyStatus}
                            </span>
                          </div>

                          <div className="detail-row" style={{ padding: '0.25rem 0' }}>
                            <span className="detail-label" style={{ fontSize: '0.75rem' }}>Digital Signature</span>
                            <span style={{ fontSize: '0.8rem', color: cred.signatureValid ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                              {cred.signatureValid ? '✓ Valid (Ed25519)' : '✗ Invalid'}
                            </span>
                          </div>

                          <div className="detail-row" style={{ padding: '0.25rem 0' }}>
                            <span className="detail-label" style={{ fontSize: '0.75rem' }}>Dates</span>
                            <span className="text-muted text-xs">
                              Issued: {new Date(cred.issuedAt).toLocaleDateString()}
                              {cred.expiresAt && ` · Exp: ${new Date(cred.expiresAt).toLocaleDateString()}`}
                            </span>
                          </div>

                          {/* Trust Level Indicator */}
                          <div style={{ marginTop: '0.75rem', padding: '0.5rem', background: 'rgba(255, 255, 255, 0.02)', borderRadius: 'var(--radius-sm)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem' }}>
                              <span className="text-muted">Trust Level:</span>
                              <strong style={{ color: cred.trustLevel?.includes('LEVEL 5') ? '#10b981' : 'var(--accent-cyan)' }}>
                                {cred.trustLevel}
                              </strong>
                            </div>
                          </div>
                        </div>

                        <div style={{ marginTop: '1rem', paddingTop: '0.75rem', borderTop: '1px solid var(--border-subtle)' }}>
                          <button
                            type="button"
                            className="action-btn primary full-width text-xs"
                            onClick={() => handleHrVerifyCredential(cred)}
                            disabled={loading}
                          >
                            <ShieldCheck size={14} />
                            {isSelected && verificationResult ? 'Re-Verify Proof Details' : 'Verify Full Evidence'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Search performed with no match */}
          {hrSearched && !hrSubjectData && !hrLoading && !hrError && (
            <div className="glass-card empty-state">
              <User size={36} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
              <p>No registered candidate user found matching "{hrSubjectQuery}".</p>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 2: DIRECT VERIFICATION FORM (Always available or in direct tab) ─── */}
      {activeTab === 'direct' && (
        <div className="glass-card" style={{ marginBottom: '2rem' }}>
          <h3>Verify Credential Target</h3>
          <p className="text-secondary text-sm" style={{ marginBottom: '1.25rem' }}>
            Select an active credential or paste a Credential ID or document SHA-256 hash.
          </p>

          {error && (
            <div className="alert-banner danger" style={{ marginBottom: '1rem' }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {recordNotFound && (
            <div className="glass-card" role="alert" style={{ marginBottom: '1rem', padding: '1.25rem', border: '1px solid rgba(239, 68, 68, 0.35)', background: 'rgba(127, 29, 29, 0.16)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: '#fca5a5', fontWeight: 700 }}>
                <AlertCircle size={18} /> Credential Record Not Found
              </div>
              <p className="text-secondary text-sm" style={{ margin: '0.5rem 0 0' }}>
                No verification record was found for this identifier. Check the credential ID and try again.
              </p>
            </div>
          )}

          <form onSubmit={handleVerify} className="form-grid-3">
            {candidateCredentials.length > 0 && (
              <div className="form-group" style={{ gridColumn: 'span 3', marginBottom: '0.5rem' }}>
                <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Quick-Select Candidate Credential</span>
                  <span className="text-muted text-xs">Pre-loaded from accredited issuer registry</span>
                </label>
                <select
                  className="select-input public-verification-input"
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
                  <option value="">-- Select a Sample Credential or Enter Manually --</option>
                  {candidateCredentials.map((c) => (
                    <option key={c.credentialId} value={c.credentialId}>
                      {c.title} ({c.credentialId}) — [{c.status}]
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="form-group">
              <label>Credential ID</label>
              <input
                type="text"
                className="public-verification-input"
                placeholder="crd_0123456789abcdef"
                value={credentialId}
                onChange={(e) => setCredentialId(e.target.value)}
              />
              <div className="public-verify-quick-tests">
                <button type="button" className="action-btn secondary text-xs" onClick={() => handleQuickTest('credential')}>
                  Sample Credential ID: crd_0d9eaeadeb0148ac
                </button>
                <button type="button" className="action-btn secondary text-xs" onClick={() => handleQuickTest('hash')}>
                  Sample Document Hash: 931aab944aa9ce6a66a0...
                </button>
              </div>
            </div>

            <div className="form-group">
              <label>Document SHA-256 Hash</label>
              <input
                type="text"
                className="public-verification-input"
                placeholder="e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
                value={documentHash}
                onChange={(e) => setDocumentHash(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label>Document Artifact ID (Optional)</label>
              <input
                type="text"
                className="public-verification-input"
                placeholder="doc_0123456789abcdef"
                value={documentId}
                onChange={(e) => setDocumentId(e.target.value)}
              />
            </div>

            <div className="form-group public-verify-upload-group" style={{ gridColumn: 'span 3' }}>
              <label htmlFor="direct-verification-file">Upload Candidate Document (.pdf, .jpg, .png)</label>
              <div
                className="public-verify-dropzone"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  handleDirectFile(event.dataTransfer.files?.[0]);
                  event.dataTransfer.clearData();
                }}
              >
                <FileText size={20} />
                <span>Drop a candidate document here or choose a file</span>
                <input
                  id="direct-verification-file"
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
                  onChange={(event) => {
                    handleDirectFile(event.target.files?.[0]);
                    event.target.value = '';
                  }}
                />
              </div>
              {uploadHashToast && <div className="public-verify-hash-toast" role="status"><CheckCircle2 size={14} />{uploadHashToast}</div>}
            </div>

            <div className="form-submit-row" style={{ gridColumn: 'span 3', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button type="submit" className="action-btn primary" disabled={loading}>
                <ShieldCheck size={16} />
                {loading ? 'Evaluating Proofs...' : 'Verify Cryptographic Proofs'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Recruiter / Employer Wow Verification Card */}
      {publicData && (
        <div className={`glass-card public-verification-result ${publicData?.verified ? 'is-verified' : 'is-failed'}`}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
                <h3 style={{ fontSize: '1.3rem', margin: 0 }}>{publicData?.title || 'Credential Verification'}</h3>
                <StatusBadge status={publicData?.status || 'UNKNOWN'} />
                {publicData?.verified ? (
                  <span className="level-badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#10b981', borderColor: 'rgba(16, 185, 129, 0.4)' }}>
                    ✓ MATHEMATICALLY VALID
                  </span>
                ) : (
                  <span className="level-badge" style={{ background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', borderColor: 'rgba(239, 68, 68, 0.4)' }}>
                    ✗ VERIFICATION FAILED
                  </span>
                )}
              </div>
              <p className="text-secondary text-sm" style={{ margin: 0 }}>
                Issued by <strong>{publicData?.organizationName || publicData?.organization?.name || publicData?.issuer?.organizationName || publicData?.issuer?.name || 'Unspecified Organization'}</strong> ({publicData?.issuer?.officialDomain || 'Domain unavailable'}) • Candidate: <strong>{publicData?.recipient?.displayName || 'Unspecified Candidate'}</strong>
              </p>
            </div>

            {/* QR Code & Direct Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ textAlign: 'center' }}>
                <img 
                  src={`/api/public/qr/${publicData?.credentialId || credentialId}`} 
                  alt="Verification QR" 
                  style={{ width: '80px', height: '80px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', background: '#fff', padding: '4px' }} 
                />
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '2px' }}>Scan to Verify</div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                {downloadsDisabled && (
                  <div role="status" className="alert-banner danger" style={{ maxWidth: '280px', fontSize: '0.75rem' }}>
                    Cryptographic bundles are generated for registered credentials. This uploaded file is an unregistered document.
                  </div>
                )}
                <a 
                  href={downloadsDisabled ? undefined : `/api/public/pdf/${publicData?.credentialId || credentialId}`}
                  target={downloadsDisabled ? undefined : '_blank'}
                  rel="noreferrer"
                  aria-disabled={downloadsDisabled}
                  tabIndex={downloadsDisabled ? -1 : 0}
                  onClick={downloadsDisabled ? (event) => event.preventDefault() : undefined}
                  className="action-btn primary text-xs" 
                  style={{ textDecoration: 'none', opacity: downloadsDisabled ? 0.5 : 1, cursor: downloadsDisabled ? 'not-allowed' : 'pointer' }}
                >
                  <Download size={13} /> PDF Certificate
                </a>
                <a 
                  href={downloadsDisabled ? undefined : `/api/public/bundle/${publicData?.credentialId || credentialId}`}
                  target={downloadsDisabled ? undefined : '_blank'}
                  rel="noreferrer"
                  aria-disabled={downloadsDisabled}
                  tabIndex={downloadsDisabled ? -1 : 0}
                  onClick={downloadsDisabled ? (event) => event.preventDefault() : undefined}
                  className="action-btn secondary text-xs" 
                  style={{ textDecoration: 'none', opacity: downloadsDisabled ? 0.5 : 1, cursor: downloadsDisabled ? 'not-allowed' : 'pointer' }}
                >
                  <FileText size={13} /> Offline Bundle (.json)
                </a>
                <a 
                  href={`/api/public/w3c/${publicData?.credentialId || credentialId}`} 
                  target="_blank" 
                  rel="noreferrer"
                  className="action-btn secondary text-xs" 
                  style={{ textDecoration: 'none' }}
                >
                  <Globe size={13} /> W3C VC (.json)
                </a>
              </div>
            </div>
          </div>

          {/* Explainable Confidence Score Breakdown */}
          <div style={{ marginBottom: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <h4 style={{ margin: 0, fontSize: '0.95rem' }}>Verification Confidence Score Breakdown</h4>
              <strong style={{ fontSize: '1.2rem', color: (publicData?.confidenceScore || 0) >= 85 ? '#10b981' : ((publicData?.confidenceScore || 0) >= 50 ? '#f59e0b' : '#ef4444') }}>
                {publicData?.confidenceScore ?? 0} / 100
              </strong>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
              {publicData?.confidenceBreakdown && Object.entries(publicData.confidenceBreakdown).map(([key, factor]) => {
                if (factor.advisory) return null;
                return (
                  <div key={key} style={{ padding: '0.75rem', background: 'rgba(255,255,255,0.02)', borderRadius: '6px', border: `1px solid ${factor.passed ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)'}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', fontWeight: 600, marginBottom: '0.2rem' }}>
                      <span style={{ color: factor.passed ? '#10b981' : '#ef4444' }}>
                        {factor.passed ? '✔' : '✖'} {key.replace(/([A-Z])/g, ' $1').toUpperCase()}
                      </span>
                      <span>+{factor.score}/{factor.weight}</span>
                    </div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', lineHeight: '1.2' }}>
                      {factor.description}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Cryptography & Audit Chain details */}
          <div className="detail-grid-2" style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '6px' }}>
            <div>
              <span className="text-muted text-xs">SIGNATURE ALGORITHM:</span>
              <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{publicData?.cryptography?.algorithm || 'Unavailable'} (RFC 8785 JCS)</div>
            </div>
            <div>
              <span className="text-muted text-xs">SIGNATURE FINGERPRINT:</span>
              <div className="code-snippet hash-text text-xs">{publicData?.cryptography?.signatureFingerprint || 'UNSIGNED'}...</div>
            </div>
            <div>
              <span className="text-muted text-xs">AUDIT-CHAIN HEAD PROOF:</span>
              <div className="code-snippet hash-text text-xs">Block #{publicData?.auditProof?.sequenceNumber ?? '—'} ({publicData?.auditProof?.entryHash ? publicData.auditProof.entryHash.slice(0, 16) : 'GENESIS'}...)</div>
            </div>
            <div>
              <span className="text-muted text-xs">SHAREABLE VERIFY LINK:</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '2px' }}>
                <input 
                  type="text" 
                  className="public-verification-input"
                  readOnly 
                  value={`${window.location.origin}/verify/${publicData?.credentialId || credentialId}`} 
                  style={{ fontSize: '0.75rem', padding: '4px 8px' }}
                />
                <button className="action-btn secondary text-xs" onClick={handleCopyShareLink}>
                  <Copy size={12} /> {copiedLink ? 'Copied!' : 'Copy'}
                </button>
              </div>
            </div>
          </div>

          {/* Tamper Test Lab (For live demonstrations) */}
          <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <strong style={{ color: '#f59e0b', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Zap size={15} /> In-App Tamper Demo Lab:
              </strong>
              <span className="text-muted text-xs">
                Simulate deliberate tampering on this record to watch the verification engine mathematically reject it in real-time.
              </span>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              <button 
                className="action-btn danger text-xs" 
                onClick={() => handleSimulateTamper('SIGNATURE')}
                disabled={tamperLoading}
              >
                <ShieldX size={13} /> Corrupt 1 Byte in Signature
              </button>
              <button 
                className="action-btn danger text-xs" 
                onClick={() => handleSimulateTamper('DOCUMENT')}
                disabled={tamperLoading}
              >
                <ShieldAlert size={13} /> Alter Document Payload
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Categorical Trust Evidence Results */}
      {hashMatch && (
        <section
          className="glass-card"
          role={hashMatch.matchedOrganization ? 'status' : 'alert'}
          aria-live="polite"
          style={{ marginBottom: '1rem', border: `1px solid ${hashMatch.matchedOrganization ? 'rgba(16,185,129,.4)' : 'rgba(239,68,68,.4)'}` }}
        >
          {hashMatch.matchedOrganization ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
              <div>
                <h3 style={{ margin: '0 0 .35rem' }}>Issuing Organization Resolved</h3>
                <div>Verified Source: <strong>{hashMatch.matchedOrganization.name}</strong> (Domain: {hashMatch.matchedOrganization.domain || 'unavailable'})</div>
                {hashMatch.credentialId && <div className="text-muted text-xs" style={{ marginTop: '.35rem' }}>Credential ID: {hashMatch.credentialId}</div>}
              </div>
              <span className="level-badge" style={{ background: 'rgba(16,185,129,.15)', color: '#10b981', borderColor: 'rgba(16,185,129,.4)' }}>TRUSTED ANCHOR</span>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '.6rem', color: '#ef4444' }}>
              <AlertCircle size={18} />
              <div><strong>Unregistered Document Hash:</strong> No matching entry in official registry</div>
            </div>
          )}
        </section>
      )}
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
    </div>
  );
}

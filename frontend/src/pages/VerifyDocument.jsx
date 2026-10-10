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
  const initialCred = routeParams?.credentialId || location?.state?.credentialId || initialParams?.credentialId || '';
  const initialDocHash = location?.state?.documentHash || initialParams?.documentHash || '';
  const initialDocId = location?.state?.documentId || initialParams?.documentId || '';

  const [activeTab, setActiveTab] = useState(isHrMode ? 'hr_candidate' : 'direct');
  const [credentialId, setCredentialId] = useState(initialCred);
  const [documentHash, setDocumentHash] = useState(initialDocHash);
  const [documentId, setDocumentId] = useState(initialDocId);
  const [candidateCredentials, setCandidateCredentials] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [verificationResult, setVerificationResult] = useState(null);
  const [publicData, setPublicData] = useState(null);
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
    setReviewMessage('');

    try {
      const payload = {};
      if (cid) payload.credentialId = cid.trim();
      if (dhash) payload.documentHash = dhash.trim();
      if (did) payload.documentId = did.trim();

      const [res, pubRes] = await Promise.all([
        api.verifications.evaluate(payload),
        cid ? api.public.verify(cid.trim()).catch(() => null) : Promise.resolve(null)
      ]);

      if (res && res.success) {
        setVerificationResult(res.data);
      } else {
        setError(res?.error?.message || 'Verification failed');
      }

      if (pubRes && pubRes.success) {
        setPublicData(pubRes.data);
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

  return (
    <div className="page-content">
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
                            <span className="badge-tag" style={{ fontSize: '0.7rem' }}>{cred.keyStatus}</span>
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

          <form onSubmit={handleVerify} className="form-grid-3">
            {candidateCredentials.length > 0 && (
              <div className="form-group" style={{ gridColumn: 'span 3', marginBottom: '0.5rem' }}>
                <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>Quick-Select Candidate Credential</span>
                  <span className="text-muted text-xs">Pre-loaded from accredited issuer registry</span>
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
        <div className="glass-card" style={{ marginBottom: '2rem', border: publicData.verified ? '1px solid rgba(16, 185, 129, 0.4)' : '1px solid rgba(239, 68, 68, 0.4)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '1rem', marginBottom: '1.25rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
                <h3 style={{ fontSize: '1.3rem', margin: 0 }}>{publicData.title}</h3>
                <StatusBadge status={publicData.status} />
                {publicData.verified ? (
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
                Issued by <strong>{publicData.issuer.organizationName}</strong> ({publicData.issuer.officialDomain}) • Candidate: <strong>{publicData.recipient.displayName}</strong>
              </p>
            </div>

            {/* QR Code & Direct Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <div style={{ textAlign: 'center' }}>
                <img 
                  src={`/api/public/qr/${publicData.credentialId}`} 
                  alt="Verification QR" 
                  style={{ width: '80px', height: '80px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.15)', background: '#fff', padding: '4px' }} 
                />
                <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '2px' }}>Scan to Verify</div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <a 
                  href={`/api/public/pdf/${publicData.credentialId}`} 
                  target="_blank" 
                  rel="noreferrer"
                  className="action-btn primary text-xs" 
                  style={{ textDecoration: 'none' }}
                >
                  <Download size={13} /> PDF Certificate
                </a>
                <a 
                  href={`/api/public/bundle/${publicData.credentialId}`} 
                  target="_blank" 
                  rel="noreferrer"
                  className="action-btn secondary text-xs" 
                  style={{ textDecoration: 'none' }}
                >
                  <FileText size={13} /> Offline Bundle (.json)
                </a>
                <a 
                  href={`/api/public/w3c/${publicData.credentialId}`} 
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
              <strong style={{ fontSize: '1.2rem', color: publicData.confidenceScore >= 85 ? '#10b981' : (publicData.confidenceScore >= 50 ? '#f59e0b' : '#ef4444') }}>
                {publicData.confidenceScore} / 100
              </strong>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
              {publicData.confidenceBreakdown && Object.entries(publicData.confidenceBreakdown).map(([key, factor]) => {
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
              <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{publicData.cryptography.algorithm} (RFC 8785 JCS)</div>
            </div>
            <div>
              <span className="text-muted text-xs">SIGNATURE FINGERPRINT:</span>
              <div className="code-snippet hash-text text-xs">{publicData.cryptography.signatureFingerprint || 'UNSIGNED'}...</div>
            </div>
            <div>
              <span className="text-muted text-xs">AUDIT-CHAIN HEAD PROOF:</span>
              <div className="code-snippet hash-text text-xs">Block #{publicData.auditProof.sequenceNumber} ({publicData.auditProof.entryHash ? publicData.auditProof.entryHash.slice(0, 16) : 'GENESIS'}...)</div>
            </div>
            <div>
              <span className="text-muted text-xs">SHAREABLE VERIFY LINK:</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '2px' }}>
                <input 
                  type="text" 
                  readOnly 
                  value={`${window.location.origin}/verify/${publicData.credentialId}`} 
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

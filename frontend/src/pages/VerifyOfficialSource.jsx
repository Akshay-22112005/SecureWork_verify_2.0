import React, { useState, useEffect } from 'react';
import { ExternalLink, Search, ShieldCheck, AlertCircle, CheckCircle2, Building, RefreshCw } from 'lucide-react';
import api from '../services/api';
import StatusBadge from '../components/StatusBadge';

export default function VerifyOfficialSource({ initialParams = {}, onNavigate }) {
  const [sources, setSources] = useState([]);
  const [selectedSourceCode, setSelectedSourceCode] = useState(initialParams.sourceCode || '');
  const [credentialIdentifier, setCredentialIdentifier] = useState(initialParams.credentialIdentifier || initialParams.credentialId || '');
  const [documentHash, setDocumentHash] = useState(initialParams.documentHash || '');
  const [candidateOptions, setCandidateOptions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sourcesLoading, setSourcesLoading] = useState(true);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  async function loadSources() {
    setSourcesLoading(true);
    try {
      const res = await api.trustedSources.list();
      if (res && res.success) {
        const list = res.data?.trustedSources || res.data?.sources || [];
        setSources(list);
        if (list[0] && !selectedSourceCode) {
          setSelectedSourceCode(list[0].sourceCode);
        }
      }
    } catch (err) {
      console.warn('Failed to load trusted sources', err);
    } finally {
      setSourcesLoading(false);
    }
  }

  useEffect(() => {
    loadSources();

    async function loadCandidates() {
      try {
        const credRes = await api.credentials.list({ limit: 6 });
        if (credRes && credRes.success && credRes.data?.credentials) {
          setCandidateOptions(credRes.data.credentials);
        }
      } catch {}
    }
    loadCandidates();
  }, []);

  async function handleVerifySource(e) {
    if (e) e.preventDefault();
    if (!selectedSourceCode || !credentialIdentifier) {
      setError('Please select a trusted source and provide a candidate credential identifier.');
      return;
    }
    setError('');
    setLoading(true);
    setResult(null);

    try {
      const res = await api.verifications.verifySource({
        sourceCode: selectedSourceCode,
        credentialIdentifier: credentialIdentifier.trim(),
        queryParams: {
          identifier: credentialIdentifier.trim(),
          documentHash: documentHash ? documentHash.trim() : undefined
        },
        documentHash: documentHash ? documentHash.trim() : undefined
      });

      if (res && res.success) {
        setResult(res.data);
      } else {
        setError(res?.error?.message || 'Official source verification failed');
      }
    } catch (err) {
      setError(err.message || 'Source verification query error');
    } finally {
      setLoading(false);
    }
  }

  function handleSelectQuickId(idVal, sCode = null) {
    setCredentialIdentifier(idVal);
    if (sCode) {
      setSelectedSourceCode(sCode);
    }
  }

  return (
    <div className="page-content">
      {/* Workflow Navigation Banner */}
      <div className="glass-card" style={{ padding: '0.75rem 1.25rem', marginBottom: '1.25rem', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(0, 240, 255, 0.15)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.8rem' }}>
          <span className="text-muted" style={{ fontWeight: 600 }}>WORKFLOW:</span>
          <strong style={{ color: '#fff', textDecoration: 'underline' }}>Verify Official Source</strong>
          <span className="text-muted">→</span>
          <span className={selectedSourceCode ? 'text-cyan' : 'text-muted'}>Trusted Source ({selectedSourceCode || 'Select'})</span>
          <span className="text-muted">→</span>
          <span className="text-muted">Backend Verification Engine</span>
          <span className="text-muted">→</span>
          <span className={result ? 'text-success' : 'text-muted'}>Authoritative Result</span>
          {result && (
            <>
              <span className="text-muted">→</span>
              <span 
                style={{ cursor: 'pointer', color: 'var(--accent-purple)' }}
                onClick={() => onNavigate && onNavigate('verification_evidence', { verificationId: result.verificationId })}
              >
                Exact Evidence Record
              </span>
            </>
          )}
        </div>
      </div>

      <div className="page-header">
        <div>
          <h2>Official Trusted Source Verification</h2>
          <p className="page-subtitle">
            Query registered accreditation registries and university registrar portals with SSRF-safe host validation.
          </p>
        </div>
        <button className="action-btn secondary text-xs" onClick={loadSources} disabled={sourcesLoading}>
          <RefreshCw size={14} className={sourcesLoading ? 'pulse-dot' : ''} /> Refresh Sources
        </button>
      </div>

      <div className="two-column-layout">
        {/* Form */}
        <div className="glass-card">
          <h3>Query Official Registry</h3>
          <p className="text-secondary text-sm" style={{ marginBottom: '1.25rem' }}>
            Only accredited, administrator-approved TrustedSource records can be queried. Arbitrary external URLs are rejected.
          </p>

          {error && (
            <div className="alert-banner danger" style={{ marginBottom: '1rem' }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* Quick-fill helpers for verification testing */}
          <div style={{ marginBottom: '1.25rem', padding: '0.65rem 0.85rem', background: 'rgba(0, 0, 0, 0.25)', borderRadius: '6px', border: '1px dashed rgba(255, 255, 255, 0.1)' }}>
            <span className="text-muted text-xs" style={{ display: 'block', marginBottom: '0.4rem', fontWeight: 600 }}>
              QUICK TEST IDENTIFIERS (Pre-seeded & Active Qualifications):
            </span>
            <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
              <button 
                type="button"
                className="action-btn secondary text-xs"
                style={{ padding: '2px 8px', fontSize: '0.72rem' }}
                onClick={() => handleSelectQuickId('STAN-2024-8849')}
                title="Stanford Registrar Signed PhD Qualification"
              >
                STAN-2024-8849 (PhD Degree)
              </button>
              <button 
                type="button"
                className="action-btn secondary text-xs"
                style={{ padding: '2px 8px', fontSize: '0.72rem' }}
                onClick={() => handleSelectQuickId('LIC_CRYPTO_771')}
                title="Cryptographic License Record"
              >
                LIC_CRYPTO_771 (Crypto License)
              </button>
              <button 
                type="button"
                className="action-btn secondary text-xs"
                style={{ padding: '2px 8px', fontSize: '0.72rem' }}
                onClick={() => handleSelectQuickId('LIC_PE_99482')}
                title="State Engineering Board License"
              >
                LIC_PE_99482 (PE License)
              </button>
              {candidateOptions.slice(0, 2).map((c) => (
                <button
                  key={c.credentialId}
                  type="button"
                  className="action-btn secondary text-xs"
                  style={{ padding: '2px 8px', fontSize: '0.72rem', borderColor: 'var(--accent-cyan)' }}
                  onClick={() => handleSelectQuickId(c.credentialId)}
                  title={`Candidate Credential: ${c.title}`}
                >
                  {c.credentialId}
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleVerifySource}>
            <div className="form-group">
              <label>Select Whitelisted Trusted Source</label>
              <select
                className="select-input"
                value={selectedSourceCode}
                onChange={(e) => setSelectedSourceCode(e.target.value)}
                required
              >
                {sources.map((s) => (
                  <option key={s.sourceCode} value={s.sourceCode}>
                    {s.name} ({s.sourceCode}) - {s.sourceType} [{s.status}]
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Candidate Credential Identifier</label>
              <input
                type="text"
                placeholder="e.g. STAN-2024-8849 or crd_..."
                value={credentialIdentifier}
                onChange={(e) => setCredentialIdentifier(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Document SHA-256 Digest (Optional)</label>
              <input
                type="text"
                placeholder="Optional document hash for exact bitwise comparison..."
                value={documentHash}
                onChange={(e) => setDocumentHash(e.target.value)}
              />
            </div>

            <button type="submit" className="action-btn primary full-width" disabled={loading || sources.length === 0}>
              <ExternalLink size={16} />
              {loading ? 'Querying Official Registry...' : 'Verify Against Source'}
            </button>
          </form>
        </div>

        {/* Evidence Outcome */}
        <div className="glass-card">
          <h3>Official Source Evidence Record</h3>
          {result ? (
            <div>
              <div className={`alert-banner ${result.verified ? 'success' : 'danger'}`} style={{ marginBottom: '1rem' }}>
                <ShieldCheck size={16} />
                <span>
                  Source Status: <strong>{result.sourceState || (result.verified ? 'SOURCE_VERIFIED' : 'NOT_FOUND')}</strong>
                  {' • '}{result.verified ? 'Record Confirmed by Authority' : 'No Record Located'}
                </span>
              </div>

              <div className="detail-row">
                <span className="detail-label">Verification ID</span>
                <span className="code-snippet" style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>
                  {result.verificationId || 'Preserved'}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Source ID / Code</span>
                <span className="code-snippet">{result.sourceCode || selectedSourceCode}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Source Name</span>
                <strong>{result.sourceName || 'Accredited Authority'}</strong>
              </div>
              <div className="detail-row">
                <span className="detail-label">Origin Domain</span>
                <span className="code-snippet">{result.domain || 'whitelisted'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Cryptographic Response Hash</span>
                <span className="code-snippet hash-text">{result.responseHash}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Digital Signature Present</span>
                <span>
                  {result.rawResponse?.record?.isCryptographicallySigned || result.rawResponse?.signature ? 'YES' : 'NO'}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Authority Determination</span>
                <span>{result.notes || 'Official registry verification evaluated'}</span>
              </div>

              <div style={{ marginTop: '1rem' }}>
                <h4>Registry Response Summary</h4>
                <div className="json-code-box">
                  <pre>{JSON.stringify(result.rawResponse || result.sourceResponseSummary || result, null, 2)}</pre>
                </div>
              </div>

              {/* Action Buttons: Navigate to Exact Verification & Evidence */}
              {onNavigate && (
                <div style={{ marginTop: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  <button
                    className="action-btn primary text-xs"
                    onClick={() => onNavigate('verification_evidence', { 
                      verificationId: result.verificationId,
                      credentialId: credentialIdentifier 
                    })}
                  >
                    Inspect Discrete Evidence Artifact in Evidence Store →
                  </button>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      className="action-btn secondary text-xs"
                      style={{ flex: 1 }}
                      onClick={() => onNavigate('verification_history', { 
                        verificationId: result.verificationId,
                        credentialId: credentialIdentifier 
                      })}
                    >
                      View in Candidate Verification Logs →
                    </button>
                    <button
                      className="action-btn secondary text-xs"
                      style={{ flex: 1 }}
                      onClick={() => onNavigate('verify_document', { 
                        credentialId: credentialIdentifier,
                        documentHash: documentHash 
                      })}
                    >
                      Re-Verify in 16-Check Engine →
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="empty-state">
              <ExternalLink size={36} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
              <p>No source query executed yet.</p>
              <span className="text-muted text-xs">Select a whitelisted authority and candidate identifier on the left to inspect official evidence retrieved from registered sources.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

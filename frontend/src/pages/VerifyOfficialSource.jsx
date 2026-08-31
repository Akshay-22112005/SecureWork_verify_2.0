import React, { useState, useEffect } from 'react';
import { ExternalLink, Search, ShieldCheck, AlertCircle, CheckCircle2, Building, RefreshCw } from 'lucide-react';
import api from '../services/api';
import StatusBadge from '../components/StatusBadge';

export default function VerifyOfficialSource() {
  const [sources, setSources] = useState([]);
  const [selectedSourceCode, setSelectedSourceCode] = useState('');
  const [credentialIdentifier, setCredentialIdentifier] = useState('');
  const [documentHash, setDocumentHash] = useState('');
  const [loading, setLoading] = useState(false);
  const [sourcesLoading, setSourcesLoading] = useState(true);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);

  async function loadSources() {
    setSourcesLoading(true);
    try {
      const res = await api.trustedSources.list();
      if (res && res.success) {
        const list = res.data.sources || [];
        setSources(list);
        if (list[0]) setSelectedSourceCode(list[0].sourceCode);
      }
    } catch (err) {
      console.warn('Failed to load trusted sources', err);
    } finally {
      setSourcesLoading(false);
    }
  }

  useEffect(() => {
    loadSources();
  }, []);

  async function handleVerifySource(e) {
    e.preventDefault();
    if (!selectedSourceCode || !credentialIdentifier) {
      setError('Please select a trusted source and provide a credential identifier.');
      return;
    }
    setError('');
    setLoading(true);
    setResult(null);

    try {
      const res = await api.verifications.verifySource({
        sourceCode: selectedSourceCode,
        credentialIdentifier: credentialIdentifier.trim(),
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

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h2>Official Trusted Source Verification</h2>
          <p className="page-subtitle">
            Query registered accreditation registries and university portals with SSRF-safe host validation.
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
                    {s.name} ({s.sourceCode}) - {s.sourceType}
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
              <div className={`alert-banner ${result.evidenceStatus === 'VERIFIED' ? 'success' : 'warning'}`} style={{ marginBottom: '1rem' }}>
                <ShieldCheck size={16} />
                <span>Source Status: <strong>{result.evidenceStatus || 'RECORD_RETRIEVED'}</strong></span>
              </div>

              <div className="detail-row">
                <span className="detail-label">Source ID</span>
                <span className="code-snippet">{result.sourceId || selectedSourceCode}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Retrieved At</span>
                <span className="text-muted text-xs">{new Date(result.retrievedAt).toLocaleString()}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Cryptographic Response Hash</span>
                <span className="code-snippet hash-text">{result.responseHash}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Digital Signature Present</span>
                <span>{result.signaturePresent ? 'YES' : 'NO'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Signature Valid</span>
                <span>{result.signatureValid ? 'YES - Valid' : 'N/A or Unsigned'}</span>
              </div>

              <div style={{ marginTop: '1rem' }}>
                <h4>Registry Response Summary</h4>
                <div className="json-code-box">
                  <pre>{JSON.stringify(result.sourceResponseSummary || result, null, 2)}</pre>
                </div>
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <ExternalLink size={36} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
              <p>No source query executed yet.</p>
              <span className="text-muted text-xs">Execute a query on the left to inspect official evidence retrieved from registered sources.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

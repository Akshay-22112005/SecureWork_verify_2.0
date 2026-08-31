import React, { useState, useEffect } from 'react';
import { Award, ShieldCheck, AlertCircle, CheckCircle2, ArrowRight, Key } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

export default function IssueCredential({ onNavigate }) {
  const { user } = useAuth();
  const [issuers, setIssuers] = useState([]);
  const [selectedIssuerId, setSelectedIssuerId] = useState('');
  const [recipientId, setRecipientId] = useState('');
  const [documentId, setDocumentId] = useState('');
  const [credentialType, setCredentialType] = useState('DEGREE');
  const [title, setTitle] = useState('');
  const [validityDays, setValidityDays] = useState(730);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [issuedResult, setIssuedResult] = useState(null);

  useEffect(() => {
    async function loadIssuers() {
      try {
        const res = await api.issuers.list();
        if (res && res.success) {
          const list = res.data.issuers || [];
          setIssuers(list);
          const active = list.find((i) => i.status === 'ACTIVE');
          if (active) setSelectedIssuerId(active.issuerId);
          else if (list[0]) setSelectedIssuerId(list[0].issuerId);
        }
      } catch {}
    }
    loadIssuers();
  }, []);

  async function handleIssue(e) {
    e.preventDefault();
    if (!selectedIssuerId || !recipientId || !documentId || !title) {
      setError('Please fill in all required fields.');
      return;
    }
    setError('');
    setLoading(true);
    setIssuedResult(null);

    try {
      const payload = {
        issuerId: selectedIssuerId,
        recipientId: recipientId.trim(),
        documentId: documentId.trim(),
        credentialType,
        title: title.trim(),
        validityDays: Number(validityDays) || 365
      };

      const res = await api.credentials.issue(payload);
      if (res && res.success) {
        setIssuedResult(res.data);
      } else {
        setError(res?.error?.message || 'Failed to issue credential');
      }
    } catch (err) {
      setError(err.message || 'Issuance request failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h2>Issue Signed Workforce Credential</h2>
          <p className="page-subtitle">
            Generate Ed25519 digital signature over canonical RFC 8785 payload and record hash-chained audit trail.
          </p>
        </div>
      </div>

      <div className="two-column-layout">
        {/* Form */}
        <div className="glass-card">
          <h3>Credential Specifications</h3>
          <p className="text-secondary text-sm" style={{ marginBottom: '1.25rem' }}>
            Issuing requires an active issuer profile and an active Ed25519 cryptographic key pair.
          </p>

          {error && (
            <div className="alert-banner danger" style={{ marginBottom: '1rem' }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleIssue}>
            <div className="form-group">
              <label>Issuing Authority Profile</label>
              <select
                className="select-input"
                value={selectedIssuerId}
                onChange={(e) => setSelectedIssuerId(e.target.value)}
                required
              >
                {issuers.map((i) => (
                  <option key={i.issuerId} value={i.issuerId}>
                    {i.issuerCode} ({i.status}) - {i.issuerId}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Recipient Subject (User ID)</label>
              <input
                type="text"
                placeholder="usr_0123456789abcdef"
                value={recipientId}
                onChange={(e) => setRecipientId(e.target.value)}
                required
              />
              <span className="text-muted text-xs">The verified user ID representing the credential recipient.</span>
            </div>

            <div className="form-group">
              <label>Document Artifact ID</label>
              <input
                type="text"
                placeholder="doc_0123456789abcdef"
                value={documentId}
                onChange={(e) => setDocumentId(e.target.value)}
                required
              />
              <span className="text-muted text-xs">Artifact ID from document upload representing the source document.</span>
            </div>

            <div className="form-row-2">
              <div className="form-group">
                <label>Credential Type</label>
                <select
                  className="select-input"
                  value={credentialType}
                  onChange={(e) => setCredentialType(e.target.value)}
                >
                  <option value="DEGREE">DEGREE</option>
                  <option value="DIPLOMA">DIPLOMA</option>
                  <option value="CERTIFICATION">CERTIFICATION</option>
                  <option value="EMPLOYMENT_RECORD">EMPLOYMENT_RECORD</option>
                  <option value="LICENSE">LICENSE</option>
                  <option value="SECURITY_CLEARANCE">SECURITY_CLEARANCE</option>
                  <option value="OTHER">OTHER</option>
                </select>
              </div>

              <div className="form-group">
                <label>Validity (Days)</label>
                <input
                  type="number"
                  min="1"
                  max="3650"
                  value={validityDays}
                  onChange={(e) => setValidityDays(e.target.value)}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Credential Title / Award Designation</label>
              <input
                type="text"
                placeholder="e.g. Master of Science in Cybersecurity"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="action-btn primary full-width" disabled={loading}>
              <Award size={16} />
              {loading ? 'Generating Canonical Signature...' : 'Issue & Sign Credential'}
            </button>
          </form>
        </div>

        {/* Issuance Outcome */}
        <div className="glass-card">
          <h3>Cryptographic Issuance Outcome</h3>
          {issuedResult ? (
            <div>
              <div className="alert-banner success" style={{ marginBottom: '1rem' }}>
                <CheckCircle2 size={16} />
                <span>Credential issued and digitally signed successfully.</span>
              </div>

              <div className="detail-row">
                <span className="detail-label">Credential ID</span>
                <span className="code-snippet">{issuedResult.credential.credentialId}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Version ID</span>
                <span className="code-snippet">{issuedResult.credential.currentVersionId}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Issuer Key ID</span>
                <span className="code-snippet">{issuedResult.version.issuerKeyId}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">Digital Signature</span>
                <span className="code-snippet hash-text">{issuedResult.version.signature}</span>
              </div>

              <div style={{ marginTop: '1.5rem' }}>
                <h4>Canonical Payload Signed</h4>
                <div className="json-code-box">
                  <pre>{JSON.stringify(issuedResult.version.signedPayload, null, 2)}</pre>
                </div>
              </div>

              <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem' }}>
                <button
                  className="action-btn primary text-xs"
                  onClick={() => onNavigate('verify_document', { credentialId: issuedResult.credential.credentialId })}
                >
                  <ShieldCheck size={14} /> Verify Issued Credential
                </button>
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <Award size={36} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
              <p>No credential issued in this session.</p>
              <span className="text-muted text-xs">Fill in the specifications on the left to sign a credential payload.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

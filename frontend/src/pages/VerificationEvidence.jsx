import React, { useState, useEffect } from 'react';
import { CheckSquare, ShieldCheck, Search, Eye, RefreshCw, X } from 'lucide-react';
import api from '../services/api';
import StatusBadge from '../components/StatusBadge';

export default function VerificationEvidence() {
  const [evidenceList, setEvidenceList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedEvidence, setSelectedEvidence] = useState(null);

  async function loadEvidence() {
    setLoading(true);
    try {
      // Historical verifications contain the discrete evidence records
      const res = await api.verifications.list({ limit: 50 });
      if (res && res.success) {
        // Flatten evidence items across verifications
        const items = [];
        (res.data.verifications || []).forEach((v) => {
          if (v.evidenceRecords && Array.isArray(v.evidenceRecords)) {
            items.push(...v.evidenceRecords);
          } else {
            items.push({
              verificationId: v.verificationId,
              evidenceType: 'DIGITAL_SIGNATURE',
              sourceId: v.issuerId || 'INTERNAL',
              credentialIdentifier: v.credentialId,
              documentHash: v.documentHash,
              evidenceStatus: v.cryptographicStatus === 'PASSED' ? 'VERIFIED' : 'PENDING',
              createdAt: v.evaluatedAt || v.createdAt
            });
          }
        });
        setEvidenceList(items);
      }
    } catch (err) {
      console.warn('Failed to load evidence', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadEvidence();
  }, []);

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

      <div className="glass-card table-container">
        {loading ? (
          <div className="empty-state">Loading evidence records...</div>
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
                <tr key={item.evidenceId || idx}>
                  <td className="code-snippet">{item.verificationId}</td>
                  <td><span className="badge-tag">{item.evidenceType}</span></td>
                  <td className="code-snippet text-muted">{item.sourceId}</td>
                  <td>{item.credentialIdentifier || 'N/A'}</td>
                  <td><StatusBadge status={item.evidenceStatus} /></td>
                  <td className="text-muted text-xs">{new Date(item.createdAt).toLocaleString()}</td>
                  <td>
                    <button className="icon-action-btn" onClick={() => setSelectedEvidence(item)} title="Inspect Evidence Artifact">
                      <Eye size={15} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { History, ShieldCheck, Search, Eye, RefreshCw, X } from 'lucide-react';
import api from '../services/api';
import StatusBadge from '../components/StatusBadge';
import TrustEvidenceCard from '../components/TrustEvidenceCard';

export default function VerificationHistory() {
  const [verifications, setVerifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedVerification, setSelectedVerification] = useState(null);
  const [search, setSearch] = useState('');

  async function loadHistory() {
    setLoading(true);
    try {
      const res = await api.verifications.list({ limit: 50 });
      if (res && res.success) {
        setVerifications(res.data.verifications || []);
      }
    } catch (err) {
      console.warn('Failed to load verification history', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadHistory();
  }, []);

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
      <div className="page-header">
        <div>
          <h2>Verification Audit History</h2>
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

      <div className="glass-card table-container">
        {loading ? (
          <div className="empty-state">Loading verification records...</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <History size={36} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
            <p>No matching verification records found.</p>
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
                <tr key={v.verificationId}>
                  <td className="code-snippet">{v.verificationId}</td>
                  <td>
                    {v.credentialId ? (
                      <span className="code-snippet">{v.credentialId}</span>
                    ) : (
                      <span className="code-snippet text-muted">{v.documentHash?.slice(0, 16)}...</span>
                    )}
                  </td>
                  <td><StatusBadge status={v.cryptographicStatus} /></td>
                  <td><StatusBadge status={v.finalResult || v.result} /></td>
                  <td><span className="level-badge">{v.trustLevel || 'LEVEL 0'}</span></td>
                  <td className="text-muted text-xs">{new Date(v.evaluatedAt || v.createdAt).toLocaleString()}</td>
                  <td>
                    <button 
                      className="icon-action-btn"
                      onClick={() => setSelectedVerification(v)}
                      title="Inspect Categorical Evidence"
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

      {/* Modal Inspector */}
      {selectedVerification && (
        <div className="modal-overlay" onClick={() => setSelectedVerification(null)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '900px' }}>
            <div className="modal-header">
              <h3>Verification Evidence Details</h3>
              <button className="close-btn" onClick={() => setSelectedVerification(null)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body">
              <TrustEvidenceCard verification={selectedVerification} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

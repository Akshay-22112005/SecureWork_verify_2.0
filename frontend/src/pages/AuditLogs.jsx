import React, { useState, useEffect } from 'react';
import { History, GitCommit, Search, RefreshCw, Eye, X } from 'lucide-react';
import api from '../services/api';

export default function AuditLogs({ onNavigate }) {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedLog, setSelectedLog] = useState(null);

  async function loadLogs() {
    setLoading(true);
    try {
      const res = await api.auditLogs.list({ limit: 100 });
      if (res && res.success) {
        setLogs(res.data.logs || []);
      }
    } catch (err) {
      console.warn('Failed to load audit logs', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLogs();
  }, []);

  const filtered = logs.filter((l) => {
    const q = search.toLowerCase();
    return (
      (l.action && l.action.toLowerCase().includes(q)) ||
      (l.targetResource && l.targetResource.toLowerCase().includes(q)) ||
      (l.actorId && l.actorId.toLowerCase().includes(q)) ||
      (l.currentHash && l.currentHash.toLowerCase().includes(q))
    );
  });

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h2>Cryptographic Append-Only Audit Logs</h2>
          <p className="page-subtitle">
            Hash-chained sequence records with tamper-evident linkage to Genesis digest.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="action-btn primary text-xs" onClick={() => onNavigate('chain_validation')}>
            <GitCommit size={14} /> Validate Chain Integrity
          </button>
          <button className="action-btn secondary text-xs" onClick={loadLogs} disabled={loading}>
            <RefreshCw size={14} className={loading ? 'pulse-dot' : ''} /> Refresh
          </button>
        </div>
      </div>

      {/* Auditor Workflow Journey Banner */}
      <div className="glass-card" style={{ padding: '0.75rem 1.25rem', marginBottom: '1.25rem', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(0, 240, 255, 0.2)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.8rem' }}>
          <span className="text-muted" style={{ fontWeight: 700 }}>AUDITOR WORKFLOW:</span>
          <span style={{ cursor: 'pointer', color: 'var(--accent-cyan)' }} onClick={() => onNavigate('dashboard')}>Auditor Dashboard</span>
          <span className="text-muted">→</span>
          <strong style={{ color: 'var(--accent-cyan)', textDecoration: 'underline' }}>Audit Logs (Browsing Records)</strong>
          <span className="text-muted">→</span>
          <span className="text-muted">Select Event</span>
          <span className="text-muted">→</span>
          <span className="text-muted">Event Details</span>
          <span className="text-muted">→</span>
          <span style={{ cursor: 'pointer', color: 'var(--accent-purple)' }} onClick={() => onNavigate('verification_evidence')}>Evidence</span>
          <span className="text-muted">→</span>
          <span style={{ cursor: 'pointer', color: '#10b981' }} onClick={() => onNavigate('chain_validation')}>Validate Hash Chain</span>
        </div>
      </div>

      <div className="glass-card" style={{ marginBottom: '1.5rem' }}>
        <div className="search-bar-row">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Search action (e.g. CREDENTIAL_ISSUED, KEY_ROTATED), actor, or hash..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="search-input"
          />
        </div>
      </div>

      <div className="glass-card table-container">
        {loading ? (
          <div className="empty-state">Loading audit chain...</div>
        ) : filtered.length === 0 ? (
          <div className="empty-state">
            <History size={36} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
            <p>No audit log records found.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Seq #</th>
                <th>Action</th>
                <th>Actor (Role)</th>
                <th>Target Resource</th>
                <th>Current SHA-256 Hash</th>
                <th>Timestamp</th>
                <th>Inspect</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((log) => (
                <tr 
                  key={log.sequenceNumber || log.eventId}
                  onClick={() => setSelectedLog(log)}
                  style={{ cursor: 'pointer' }}
                  title="Click to view complete cryptographic event details"
                >
                  <td><span className="badge-tag">#{log.sequenceNumber}</span></td>
                  <td><strong>{log.action}</strong></td>
                  <td>
                    <span className="code-snippet text-xs">{log.actorId}</span>
                    <span className="text-muted text-xs" style={{ marginLeft: '0.3rem' }}>({log.actorRole})</span>
                  </td>
                  <td><span className="code-snippet text-xs">{log.targetResource}</span></td>
                  <td><span className="code-snippet hash-text">{log.currentHash?.slice(0, 18)}...</span></td>
                  <td className="text-muted text-xs">{new Date(log.timestamp || log.createdAt).toLocaleString()}</td>
                  <td>
                    <button 
                      className="icon-action-btn" 
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedLog(log);
                      }} 
                      title="Inspect Record"
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

      {/* Detail Modal */}
      {selectedLog && (
        <div className="modal-overlay" onClick={() => setSelectedLog(null)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '720px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <GitCommit size={18} className="text-cyan" />
                <div>
                  <h3 style={{ margin: 0 }}>Audit Record #{selectedLog.sequenceNumber} — {selectedLog.action}</h3>
                  <div className="text-muted text-xs" style={{ marginTop: '0.2rem' }}>
                    Auditor Pipeline: Select Event → <strong>Event Details (Active)</strong> → Evidence → Validate Hash Chain
                  </div>
                </div>
              </div>
              <button className="close-btn" onClick={() => setSelectedLog(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <div className="credential-detail-grid">
                <div className="detail-row">
                  <span className="detail-label">Event ID</span>
                  <span className="code-snippet">{selectedLog.eventId}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Sequence Number</span>
                  <strong>#{selectedLog.sequenceNumber}</strong>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Actor</span>
                  <span>{selectedLog.actorId} ({selectedLog.actorRole})</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Target Resource</span>
                  <span className="code-snippet">{selectedLog.targetResource}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Previous Hash</span>
                  <span className="code-snippet hash-text">{selectedLog.previousHash}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-label">Current Hash</span>
                  <span className="code-snippet hash-text">{selectedLog.currentHash}</span>
                </div>
              </div>

              <div style={{ marginTop: '1.5rem' }}>
                <h4>Event Metadata Payload</h4>
                <div className="json-code-box">
                  <pre>{JSON.stringify(selectedLog.metadata, null, 2)}</pre>
                </div>
              </div>

              <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', paddingTop: '1rem', borderTop: '1px solid var(--border-subtle)' }}>
                <button 
                  className="action-btn secondary text-xs"
                  onClick={() => setSelectedLog(null)}
                >
                  Close Details
                </button>
                <div style={{ display: 'flex', gap: '0.6rem' }}>
                  <button 
                    className="action-btn primary text-xs"
                    onClick={() => {
                      const vId = selectedLog.metadata?.verificationId || (typeof selectedLog.targetResource === 'string' && selectedLog.targetResource.startsWith('vrf_') ? selectedLog.targetResource : undefined);
                      const cId = selectedLog.metadata?.credentialId || (typeof selectedLog.targetResource === 'string' && selectedLog.targetResource.startsWith('cred_') ? selectedLog.targetResource : undefined);
                      setSelectedLog(null);
                      onNavigate('verification_evidence', { verificationId: vId, credentialId: cId });
                    }}
                    title="Transition to discrete evidence inspection for this event"
                  >
                    Evidence Store →
                  </button>
                  <button 
                    className="action-btn secondary text-xs"
                    style={{ borderColor: 'rgba(16, 185, 129, 0.4)', color: '#10b981' }}
                    onClick={() => {
                      setSelectedLog(null);
                      onNavigate('chain_validation');
                    }}
                    title="Transition directly to bitwise audit chain validation"
                  >
                    <GitCommit size={13} /> Validate Hash Chain →
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

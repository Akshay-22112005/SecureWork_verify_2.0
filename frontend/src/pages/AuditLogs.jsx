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
                <tr key={log.sequenceNumber || log.eventId}>
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
                    <button className="icon-action-btn" onClick={() => setSelectedLog(log)} title="Inspect Record">
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
          <div className="modal-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <GitCommit size={18} className="text-cyan" />
                <h3>Audit Record #{selectedLog.sequenceNumber} — {selectedLog.action}</h3>
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

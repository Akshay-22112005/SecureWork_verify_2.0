import React, { useState, useEffect } from 'react';
import { GitCommit, ShieldCheck, AlertOctagon, CheckCircle2, RefreshCw, Anchor, History, AlertTriangle } from 'lucide-react';
import api from '../services/api';
import StatusBadge from '../components/StatusBadge';

export default function AuditChainValidation() {
  const [validationResult, setValidationResult] = useState(null);
  const [checkpoints, setCheckpoints] = useState([]);
  const [validating, setValidating] = useState(false);
  const [checkpointing, setCheckpointing] = useState(false);
  const [checkpointMsg, setCheckpointMsg] = useState('');
  const [error, setError] = useState('');

  async function runValidation() {
    setValidating(true);
    setError('');
    try {
      const res = await api.auditLogs.validateChain();
      if (res && res.success) {
        setValidationResult(res.data.validation);
      } else {
        setError(res?.error?.message || 'Chain validation returned failure');
      }
    } catch (err) {
      setError(err.message || 'Audit validation error');
    } finally {
      setValidating(false);
    }
  }

  async function loadCheckpoints() {
    try {
      const res = await api.auditLogs.listCheckpoints();
      if (res && res.success) {
        setCheckpoints(res.data.checkpoints || []);
      }
    } catch {}
  }

  useEffect(() => {
    runValidation();
    loadCheckpoints();
  }, []);

  async function handleCreateCheckpoint() {
    setCheckpointing(true);
    setCheckpointMsg('');
    try {
      const res = await api.auditLogs.createCheckpoint({ externalAnchorType: 'INTERNAL_LOCAL' });
      if (res && res.success) {
        setCheckpointMsg(`Audit checkpoint ${res.data.checkpoint.checkpointId} anchored successfully.`);
        loadCheckpoints();
        runValidation();
      }
    } catch (err) {
      setError(err.message || 'Failed to anchor checkpoint');
    } finally {
      setCheckpointing(false);
    }
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h2>Cryptographic Audit Chain Validation Engine</h2>
          <p className="page-subtitle">
            Bitwise verification of SHA-256 hash linkages from Genesis digest through chain head.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button className="action-btn primary text-xs" onClick={handleCreateCheckpoint} disabled={checkpointing}>
            <Anchor size={14} /> Anchor Checkpoint
          </button>
          <button className="action-btn secondary text-xs" onClick={runValidation} disabled={validating}>
            <RefreshCw size={14} className={validating ? 'pulse-dot' : ''} /> Run Validation
          </button>
        </div>
      </div>

      {checkpointMsg && (
        <div className="alert-banner success" style={{ marginBottom: '1rem' }}>
          <CheckCircle2 size={16} />
          <span>{checkpointMsg}</span>
        </div>
      )}

      {error && (
        <div className="alert-banner danger" style={{ marginBottom: '1rem' }}>
          <AlertOctagon size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Validation Status Banner */}
      {validationResult && (
        <div className="glass-card" style={{ marginBottom: '2rem' }}>
          <div className="section-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <GitCommit size={22} className={validationResult.valid ? 'text-success' : 'text-danger'} />
              <h3>Chain Cryptographic Integrity</h3>
            </div>
            <StatusBadge 
              status={validationResult.valid ? 'VERIFIED' : 'TAMPERED'} 
              label={validationResult.valid ? '100% UNBROKEN CHAIN' : 'CHAIN TAMPERED'} 
            />
          </div>

          <div className="metrics-grid" style={{ margin: '1rem 0' }}>
            <div className="metric-card glass-card">
              <div className="metric-icon bg-cyan-subtle">
                <ShieldCheck size={20} className="text-cyan" />
              </div>
              <div className="metric-value">{validationResult.totalRecords || 0}</div>
              <div className="metric-label">Sequenced Log Records Verified</div>
            </div>

            <div className="metric-card glass-card">
              <div className="metric-icon bg-green-subtle">
                <CheckCircle2 size={20} className="text-success" />
              </div>
              <div className="metric-value">{validationResult.errors?.length || 0}</div>
              <div className="metric-label">Cryptographic Integrity Errors</div>
            </div>

            <div className="metric-card glass-card">
              <div className="metric-icon bg-purple-subtle">
                <Anchor size={20} className="text-purple" />
              </div>
              <div className="metric-value">{checkpoints.length}</div>
              <div className="metric-label">Periodic Anchored Checkpoints</div>
            </div>
          </div>

          <div className="detail-row">
            <span className="detail-label">Current Chain Head Hash</span>
            <span className="code-snippet hash-text">{validationResult.chainHeadHash}</span>
          </div>

          {validationResult.errors && validationResult.errors.length > 0 && (
            <div style={{ marginTop: '1.5rem' }}>
              <h4>Integrity Failures Detected</h4>
              <ul className="findings-list">
                {validationResult.errors.map((e, idx) => (
                  <li key={idx} className="finding-item text-danger">
                    <AlertOctagon size={14} />
                    <span>{e.message || JSON.stringify(e)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Checkpoints History */}
      <div className="section-header">
        <h3>Periodic Audit Checkpoint Anchors</h3>
      </div>
      <div className="glass-card table-container">
        {checkpoints.length === 0 ? (
          <div className="empty-state">
            <Anchor size={36} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
            <p>No audit checkpoints created yet.</p>
            <button className="action-btn primary text-xs" onClick={handleCreateCheckpoint} style={{ marginTop: '0.5rem' }}>
              Create First Audit Checkpoint Anchor
            </button>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Checkpoint ID</th>
                <th>Sequence Range</th>
                <th>Chain Head Hash</th>
                <th>Anchor Type</th>
                <th>Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {checkpoints.map((cp) => (
                <tr key={cp.checkpointId}>
                  <td className="code-snippet">{cp.checkpointId}</td>
                  <td><strong>Seq #{cp.sequenceStart} — #{cp.sequenceEnd}</strong></td>
                  <td><span className="code-snippet hash-text">{cp.chainHeadHash?.slice(0, 20)}...</span></td>
                  <td><span className="badge-tag">{cp.externalAnchorType || 'INTERNAL_LOCAL'}</span></td>
                  <td className="text-muted text-xs">{new Date(cp.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

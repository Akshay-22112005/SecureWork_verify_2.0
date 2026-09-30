import React, { useState, useEffect } from 'react';
import { Key, RefreshCw, AlertOctagon, ShieldCheck, CheckCircle2, AlertTriangle, X, Award } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';

export default function KeyStatus({ onNavigate }) {
  const { user } = useAuth();
  const [keys, setKeys] = useState([]);
  const [activeIssuer, setActiveIssuer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState('');
  const [actionError, setActionError] = useState('');

  // Key compromise modal
  const [compromiseTarget, setCompromiseTarget] = useState(null);
  const [compromiseReason, setCompromiseReason] = useState('');
  const [submittingCompromise, setSubmittingCompromise] = useState(false);

  async function loadKeys() {
    setLoading(true);
    setActionMessage('');
    setActionError('');
    try {
      // Find current user's issuer
      const issuerRes = await api.issuers.list();
      let issuer = null;
      if (issuerRes && issuerRes.success && issuerRes.data.issuers?.length > 0) {
        issuer = issuerRes.data.issuers.find((i) => i.userId === user?.userId) || issuerRes.data.issuers[0];
        setActiveIssuer(issuer);
      }

      if (issuer) {
        const keyRes = await api.issuerKeys.list({ issuerId: issuer.issuerId });
        if (keyRes && keyRes.success) {
          setKeys(keyRes.data.keys || []);
        }
      }
    } catch (err) {
      console.warn('Failed to load issuer keys', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadKeys();
  }, [user]);

  async function handleRotateKey() {
    if (!activeIssuer) return;
    if (!confirm('Rotate active Ed25519 key? All future credentials will be signed with the new key while existing credentials remain valid.')) {
      return;
    }
    setActionMessage('');
    setActionError('');
    try {
      const res = await api.issuerKeys.rotate(activeIssuer.issuerId);
      if (res && res.success) {
        setActionMessage('Cryptographic key rotated successfully. New Ed25519 key generated.');
        loadKeys();
      }
    } catch (err) {
      setActionError(err.message || 'Key rotation failed');
    }
  }

  async function handleCompromiseSubmit(e) {
    e.preventDefault();
    if (!compromiseTarget) return;
    setSubmittingCompromise(true);
    try {
      const res = await api.issuerKeys.compromise(compromiseTarget.keyId, compromiseReason || 'Security alert');
      if (res && res.success) {
        setActionMessage(`Key ${compromiseTarget.keyId} marked as COMPROMISED. Security alert dispatched.`);
        setCompromiseTarget(null);
        setCompromiseReason('');
        loadKeys();
      }
    } catch (err) {
      alert(err.message || 'Failed to report compromised key');
    } finally {
      setSubmittingCompromise(false);
    }
  }

  const activeKey = keys.find((k) => k.status === 'ACTIVE');
  const retiredKeys = keys.filter((k) => k.status !== 'ACTIVE');

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h2>Cryptographic Key Lifecycle & Status</h2>
          <p className="page-subtitle">
            Ed25519 public-key management, zero-downtime key rotation, and compromise mitigation.
          </p>
        </div>
        <button className="action-btn secondary text-xs" onClick={loadKeys} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'pulse-dot' : ''} /> Refresh
        </button>
      </div>

      {actionMessage && (
        <div className="alert-banner success" style={{ marginBottom: '1rem' }}>
          <CheckCircle2 size={16} />
          <span>{actionMessage}</span>
        </div>
      )}

      {actionError && (
        <div className="alert-banner danger" style={{ marginBottom: '1rem' }}>
          <AlertTriangle size={16} />
          <span>{actionError}</span>
        </div>
      )}

      {/* Active Key Tile */}
      <div className="glass-card" style={{ marginBottom: '2rem' }}>
        <div className="section-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Key size={20} className="text-cyan" />
            <h3>Active Signing Key</h3>
          </div>
          {activeKey && <StatusBadge status={activeKey.status} />}
        </div>

        {activeKey ? (
          <div>
            <div className="detail-row">
              <span className="detail-label">Key ID</span>
              <span className="code-snippet">{activeKey.keyId}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Algorithm</span>
              <span><strong>{activeKey.algorithm || 'ED25519'}</strong> (High-performance elliptic curve)</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Public Key (PEM)</span>
              <div className="json-code-box" style={{ maxHeight: '120px' }}>
                <pre>{activeKey.publicKeyPem || activeKey.publicKey}</pre>
              </div>
            </div>
            <div className="detail-row">
              <span className="detail-label">Activated At</span>
              <span className="text-muted text-xs">{new Date(activeKey.createdAt).toLocaleString()}</span>
            </div>

            <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              {onNavigate && (
                <button className="action-btn primary text-xs" onClick={() => onNavigate('issue_credential')}>
                  <Award size={14} /> Proceed to Issue Credential →
                </button>
              )}
              <button className="action-btn secondary text-xs" onClick={handleRotateKey}>
                <RefreshCw size={14} /> Rotate Signing Key
              </button>
              <button 
                className="action-btn danger text-xs"
                onClick={() => setCompromiseTarget(activeKey)}
              >
                <AlertOctagon size={14} /> Flag Key as Compromised
              </button>
            </div>
          </div>
        ) : (
          <div className="empty-state">
            <Key size={36} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
            <p>No active signing key registered for this issuer.</p>
            {activeIssuer && (
              <button className="action-btn primary text-xs" onClick={handleRotateKey} style={{ marginTop: '0.5rem' }}>
                Generate First Ed25519 Key
              </button>
            )}
          </div>
        )}
      </div>

      {/* Historical Keys */}
      <div className="section-header">
        <h3>Historical & Retired Keys</h3>
      </div>
      <div className="glass-card table-container">
        {retiredKeys.length === 0 ? (
          <div className="empty-state">
            <p className="text-muted text-xs">No retired or compromised keys on record.</p>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Key ID</th>
                <th>Algorithm</th>
                <th>Status</th>
                <th>Created</th>
                <th>Retired / Changed</th>
                <th>Status Reason</th>
              </tr>
            </thead>
            <tbody>
              {retiredKeys.map((k) => (
                <tr key={k.keyId}>
                  <td className="code-snippet">{k.keyId}</td>
                  <td>{k.algorithm}</td>
                  <td><StatusBadge status={k.status} /></td>
                  <td className="text-muted text-xs">{new Date(k.createdAt).toLocaleDateString()}</td>
                  <td className="text-muted text-xs">{k.retiredAt ? new Date(k.retiredAt).toLocaleDateString() : 'N/A'}</td>
                  <td className="text-muted text-xs">{k.statusReason || 'Rotated to new key'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Compromise Modal */}
      {compromiseTarget && (
        <div className="modal-overlay" onClick={() => setCompromiseTarget(null)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertOctagon size={20} className="text-danger" />
                <h3>Flag Cryptographic Key as Compromised</h3>
              </div>
              <button className="close-btn" onClick={() => setCompromiseTarget(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <p className="text-secondary text-sm">
                Flagging key <strong className="text-primary">{compromiseTarget.keyId}</strong> as <strong>COMPROMISED</strong> immediately revokes its signing authority, dispatches a critical security notification to all administrators, and marks affected credentials for scrutiny.
              </p>

              <form onSubmit={handleCompromiseSubmit} style={{ marginTop: '1rem' }}>
                <div className="form-group">
                  <label>Compromise Incident Detail</label>
                  <textarea
                    rows={3}
                    placeholder="e.g. HSM physical theft, private key leaked during backup, or suspicious unauthorized signatures"
                    value={compromiseReason}
                    onChange={(e) => setCompromiseReason(e.target.value)}
                    required
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                  <button type="button" className="action-btn secondary text-xs" onClick={() => setCompromiseTarget(null)}>
                    Cancel
                  </button>
                  <button type="submit" className="action-btn danger text-xs" disabled={submittingCompromise}>
                    {submittingCompromise ? 'Flagging...' : 'Confirm Key Compromise'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
      {/* Workflow Navigation Footer */}
      {onNavigate && (
        <div className="glass-card" style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <span className="text-muted text-xs">Issuer Workflow: Issuer Status → Key Status → Issue Credential</span>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button 
              className="action-btn secondary text-xs" 
              onClick={() => onNavigate('issuer_status')}
            >
              ← Back to Issuer Status
            </button>
            <button 
              className="action-btn primary text-xs"
              onClick={() => onNavigate('issue_credential')}
            >
              Proceed to Issue Credential →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

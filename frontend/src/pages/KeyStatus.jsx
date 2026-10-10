import React, { useState, useEffect } from "react";
import {
  Key, RefreshCw, AlertOctagon, ShieldCheck, CheckCircle2,
  AlertTriangle, X, Award, Clock, RotateCcw, History
} from "lucide-react";
import api from "../services/api";
import { useAuth } from "../context/AuthContext";
import StatusBadge from "../components/StatusBadge";

export default function KeyStatus({ onNavigate }) {
  const { user } = useAuth();
  const [keys, setKeys] = useState([]);
  const [activeIssuer, setActiveIssuer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [rotating, setRotating] = useState(false);
  const [actionMessage, setActionMessage] = useState("");
  const [actionError, setActionError] = useState("");
  const [compromiseTarget, setCompromiseTarget] = useState(null);
  const [compromiseReason, setCompromiseReason] = useState("");
  const [submittingCompromise, setSubmittingCompromise] = useState(false);

  async function loadKeys() {
    setLoading(true); setActionMessage(""); setActionError("");
    try {
      const issuerRes = await api.issuers.list();
      let issuer = null;
      if (issuerRes?.success && issuerRes.data.issuers?.length > 0) {
        issuer = issuerRes.data.issuers.find((i) => i.userId === user?.userId) || issuerRes.data.issuers[0];
        setActiveIssuer(issuer);
      }
      if (issuer) {
        const keyRes = await api.issuerKeys.list({ issuerId: issuer.issuerId });
        if (keyRes?.success) setKeys(keyRes.data.keys || []);
      }
    } catch (err) { console.warn("Failed to load issuer keys", err); }
    finally { setLoading(false); }
  }

  useEffect(() => { loadKeys(); }, [user]);

  async function handleRotateKey() {
    if (!activeIssuer) return;
    if (!confirm("Rotate active Ed25519 key? All future credentials will be signed with the new key while existing credentials remain valid.")) return;
    setActionMessage(""); setActionError(""); setRotating(true);
    try {
      const res = await api.issuerKeys.rotate(activeIssuer.issuerId);
      if (res?.success) { setActionMessage("Cryptographic key rotated successfully. New Ed25519 key generated."); loadKeys(); }
    } catch (err) { setActionError(err.message || "Key rotation failed"); }
    finally { setRotating(false); }
  }

  async function handleCompromiseSubmit(e) {
    e.preventDefault(); if (!compromiseTarget) return;
    setSubmittingCompromise(true);
    try {
      const res = await api.issuerKeys.compromise(compromiseTarget.keyId, compromiseReason || "Security alert");
      if (res?.success) { setActionMessage(`Key ${compromiseTarget.keyId} marked as COMPROMISED.`); setCompromiseTarget(null); setCompromiseReason(""); loadKeys(); }
    } catch (err) { alert(err.message || "Failed to report compromised key"); }
    finally { setSubmittingCompromise(false); }
  }

  // Time left calculation with color-coding
  function getKeyTimeLeft(key) {
    if (!key) return null;
    if (['RETIRED', 'REVOKED', 'COMPROMISED'].includes(key.status)) {
      return { 
        text: key.status, 
        color: key.status === 'COMPROMISED' ? 'var(--color-danger, #ef4444)' : 'var(--text-muted)', 
        isState: true 
      };
    }

    const expiryDate = key.expiresAt || (key.activatedAt || key.createdAt ? new Date(new Date(key.activatedAt || key.createdAt).getTime() + 365 * 24 * 60 * 60 * 1000) : null);
    if (!expiryDate) {
      return { text: 'No expiry', color: 'var(--text-muted)', isState: false };
    }

    const now = new Date();
    const diffMs = new Date(expiryDate) - now;
    if (diffMs <= 0) {
      return { text: 'Expired', color: 'var(--color-danger, #ef4444)', isState: true };
    }

    const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    const hours = Math.floor((diffMs % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    const minutes = Math.floor((diffMs % (60 * 60 * 1000)) / (60 * 1000));

    let text = '';
    if (days > 0) {
      text = `${days}d ${hours}h left`;
    } else if (hours > 0) {
      text = `${hours}h ${minutes}m left`;
    } else {
      text = `${minutes}m left`;
    }

    let color = '#10b981'; // green > 30 days
    if (days <= 7) {
      color = 'var(--color-danger, #ef4444)'; // red <= 7 days
    } else if (days <= 30) {
      color = 'var(--color-warning, #f59e0b)'; // amber <= 30 days
    }

    return { 
      text, 
      color, 
      days, 
      isState: false, 
      expiryDate: new Date(expiryDate).toLocaleDateString() 
    };
  }

  const activeKey = keys.find((k) => k.status === "ACTIVE");
  const activeKeyTimeLeft = activeKey ? getKeyTimeLeft(activeKey) : null;
  const retiredKeys = keys.filter((k) => k.status !== "ACTIVE").sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  const allKeysSorted = [...keys].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  function statusColor(s) {
    if (s === "ACTIVE") return "#10b981";
    if (s === "COMPROMISED") return "var(--color-danger)";
    return "var(--text-muted)";
  }

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h2>Cryptographic Key Lifecycle & Status</h2>
          <p className="page-subtitle">Ed25519 public-key management, zero-downtime key rotation, and compromise mitigation.</p>
        </div>
        <div style={{ display: "flex", gap: "0.6rem" }}>
          <button className="action-btn secondary text-xs" onClick={loadKeys} disabled={loading}><RefreshCw size={14} className={loading ? "pulse-dot" : ""} /> Refresh</button>
          {activeIssuer && (
            <button className="action-btn primary text-xs" onClick={handleRotateKey} disabled={rotating}>
              <RotateCcw size={14} className={rotating ? "pulse-dot" : ""} />
              {rotating ? "Rotating..." : "Rotate Key"}
            </button>
          )}
        </div>
      </div>

      {actionMessage && <div className="alert-banner success" style={{ marginBottom: "1rem" }}><CheckCircle2 size={16} /><span>{actionMessage}</span></div>}
      {actionError && <div className="alert-banner danger" style={{ marginBottom: "1rem" }}><AlertTriangle size={16} /><span>{actionError}</span></div>}

      {/* Active Key */}
      <div className="glass-card" style={{ marginBottom: "2rem" }}>
        <div className="section-header">
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <Key size={20} className="text-cyan" /><h3>Active Signing Key</h3>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            {activeKeyTimeLeft && (
              <span 
                className="badge-tag"
                style={{
                  color: activeKeyTimeLeft.color,
                  borderColor: activeKeyTimeLeft.color,
                  background: 'rgba(0, 0, 0, 0.2)',
                  fontWeight: 600,
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                <Clock size={12} />
                {activeKeyTimeLeft.text}
              </span>
            )}
            {activeKey && <StatusBadge status={activeKey.status} />}
          </div>
        </div>
        {activeKey ? (
          <div>
            <div className="detail-row"><span className="detail-label">Key ID</span><span className="code-snippet">{activeKey.keyId}</span></div>
            <div className="detail-row"><span className="detail-label">Algorithm</span><span><strong>{activeKey.algorithm || "ED25519"}</strong> (High-performance elliptic curve)</span></div>
            <div className="detail-row">
              <span className="detail-label">Public Key (PEM)</span>
              <div className="json-code-box" style={{ maxHeight: "120px" }}><pre>{activeKey.publicKeyPem || activeKey.publicKey}</pre></div>
            </div>
            <div className="detail-row"><span className="detail-label">Activated At</span><span className="text-muted text-xs">{new Date(activeKey.createdAt).toLocaleString()}</span></div>
            <div className="detail-row">
              <span className="detail-label">Key Expiration & Validity</span>
              <span style={{ fontSize: '0.85rem' }}>
                <span className="text-muted">Expires: {activeKeyTimeLeft?.expiryDate || 'N/A'}</span>
                <span style={{ margin: '0 0.5rem' }}>·</span>
                <strong style={{ color: activeKeyTimeLeft?.color }}>{activeKeyTimeLeft?.text}</strong>
              </span>
            </div>
            <div style={{ marginTop: "1.5rem", display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              {onNavigate && <button className="action-btn primary text-xs" onClick={() => onNavigate("issue_credential")}><Award size={14} /> Issue Credential</button>}
              <button className="action-btn secondary text-xs" onClick={handleRotateKey} disabled={rotating}><RotateCcw size={14} /> Rotate Signing Key</button>
              <button className="action-btn danger text-xs" onClick={() => setCompromiseTarget(activeKey)}><AlertOctagon size={14} /> Flag Compromised</button>
            </div>
          </div>
        ) : (
          <div className="empty-state">
            <Key size={36} style={{ opacity: 0.3, marginBottom: "0.75rem" }} />
            <p>No active signing key registered for this issuer.</p>
            {activeIssuer && <button className="action-btn primary text-xs" onClick={handleRotateKey} style={{ marginTop: "0.5rem" }}>Generate First Ed25519 Key</button>}
          </div>
        )}
      </div>

      {/* Visual Key Timeline */}
      {allKeysSorted.length > 0 && (
        <div style={{ marginBottom: "2rem" }}>
          <div className="section-header">
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}><History size={18} className="text-purple" /><h3>Key Rotation Timeline</h3></div>
            <span className="text-muted text-xs">{allKeysSorted.length} key(s) total</span>
          </div>
          <div className="glass-card" style={{ padding: "1.5rem" }}>
            <div style={{ position: "relative", paddingLeft: "2rem" }}>
              {/* vertical line */}
              <div style={{ position: "absolute", left: "0.6rem", top: 0, bottom: 0, width: "2px", background: "rgba(255,255,255,0.08)" }} />
              {allKeysSorted.map((k, idx) => (
                <div key={k.keyId} style={{ position: "relative", marginBottom: idx < allKeysSorted.length - 1 ? "1.5rem" : 0 }}>
                  {/* dot */}
                  <div style={{
                    position: "absolute", left: "-2rem", top: "0.3rem",
                    width: "14px", height: "14px", borderRadius: "50%",
                    background: statusColor(k.status),
                    border: "2px solid var(--bg-card)",
                    boxShadow: k.status === "ACTIVE" ? `0 0 8px ${statusColor(k.status)}` : "none",
                    zIndex: 1
                  }} />
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap" }}>
                    <div style={{ flex: 1, minWidth: "260px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.35rem" }}>
                        <span className="code-snippet" style={{ fontSize: "0.78rem" }}>{k.keyId}</span>
                        <StatusBadge status={k.status} />
                      </div>
                      <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                        <span><strong>{k.algorithm || "ED25519"}</strong></span>
                        <span style={{ margin: "0 0.5rem" }}>·</span>
                        <Clock size={11} style={{ display: "inline", verticalAlign: "middle", marginRight: "3px" }} />
                        Created {new Date(k.createdAt).toLocaleString()}
                      </div>
                      {k.status === "ACTIVE" ? (
                        <div style={{ fontSize: "0.78rem", marginTop: "0.25rem" }}>
                          <span className="text-muted">Expires: {getKeyTimeLeft(k)?.expiryDate || 'N/A'}</span>
                          <span style={{ margin: "0 0.4rem" }}>·</span>
                          <strong style={{ color: getKeyTimeLeft(k)?.color }}>{getKeyTimeLeft(k)?.text}</strong>
                        </div>
                      ) : (
                        <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "0.15rem" }}>
                          Status: <strong style={{ color: statusColor(k.status) }}>{k.status}</strong>
                        </div>
                      )}
                      {k.retiredAt && (
                        <div style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "0.15rem" }}>
                          Retired: {new Date(k.retiredAt).toLocaleString()}
                          {k.statusReason && <> · Reason: <em>{k.statusReason}</em></>}
                        </div>
                      )}
                      {k.status === "COMPROMISED" && k.statusReason && (
                        <div style={{ fontSize: "0.78rem", color: "var(--color-danger)", marginTop: "0.15rem" }}>
                          Compromise: <em>{k.statusReason}</em>
                        </div>
                      )}
                    </div>
                    {k.status !== "ACTIVE" && (
                      <div className="json-code-box" style={{ maxWidth: "320px", maxHeight: "80px", fontSize: "0.7rem" }}>
                        <pre>{(k.publicKeyPem || k.publicKey || "").slice(0, 120)}...</pre>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Historical Keys Table */}
      <div className="section-header"><h3>Historical & Retired Keys</h3></div>
      <div className="glass-card table-container">
        {retiredKeys.length === 0 ? (
          <div className="empty-state"><p className="text-muted text-xs">No retired or compromised keys on record.</p></div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Key ID</th><th>Algorithm</th><th>Status</th><th>Time Remaining / State</th>
                <th>Created</th><th>Retired / Changed</th><th>Reason</th><th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {retiredKeys.map((k) => {
                const tl = getKeyTimeLeft(k);
                return (
                  <tr key={k.keyId}>
                    <td className="code-snippet">{k.keyId}</td>
                    <td>{k.algorithm}</td>
                    <td><StatusBadge status={k.status} /></td>
                    <td>
                      <span style={{ color: tl?.color, fontWeight: 600, fontSize: '0.78rem' }}>
                        {tl?.text}
                      </span>
                    </td>
                    <td className="text-muted text-xs">{new Date(k.createdAt).toLocaleDateString()}</td>
                    <td className="text-muted text-xs">{k.retiredAt ? new Date(k.retiredAt).toLocaleDateString() : "N/A"}</td>
                    <td className="text-muted text-xs">{k.statusReason || "Rotated to new key"}</td>
                    <td>
                      {k.status === "RETIRED" && (
                        <button className="action-btn danger text-xs" style={{ padding: "3px 8px", fontSize: "0.7rem" }} onClick={() => setCompromiseTarget(k)}>
                          <AlertOctagon size={11} /> Flag
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Compromise Modal */}
      {compromiseTarget && (
        <div className="modal-overlay" onClick={() => setCompromiseTarget(null)}>
          <div className="modal-container" onClick={(e) => e.stopPropagation()} style={{ maxWidth: "500px" }}>
            <div className="modal-header">
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}><AlertOctagon size={20} className="text-danger" /><h3>Flag Cryptographic Key as Compromised</h3></div>
              <button className="close-btn" onClick={() => setCompromiseTarget(null)}><X size={18} /></button>
            </div>
            <div className="modal-body">
              <p className="text-secondary text-sm">Flagging key <strong className="text-primary">{compromiseTarget.keyId}</strong> as <strong>COMPROMISED</strong> immediately revokes its signing authority and dispatches a critical security notification.</p>
              <form onSubmit={handleCompromiseSubmit} style={{ marginTop: "1rem" }}>
                <div className="form-group">
                  <label>Compromise Incident Detail</label>
                  <textarea rows={3} placeholder="e.g. HSM physical theft, private key leaked during backup..." value={compromiseReason} onChange={(e) => setCompromiseReason(e.target.value)} required />
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem", marginTop: "1rem" }}>
                  <button type="button" className="action-btn secondary text-xs" onClick={() => setCompromiseTarget(null)}>Cancel</button>
                  <button type="submit" className="action-btn danger text-xs" disabled={submittingCompromise}>{submittingCompromise ? "Flagging..." : "Confirm Key Compromise"}</button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {onNavigate && (
        <div className="glass-card" style={{ marginTop: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
          <span className="text-muted text-xs">Issuer Workflow: Issuer Status → Key Status → Issue Credential</span>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <button className="action-btn secondary text-xs" onClick={() => onNavigate("issuer_status")}>Back to Issuer Status</button>
            <button className="action-btn primary text-xs" onClick={() => onNavigate("issue_credential")}>Proceed to Issue Credential</button>
          </div>
        </div>
      )}
    </div>
  );
}

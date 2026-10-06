import React, { useState, useEffect, useRef } from "react";
import { animate, stagger } from "animejs";
import {
  GitCommit, ShieldCheck, AlertOctagon, CheckCircle2,
  RefreshCw, Anchor, History, AlertTriangle, Link, ZoomIn, ZoomOut
} from "lucide-react";
import api from "../services/api";
import StatusBadge from "../components/StatusBadge";
import { useReducedMotion } from "../hooks/useReducedMotion";

/* ─── mini SVG block explorer ─────────────────────────────── */
function BlockCard({ entry, index, isBroken, isFirst }) {
  const statusColor = isBroken ? "var(--color-danger)" : "#10b981";
  return (
    <div 
      className="audit-block-card-wrapper"
      style={{
        display: "flex", alignItems: "stretch", gap: 0,
        opacity: 0, transform: "translateY(16px)"
      }}
    >
      {/* connector arrow (not first) */}
      {!isFirst && (
        <div className="audit-block-connector" style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: "36px", flexShrink: 0 }}>
          <div style={{ width: "100%", height: "2px", background: isBroken ? "var(--color-danger)" : "rgba(16,185,129,0.4)" }} />
          <div style={{ fontSize: "0.6rem", color: isBroken ? "var(--color-danger)" : "rgba(16,185,129,0.6)", marginTop: "-2px" }}>&#9654;</div>
        </div>
      )}
      {/* block */}
      <div className="glass-card" style={{
        border: `1.5px solid ${isBroken ? "rgba(239,68,68,0.5)" : "rgba(16,185,129,0.25)"}`,
        borderRadius: "var(--radius-md)", padding: "0.85rem", minWidth: "210px", maxWidth: "230px",
        background: isBroken ? "var(--red-bg)" : "var(--emerald-bg)",
        position: "relative", flexShrink: 0
      }}>
        {/* index badge */}
        <div style={{ position: "absolute", top: "-10px", left: "10px", background: "var(--bg-card)", padding: "1px 8px", borderRadius: "99px", fontSize: "0.65rem", fontWeight: 700, color: statusColor, border: `1px solid ${statusColor}` }}>
          #{index + 1}
        </div>
        <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginBottom: "0.25rem", marginTop: "0.25rem" }}>
          {isBroken ? "BROKEN LINK" : "VALID"} · Seq {entry.sequenceNumber ?? index}
        </div>
        <div style={{ fontSize: "0.72rem", fontFamily: "monospace", wordBreak: "break-all", color: statusColor }}>
          {(entry.entryHash || entry.hash || "").slice(0, 24)}...
        </div>
        <div style={{ fontSize: "0.65rem", color: "var(--text-muted)", marginTop: "0.3rem" }}>
          {entry.eventType || entry.action || "AUDIT_EVENT"}
        </div>
        {entry.createdAt && (
          <div style={{ fontSize: "0.63rem", color: "var(--text-muted)", marginTop: "0.15rem" }}>
            {new Date(entry.createdAt).toLocaleString()}
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── main component ──────────────────────────────────────── */
export default function AuditChainValidation({ onNavigate }) {
  const [validationResult, setValidationResult] = useState(null);
  const [checkpoints, setCheckpoints] = useState([]);
  const [recentEntries, setRecentEntries] = useState([]);
  const [validating, setValidating] = useState(false);
  const [checkpointing, setCheckpointing] = useState(false);
  const [checkpointMsg, setCheckpointMsg] = useState("");
  const [error, setError] = useState("");
  const [zoom, setZoom] = useState(1);
  const explorerRef = useRef(null);

  async function runValidation() {
    setValidating(true); setError("");
    try {
      const res = await api.auditLogs.validateChain();
      if (res?.success) setValidationResult(res.data.validation);
      else setError(res?.error?.message || "Chain validation returned failure");
    } catch (err) { setError(err.message || "Audit validation error"); }
    finally { setValidating(false); }
  }

  async function loadCheckpoints() {
    try {
      const res = await api.auditLogs.listCheckpoints();
      if (res?.success) setCheckpoints(res.data.checkpoints || []);
    } catch {}
  }

  async function loadRecentEntries() {
    try {
      const res = await api.auditLogs.list({ limit: 20, sortBy: "sequenceNumber", order: "desc" });
      if (res?.success) setRecentEntries((res.data.entries || res.data.auditLogs || []).reverse());
    } catch {}
  }

  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    runValidation(); 
    loadCheckpoints(); 
    loadRecentEntries(); 
  }, []);

  // Sequential animation of blocks and connectors with animejs
  useEffect(() => {
    if (!explorerRef.current || recentEntries.length === 0) return;
    const cards = explorerRef.current.querySelectorAll('.audit-block-card-wrapper');
    if (!cards || cards.length === 0) return;

    if (prefersReducedMotion) {
      cards.forEach((c) => { c.style.opacity = '1'; c.style.transform = 'none'; });
      return;
    }

    try {
      const anim = animate(cards, {
        opacity: [0, 1],
        translateY: [16, 0],
        duration: 400,
        delay: stagger(90, { start: 100 }),
        ease: 'outBack'
      });
      return () => {
        if (anim && typeof anim.cancel === 'function') anim.cancel();
      };
    } catch {
      cards.forEach((c) => { c.style.opacity = '1'; c.style.transform = 'none'; });
    }
  }, [recentEntries, prefersReducedMotion]);

  async function handleCreateCheckpoint() {
    setCheckpointing(true); setCheckpointMsg("");
    try {
      const res = await api.auditLogs.createCheckpoint({ externalAnchorType: "INTERNAL_LOCAL" });
      if (res?.success) {
        setCheckpointMsg(`Checkpoint ${res.data.checkpoint.checkpointId} anchored successfully.`);
        loadCheckpoints(); runValidation();
      }
    } catch (err) { setError(err.message || "Failed to anchor checkpoint"); }
    finally { setCheckpointing(false); }
  }

  /* derive broken indices from validationResult */
  const brokenSeqs = new Set((validationResult?.errors || []).map((e) => e.sequenceNumber).filter(Boolean));

  return (
    <div className="page-content">
      {/* Auditor breadcrumb */}
      {onNavigate && (
        <div className="glass-card" style={{ padding: "0.75rem 1.25rem", marginBottom: "1.25rem", background: "rgba(255,255,255,0.03)", border: "1px solid rgba(16,185,129,0.25)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap", fontSize: "0.8rem" }}>
            <span className="text-muted" style={{ fontWeight: 700 }}>AUDITOR WORKFLOW:</span>
            <span style={{ cursor: "pointer", color: "var(--accent-cyan)" }} onClick={() => onNavigate("dashboard")}>Auditor Dashboard</span>
            <span className="text-muted">&#8594;</span>
            <span style={{ cursor: "pointer", color: "var(--accent-blue)" }} onClick={() => onNavigate("audit_logs")}>Audit Logs</span>
            <span className="text-muted">&#8594;</span>
            <span style={{ cursor: "pointer", color: "var(--accent-purple)" }} onClick={() => onNavigate("verification_evidence")}>Evidence</span>
            <span className="text-muted">&#8594;</span>
            <strong style={{ color: "#10b981", textDecoration: "underline" }}>Validate Hash Chain</strong>
          </div>
        </div>
      )}

      <div className="page-header">
        <div>
          <h2>Cryptographic Audit Chain Validation Engine</h2>
          <p className="page-subtitle">Bitwise verification of SHA-256 hash linkages from Genesis digest through chain head.</p>
        </div>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button className="action-btn primary text-xs" onClick={handleCreateCheckpoint} disabled={checkpointing}><Anchor size={14} /> Anchor Checkpoint</button>
          <button className="action-btn secondary text-xs" onClick={runValidation} disabled={validating}><RefreshCw size={14} className={validating ? "pulse-dot" : ""} /> Validate</button>
        </div>
      </div>

      {checkpointMsg && <div className="alert-banner success" style={{ marginBottom: "1rem" }}><CheckCircle2 size={16} /><span>{checkpointMsg}</span></div>}
      {error && <div className="alert-banner danger" style={{ marginBottom: "1rem" }}><AlertOctagon size={16} /><span>{error}</span></div>}

      {/* Integrity summary */}
      {validationResult && (
        <div className="glass-card" style={{ marginBottom: "2rem" }}>
          <div className="section-header">
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <GitCommit size={22} className={validationResult.valid ? "text-success" : "text-danger"} />
              <h3>Chain Cryptographic Integrity</h3>
            </div>
            <StatusBadge status={validationResult.valid ? "VERIFIED" : "TAMPERED"} label={validationResult.valid ? "100% UNBROKEN CHAIN" : "CHAIN TAMPERED"} />
          </div>
          <div className="metrics-grid" style={{ margin: "1rem 0" }}>
            <div className="metric-card glass-card">
              <div className="metric-icon bg-cyan-subtle"><ShieldCheck size={20} className="text-cyan" /></div>
              <div className="metric-value">{validationResult.totalRecords || 0}</div>
              <div className="metric-label">Log Records Verified</div>
            </div>
            <div className="metric-card glass-card">
              <div className="metric-icon bg-green-subtle"><CheckCircle2 size={20} className="text-success" /></div>
              <div className="metric-value" style={{ color: validationResult.errors?.length ? "var(--color-danger)" : "var(--accent-green)" }}>
                {validationResult.errors?.length || 0}
              </div>
              <div className="metric-label">Integrity Errors</div>
            </div>
            <div className="metric-card glass-card">
              <div className="metric-icon bg-purple-subtle"><Anchor size={20} className="text-purple" /></div>
              <div className="metric-value">{checkpoints.length}</div>
              <div className="metric-label">Anchored Checkpoints</div>
            </div>
          </div>
          <div className="detail-row">
            <span className="detail-label">Chain Head Hash</span>
            <span className="code-snippet hash-text">{validationResult.chainHeadHash}</span>
          </div>
          {validationResult.errors?.length > 0 && (
            <div style={{ marginTop: "1.5rem" }}>
              <h4>Integrity Failures Detected</h4>
              <ul className="findings-list">
                {validationResult.errors.map((e, idx) => (
                  <li key={idx} className="finding-item text-danger"><AlertOctagon size={14} /><span>{e.message || JSON.stringify(e)}</span></li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Visual Block Chain Explorer */}
      {recentEntries.length > 0 && (
        <div style={{ marginBottom: "2rem" }}>
          <div className="section-header">
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <Link size={18} className="text-cyan" />
              <h3>Visual Audit Block Explorer</h3>
              <span className="text-muted text-xs">(last {recentEntries.length} blocks)</span>
            </div>
            <div style={{ display: "flex", gap: "0.4rem" }}>
              <button className="action-btn secondary text-xs" onClick={() => setZoom((z) => Math.max(0.5, z - 0.15))} title="Zoom out"><ZoomOut size={13} /></button>
              <span className="text-muted text-xs" style={{ alignSelf: "center", minWidth: "40px", textAlign: "center" }}>{Math.round(zoom * 100)}%</span>
              <button className="action-btn secondary text-xs" onClick={() => setZoom((z) => Math.min(1.5, z + 0.15))} title="Zoom in"><ZoomIn size={13} /></button>
              <button className="action-btn secondary text-xs" onClick={() => setZoom(1)}>Reset</button>
            </div>
          </div>
          <div className="glass-card" style={{ overflowX: "auto", padding: "1.5rem" }}>
            <div
              ref={explorerRef}
              style={{
                display: "flex", flexDirection: "row", alignItems: "center",
                gap: 0, width: "max-content",
                transform: `scale(${zoom})`, transformOrigin: "left center",
                transition: "transform 0.2s ease",
                paddingBottom: zoom < 1 ? `${(1 - zoom) * 220}px` : undefined
              }}
            >
              {recentEntries.map((entry, idx) => (
                <BlockCard
                  key={entry._id || idx}
                  entry={entry}
                  index={idx}
                  isFirst={idx === 0}
                  isBroken={brokenSeqs.has(entry.sequenceNumber)}
                />
              ))}
            </div>
            <p className="text-muted text-xs" style={{ marginTop: "1rem" }}>
              {validationResult?.valid
                ? "All hash linkages verified — chain is cryptographically intact."
                : "Broken links detected above (shown in red). Run validation for full analysis."}
            </p>
          </div>
        </div>
      )}

      {/* Checkpoints table */}
      <div className="section-header"><h3>Periodic Audit Checkpoint Anchors</h3></div>
      <div className="glass-card table-container">
        {checkpoints.length === 0 ? (
          <div className="empty-state">
            <Anchor size={36} style={{ opacity: 0.3, marginBottom: "0.75rem" }} />
            <p>No audit checkpoints created yet.</p>
            <button className="action-btn primary text-xs" onClick={handleCreateCheckpoint} style={{ marginTop: "0.5rem" }}>Create First Checkpoint</button>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr><th>Checkpoint ID</th><th>Sequence Range</th><th>Chain Head Hash</th><th>Anchor Type</th><th>Timestamp</th></tr>
            </thead>
            <tbody>
              {checkpoints.map((cp) => (
                <tr key={cp.checkpointId}>
                  <td className="code-snippet">{cp.checkpointId}</td>
                  <td><strong>#{cp.sequenceStart} — #{cp.sequenceEnd}</strong></td>
                  <td><span className="code-snippet hash-text">{cp.chainHeadHash?.slice(0, 20)}...</span></td>
                  <td><span className="badge-tag">{cp.externalAnchorType || "INTERNAL_LOCAL"}</span></td>
                  <td className="text-muted text-xs">{new Date(cp.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {onNavigate && (
        <div className="glass-card" style={{ marginTop: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.75rem" }}>
          <span className="text-muted text-xs">Auditor Flow Complete: Cryptographic hash chain bitwise verification confirmed</span>
          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
            <button className="action-btn secondary text-xs" onClick={() => onNavigate("dashboard")}>Back to Dashboard</button>
            <button className="action-btn secondary text-xs" onClick={() => onNavigate("audit_logs")}>Back to Audit Logs</button>
            <button className="action-btn primary text-xs" onClick={() => onNavigate("verification_evidence")}>Evidence Store</button>
          </div>
        </div>
      )}
    </div>
  );
}

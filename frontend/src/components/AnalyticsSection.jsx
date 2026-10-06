import React, { useState, useEffect } from "react";
import { BarChart2, TrendingUp, ShieldCheck, Award, RefreshCw, AlertTriangle } from "lucide-react";
import api from "../services/api";

/* ─── tiny pure-SVG bar chart ─────────────────────────────── */
function SvgBarChart({ data, label, colorVar = "--accent-cyan", height = 80 }) {
  if (!data || data.length === 0) return <p className="text-muted text-xs">No data</p>;
  const max = Math.max(...data.map((d) => d.value), 1);
  const barW = 28; const gap = 6;
  const totalW = data.length * (barW + gap) - gap;

  return (
    <div>
      <svg width={totalW} height={height + 32} style={{ overflow: "visible" }}>
        {data.map((d, i) => {
          const barH = Math.max(2, (d.value / max) * height);
          const x = i * (barW + gap);
          const y = height - barH;
          return (
            <g key={i}>
              <rect x={x} y={y} width={barW} height={barH} rx="4"
                fill={`var(${colorVar})`} opacity="0.8">
                <title>{d.label}: {d.value}</title>
              </rect>
              <text x={x + barW / 2} y={height + 14} textAnchor="middle" fontSize="9" fill="var(--text-muted)">{d.label}</text>
              {d.value > 0 && (
                <text x={x + barW / 2} y={y - 3} textAnchor="middle" fontSize="9" fill={`var(${colorVar})`}>{d.value}</text>
              )}
            </g>
          );
        })}
      </svg>
      <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>{label}</div>
    </div>
  );
}

/* ─── donut chart ─────────────────────────────────────────── */
function DonutChart({ segments }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
  let offset = 0;
  const r = 40; const cx = 55; const cy = 55;
  const circ = 2 * Math.PI * r;

  return (
    <svg width="110" height="110" viewBox="0 0 110 110">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="18" />
      {segments.map((seg, i) => {
        const pct = seg.value / total;
        const dash = pct * circ;
        const space = circ - dash;
        const el = (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none"
            stroke={seg.color} strokeWidth="18"
            strokeDasharray={`${dash} ${space}`}
            strokeDashoffset={-offset * circ / total}
            strokeLinecap="round"
            style={{ transition: "stroke-dasharray 0.6s ease" }}>
            <title>{seg.label}: {seg.value}</title>
          </circle>
        );
        offset += seg.value;
        return el;
      })}
      <text x={cx} y={cy + 5} textAnchor="middle" fontSize="13" fontWeight="700" fill="white">{total}</text>
    </svg>
  );
}

export default function AnalyticsSection({ onNavigate }) {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true); setError("");
    try {
      const res = await api.analytics.getOverview();
      if (res?.success) setOverview(res.data);
      else setError("Analytics unavailable");
    } catch { setError("Could not load analytics"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  if (!overview && !loading && error) return null;

  const credByStatus = overview ? [
    { label: "ACTIVE", value: overview.credentialsByStatus?.ACTIVE || 0, color: "#10b981" },
    { label: "REVOKED", value: overview.credentialsByStatus?.REVOKED || 0, color: "#ef4444" },
    { label: "EXPIRED", value: overview.credentialsByStatus?.EXPIRED || 0, color: "#f59e0b" },
  ] : [];

  const verByResult = overview ? [
    { label: "VALID", value: overview.verificationsByResult?.VALID || 0 },
    { label: "INVALID", value: overview.verificationsByResult?.INVALID || 0 },
    { label: "PENDING", value: overview.verificationsByResult?.PENDING || 0 },
    { label: "TAMPERED", value: overview.verificationsByResult?.TAMPERED || 0 },
  ] : [];

  const issuersBar = overview?.topIssuers?.slice(0, 6).map((iss) => ({
    label: iss.issuerCode?.slice(0, 6) || "N/A",
    value: iss.count || 0
  })) || [];

  return (
    <div style={{ marginTop: "2.5rem" }}>
      <div className="section-header">
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <BarChart2 size={18} className="text-cyan" />
          <h3>Platform Analytics Overview</h3>
        </div>
        <button className="action-btn secondary text-xs" onClick={load} disabled={loading}>
          <RefreshCw size={12} className={loading ? "pulse-dot" : ""} /> Refresh
        </button>
      </div>

      {loading && <div className="glass-card" style={{ textAlign: "center", padding: "2rem" }}><RefreshCw size={24} className="pulse-dot" style={{ opacity: 0.4 }} /></div>}
      {error && <div className="alert-banner danger" style={{ marginBottom: "1rem" }}><AlertTriangle size={14} /><span>{error}</span></div>}

      {overview && !loading && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "1rem" }}>
          {/* Credential status donut */}
          <div className="glass-card">
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
              <Award size={16} className="text-blue" /><h4 style={{ margin: 0 }}>Credential Status Mix</h4>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "1.5rem" }}>
              <DonutChart segments={credByStatus} />
              <div style={{ fontSize: "0.8rem" }}>
                {credByStatus.map((s) => (
                  <div key={s.label} style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.3rem" }}>
                    <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: s.color, flexShrink: 0 }} />
                    <span style={{ color: "var(--text-muted)" }}>{s.label}</span>
                    <strong style={{ color: s.color, marginLeft: "auto" }}>{s.value}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Verifications by result */}
          <div className="glass-card">
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
              <ShieldCheck size={16} className="text-cyan" /><h4 style={{ margin: 0 }}>Verification Results</h4>
            </div>
            <SvgBarChart data={verByResult} label="Verifications by outcome" colorVar="--accent-cyan" height={70} />
          </div>

          {/* Top issuers */}
          {issuersBar.length > 0 && (
            <div className="glass-card">
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
                <TrendingUp size={16} className="text-purple" /><h4 style={{ margin: 0 }}>Top Issuers by Volume</h4>
              </div>
              <SvgBarChart data={issuersBar} label="Credentials issued" colorVar="--accent-purple" height={70} />
            </div>
          )}

          {/* Snapshot KPIs */}
          <div className="glass-card">
            <h4 style={{ marginBottom: "0.75rem" }}>Platform Snapshot</h4>
            {[
              { label: "Total Credentials", value: overview.totalCredentials ?? 0 },
              { label: "Total Verifications", value: overview.totalVerifications ?? 0 },
              { label: "Total Users", value: overview.totalUsers ?? 0 },
              { label: "Total Issuers", value: overview.totalIssuers ?? 0 },
              { label: "Audit Log Entries", value: overview.totalAuditEntries ?? 0 },
            ].map((kpi) => (
              <div key={kpi.label} className="detail-row" style={{ padding: "0.35rem 0" }}>
                <span className="detail-label">{kpi.label}</span>
                <strong style={{ color: "var(--accent-cyan)", fontFamily: "monospace" }}>{kpi.value.toLocaleString()}</strong>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

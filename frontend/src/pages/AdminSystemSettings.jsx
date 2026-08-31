import React, { useState, useEffect } from 'react';
import { Settings, Server, ShieldCheck, Database, Key, Cpu, RefreshCw } from 'lucide-react';
import api from '../services/api';
import StatusBadge from '../components/StatusBadge';

export default function AdminSystemSettings() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);

  async function loadHealth() {
    setLoading(true);
    try {
      const res = await api.health.check();
      if (res && res.success) {
        setHealth(res.data);
      }
    } catch (err) {
      console.warn('Failed to load system health', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadHealth();
  }, []);

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h2>System Health & Cryptographic Architecture</h2>
          <p className="page-subtitle">
            Runtime environment status, local zero-cost subsystem configuration, and cryptographic primitives.
          </p>
        </div>
        <button className="action-btn secondary text-xs" onClick={loadHealth} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'pulse-dot' : ''} /> Ping Engine
        </button>
      </div>

      <div className="two-column-layout">
        {/* Runtime Diagnostics */}
        <div className="glass-card">
          <div className="section-header">
            <h3><Server size={18} className="text-cyan" /> Backend Service Runtime</h3>
            <StatusBadge status={health?.status || 'HEALTHY'} />
          </div>

          <div className="detail-row">
            <span className="detail-label">Service Name</span>
            <strong>{health?.service || 'SecureWork Verify Backend'}</strong>
          </div>
          <div className="detail-row">
            <span className="detail-label">Environment</span>
            <span className="code-snippet">{health?.environment || 'development'}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Version</span>
            <span>{health?.version || '0.1.0'}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Uptime</span>
            <span>{health?.uptimeSeconds ? `${Math.floor(health.uptimeSeconds / 60)} minutes` : 'Active'}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Database Connection</span>
            <span className="text-success" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Database size={14} /> MongoDB (127.0.0.1:27017)
            </span>
          </div>
        </div>

        {/* Cryptographic Primitives */}
        <div className="glass-card">
          <div className="section-header">
            <h3><Key size={18} className="text-purple" /> Cryptographic Parameters</h3>
            <span className="level-badge">RFC 8785 Compliant</span>
          </div>

          <div className="detail-row">
            <span className="detail-label">Digital Signature Algorithm</span>
            <strong>Ed25519 (EdDSA Curve25519)</strong>
          </div>
          <div className="detail-row">
            <span className="detail-label">Canonicalization Standard</span>
            <span>RFC 8785 JSON Canonicalization Scheme (JCS)</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Digest Hashing Algorithm</span>
            <span>SHA-256 (256-bit cryptographic digest)</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Audit Log Genesis Hash</span>
            <span className="code-snippet hash-text">SHA256("GENESIS_SECUREWORK_VERIFY")</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Storage Backend</span>
            <span>Local SHA-256 Content-Addressable Storage (Zero Cloud Leakage)</span>
          </div>
        </div>

        {/* Local Zero-Cost Subsystems */}
        <div className="glass-card" style={{ gridColumn: 'span 2' }}>
          <h3>Local Zero-Cost Subsystems (Zero Paid API Mandate)</h3>
          <div className="metrics-grid" style={{ marginTop: '1rem' }}>
            <div className="metric-card glass-card">
              <div className="metric-icon bg-cyan-subtle">
                <Cpu size={20} className="text-cyan" />
              </div>
              <div className="metric-value">Local Tesseract</div>
              <div className="metric-label">OCR Extraction Engine (Free)</div>
            </div>

            <div className="metric-card glass-card">
              <div className="metric-icon bg-purple-subtle">
                <ShieldCheck size={20} className="text-purple" />
              </div>
              <div className="metric-value">Local Heuristic</div>
              <div className="metric-label">AI Tampering Detection (Offline)</div>
            </div>

            <div className="metric-card glass-card">
              <div className="metric-icon bg-blue-subtle">
                <Server size={20} className="text-blue" />
              </div>
              <div className="metric-value">In-App & Console</div>
              <div className="metric-label">Local Notification Subsystem (Zero Paid SMS/Push)</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

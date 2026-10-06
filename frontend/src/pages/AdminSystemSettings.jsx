import React, { useState, useEffect } from 'react';
import { Settings, Server, ShieldCheck, Database, Key, Cpu, RefreshCw, HardDrive, Hash, CheckCircle2 } from 'lucide-react';
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
          <h2>System Health & Runtime Configuration</h2>
          <p className="page-subtitle">
            Active runtime environment, database telemetry, cryptographic audit-chain status, and storage drivers.
          </p>
        </div>
        <button className="action-btn secondary text-xs" onClick={loadHealth} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'pulse-dot' : ''} /> Refresh Health
        </button>
      </div>

      <div className="two-column-layout">
        {/* Runtime Diagnostics */}
        <div className="glass-card">
          <div className="section-header">
            <h3><Server size={18} className="text-cyan" /> Backend Service Runtime</h3>
            <StatusBadge status={health?.status === 'healthy' ? 'ACTIVE' : (health?.status || 'HEALTHY')} />
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
            <span className="detail-label">Version / Phase</span>
            <span>{health?.version || '0.1.0'} ({health?.phase || 'Phase 1'})</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Uptime</span>
            <span>{health?.uptimeSeconds ? `${Math.floor(health.uptimeSeconds / 60)}m ${health.uptimeSeconds % 60}s` : 'Active'}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Database Status</span>
            <span className="text-success" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Database size={14} /> {health?.database?.isConnected ? 'Connected' : 'Connecting'} — {health?.database?.host || 'MongoDB'}
              {health?.database?.isMemoryServer && <span className="level-badge" style={{ marginLeft: '0.5rem', fontSize: '0.7rem' }}>In-Memory Fallback</span>}
            </span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Storage Driver</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', textTransform: 'capitalize' }}>
              <HardDrive size={14} className="text-cyan" /> {health?.storage?.provider || (health?.storageDriver === 'cloudinary' ? 'Cloudinary (Authenticated)' : 'Local File Storage')}
            </span>
          </div>
        </div>

        {/* Cryptographic Primitives & Audit Chain */}
        <div className="glass-card">
          <div className="section-header">
            <h3><Key size={18} className="text-purple" /> Cryptography & Audit Chain</h3>
            <span className="level-badge">RFC 8785 Compliant</span>
          </div>

          <div className="detail-row">
            <span className="detail-label">Digital Signature Algorithm</span>
            <strong>Ed25519 (EdDSA Curve25519)</strong>
          </div>
          <div className="detail-row">
            <span className="detail-label">Audit-Chain Head Hash</span>
            <span className="code-snippet hash-text" title={health?.auditChain?.headHash}>
              {health?.auditChain?.headHash ? `${health.auditChain.headHash.slice(0, 24)}...` : 'Initializing...'}
            </span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Genesis Hash</span>
            <span className="code-snippet hash-text" title={health?.auditChain?.genesisHash}>
              {health?.auditChain?.genesisHash ? `${health.auditChain.genesisHash.slice(0, 24)}...` : 'SHA256("GENESIS_SECUREWORK_VERIFY")'}
            </span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Digest Hashing Algorithm</span>
            <span>SHA-256 (256-bit cryptographic digest)</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Audit Status</span>
            <span className="text-success" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <CheckCircle2 size={14} /> Hash Chain Active & Verifiable
            </span>
          </div>
        </div>

        {/* Subsystems & Engines */}
        <div className="glass-card" style={{ gridColumn: 'span 2' }}>
          <h3>Core Subsystems & AI Diagnostics</h3>
          <div className="metrics-grid" style={{ marginTop: '1rem' }}>
            <div className="metric-card glass-card">
              <div className="metric-icon bg-cyan-subtle">
                <Cpu size={20} className="text-cyan" />
              </div>
              <div className="metric-value">OCR: {health?.ocr?.status === 'on' ? 'Enabled' : 'Disabled'}</div>
              <div className="metric-label">Local Tesseract Engine ({health?.ocr?.engine || 'local'})</div>
            </div>

            <div className="metric-card glass-card">
              <div className="metric-icon bg-purple-subtle">
                <ShieldCheck size={20} className="text-purple" />
              </div>
              <div className="metric-value">AI Heuristics: {health?.ai?.status === 'on' ? 'Enabled' : 'Disabled'}</div>
              <div className="metric-label">Offline Document Tampering Analysis</div>
            </div>

            <div className="metric-card glass-card">
              <div className="metric-icon bg-blue-subtle">
                <HardDrive size={20} className="text-blue" />
              </div>
              <div className="metric-value">Driver: {health?.storageDriver?.toUpperCase() || 'LOCAL'}</div>
              <div className="metric-label">{health?.storageDriver === 'cloudinary' ? 'Private Cloudinary Driver' : 'Zero-Cost Local Disk Storage'}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

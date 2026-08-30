import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Server, 
  Database, 
  Key, 
  Cpu, 
  CheckCircle, 
  RefreshCw, 
  Terminal, 
  Layers, 
  FileCheck,
  Lock,
  Boxes,
  AlertTriangle,
  ArrowRight
} from 'lucide-react';
import { fetchHealth } from './services/api';

export default function App() {
  const [healthData, setHealthData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [lastChecked, setLastChecked] = useState(null);
  const [error, setError] = useState(null);

  async function checkBackendHealth() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetchHealth();
      if (response && response.success) {
        setHealthData(response.data);
      } else {
        setError(response?.error?.message || 'Failed to connect to backend service');
      }
    } catch (err) {
      setError(err.message || 'Network connection failed');
    } finally {
      setLoading(false);
      setLastChecked(new Date().toLocaleTimeString());
    }
  }

  useEffect(() => {
    checkBackendHealth();
  }, []);

  return (
    <div className="app-container">
      {/* Top Navigation */}
      <nav className="top-nav">
        <div className="brand-logo">
          <div className="logo-badge">
            <Shield size={22} />
          </div>
          <div>
            <div className="brand-name">
              SecureWork Verify
              <span className="brand-tag">Phase 0 Foundation</span>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button 
            id="refresh-health-btn"
            className="action-btn secondary" 
            onClick={checkBackendHealth} 
            disabled={loading}
            style={{ fontSize: '0.82rem', padding: '0.45rem 0.9rem' }}
          >
            <RefreshCw size={14} className={loading ? 'pulse-dot' : ''} />
            {loading ? 'Pinging Backend...' : 'Ping Health'}
          </button>
        </div>
      </nav>

      {/* Hero Section */}
      <header className="hero-banner">
        <div className="hero-pill">
          <CheckCircle size={14} /> Modular Monolith Architecture Ready
        </div>
        <h1>Cryptographic Workforce Verification</h1>
        <p className="hero-subtitle">
          Decentralized, zero-cost, tamper-evident credential verification engineered with public-key cryptography, RFC 8785 canonicalization, and append-only hash chains.
        </p>
      </header>

      {/* Status Overview Grid */}
      <section className="card-grid">
        {/* Backend Runtime Card */}
        <div className="glass-card">
          <div className="card-header-row">
            <div className="card-icon">
              <Server size={20} />
            </div>
            <span className={`status-badge ${healthData ? 'healthy' : error ? 'warning' : 'neutral'}`}>
              <span className="pulse-dot"></span>
              {healthData ? 'Backend Active' : error ? 'Service Offline' : 'Connecting...'}
            </span>
          </div>
          <h3>Backend Runtime</h3>
          <p style={{ margin: '0.5rem 0 1rem', fontSize: '0.9rem' }}>
            Node.js / Express unified server running on port 5000 with CORS and Helmet protection.
          </p>
          {healthData ? (
            <div className="code-box">
              <div>Uptime: {healthData.uptime}s</div>
              <div>Node: {healthData.system?.nodeVersion}</div>
              <div>Platform: {healthData.system?.platform}</div>
              <div>Memory: {healthData.system?.memoryUsageMB} MB RSS</div>
            </div>
          ) : (
            <div className="code-box" style={{ color: '#fca5a5' }}>
              {error ? `Status: ${error}` : 'Checking server endpoint at /api/health...'}
            </div>
          )}
        </div>

        {/* Database Status Card */}
        <div className="glass-card">
          <div className="card-header-row">
            <div className="card-icon">
              <Database size={20} />
            </div>
            <span className={`status-badge ${healthData?.database?.status === 'connected' ? 'healthy' : 'warning'}`}>
              <span className="pulse-dot"></span>
              {healthData?.database?.status === 'connected' ? 'MongoDB Connected' : 'Local Standby'}
            </span>
          </div>
          <h3>Persistence Layer</h3>
          <p style={{ margin: '0.5rem 0 1rem', fontSize: '0.9rem' }}>
            MongoDB & Mongoose connection configured with non-blocking graceful local fallback.
          </p>
          <div className="code-box">
            <div>Target: localhost:27017</div>
            <div>Database: securework_verify</div>
            <div>Status: {healthData?.database?.status || 'Standby (cloud DB not required)'}</div>
            <div>Storage Driver: local filesystem</div>
          </div>
        </div>

        {/* Security & Cryptography Card */}
        <div className="glass-card">
          <div className="card-header-row">
            <div className="card-icon">
              <Lock size={20} />
            </div>
            <span className="status-badge healthy">
              <span className="pulse-dot"></span> Zero-Cost Crypto
            </span>
          </div>
          <h3>Zero-Cost Security</h3>
          <p style={{ margin: '0.5rem 0 1rem', fontSize: '0.9rem' }}>
            100% native Node.js crypto APIs. Zero gas fees, zero external paid verification SaaS.
          </p>
          <div className="code-box">
            <div>Signatures: Ed25519 / ECDSA / RSA</div>
            <div>Hashing: SHA-256 / SHA-512</div>
            <div>Canonicalization: RFC 8785 (JCS)</div>
            <div>Keys Vault: backend/keys/ (Isolated)</div>
          </div>
        </div>
      </section>

      {/* Modular Monolith Architecture Matrix */}
      <section className="glass-card">
        <div className="card-header-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div className="card-icon">
              <Boxes size={20} />
            </div>
            <div>
              <h3>Modular Monolith Domain Boundaries</h3>
              <p style={{ fontSize: '0.85rem' }}>16 isolated business modules ready for phased implementation</p>
            </div>
          </div>
          <span className="brand-tag">Microservice Ready</span>
        </div>

        <div className="module-grid">
          {[
            { name: 'auth', phase: 'Phase 1', desc: 'JWT sessions & authentication' },
            { name: 'users', phase: 'Phase 1', desc: 'Identity & profile management' },
            { name: 'organizations', phase: 'Phase 1', desc: 'Multi-tenant organization units' },
            { name: 'issuers', phase: 'Phase 1', desc: 'Accredited credential issuers' },
            { name: 'issuerKeys', phase: 'Phase 1', desc: 'Asymmetric key lifecycle & rollover' },
            { name: 'documents', phase: 'Phase 2', desc: 'Document hashing & metadata' },
            { name: 'storage', phase: 'Phase 2', desc: 'Local/S3 storage adapter' },
            { name: 'credentials', phase: 'Phase 2', desc: 'Verifiable credential schemas' },
            { name: 'verification', phase: 'Phase 3', desc: 'Multi-stage verification engine' },
            { name: 'trust', phase: 'Phase 3', desc: 'Trust anchors & scoring' },
            { name: 'trustedSources', phase: 'Phase 3', desc: 'Official registry adapters' },
            { name: 'ocr', phase: 'Phase 4', desc: 'Open-source document OCR' },
            { name: 'ai', phase: 'Phase 4', desc: 'Document tampering heuristics' },
            { name: 'evidence', phase: 'Phase 5', desc: 'Portable proof packages' },
            { name: 'audit', phase: 'Phase 5', desc: 'Append-only hash chain logs' },
            { name: 'notifications', phase: 'Phase 6', desc: 'Status alerts & outbound webhooks' },
          ].map((mod) => (
            <div key={mod.name} className="module-pill">
              <div>
                <div className="module-name">{mod.name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{mod.desc}</div>
              </div>
              <span className="phase-tag">{mod.phase}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Engineering Doctrine Summary */}
      <section className="glass-card">
        <div className="card-header-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div className="card-icon">
              <FileCheck size={20} />
            </div>
            <div>
              <h3>Authoritative Engineering Rules</h3>
              <p style={{ fontSize: '0.85rem' }}>Enforced across all future development phases</p>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
          <div style={{ borderLeft: '2px solid var(--accent-cyan)', paddingLeft: '1rem' }}>
            <strong style={{ color: '#ffffff', display: 'block', marginBottom: '0.25rem' }}>1. Evidence First</strong>
            <p style={{ fontSize: '0.85rem' }}>No credential status can transition to verified without complete cryptographic proofs and audit metadata.</p>
          </div>
          <div style={{ borderLeft: '2px solid var(--accent-indigo)', paddingLeft: '1rem' }}>
            <strong style={{ color: '#ffffff', display: 'block', marginBottom: '0.25rem' }}>2. No Blockchain & No Fake APIs</strong>
            <p style={{ fontSize: '0.85rem' }}>Direct public-key verification without gas fees or slow consensus. Registries use strict adapter interfaces.</p>
          </div>
          <div style={{ borderLeft: '2px solid var(--accent-purple)', paddingLeft: '1rem' }}>
            <strong style={{ color: '#ffffff', display: 'block', marginBottom: '0.25rem' }}>3. Advisory AI / OCR</strong>
            <p style={{ fontSize: '0.85rem' }}>Computer vision and OCR provide extraction assistance and anomaly detection, never blind authority.</p>
          </div>
          <div style={{ borderLeft: '2px solid var(--success)', paddingLeft: '1rem' }}>
            <strong style={{ color: '#ffffff', display: 'block', marginBottom: '0.25rem' }}>4. Append-Only Audit Chains</strong>
            <p style={{ fontSize: '0.85rem' }}>Cryptographic hash-linked audit records ensure absolute non-repudiation and historical evidence preservation.</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="footer-row">
        <div>
          SecureWork Verify &copy; 2026. Phase 0 Foundation established.
        </div>
        <div>
          Last health probe: {lastChecked || 'Never'}
        </div>
      </footer>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  UploadCloud, 
  Award, 
  History, 
  Server, 
  Cpu, 
  Key, 
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  GitCommit,
  Copy,
  Check,
  Users,
  Building,
  Link2,
  Settings
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import StatusBadge from '../components/StatusBadge';
import SimplePricingPreview from '../components/SimplePricingPreview';
import AnalyticsSection from '../components/AnalyticsSection';
import ApiKeysWebhooksSection from '../components/ApiKeysWebhooksSection';
import SvgVerifiedShield from '../components/SvgVerifiedShield';

const PERSONA_CONFIGS = {
  USER: {
    badge: 'CREDENTIAL HOLDER',
    title: 'Credential Holder Dashboard',
    subtitle: 'Self-sovereign workforce qualification portfolio & cryptographic verification',
    welcome: 'Scholar & Credential Holder',
    metric2Label: 'My Credentials',
    metric2Sub: 'Signed Digital Credentials',
    metric3Label: 'Completed Checks',
    metric3Sub: 'Evaluated Verification Runs'
  },
  ISSUER: {
    badge: 'CREDENTIAL ISSUER',
    title: 'Credential Issuer Dashboard',
    subtitle: 'Institutional credential issuance & cryptographic key lifecycle management',
    welcome: 'Institutional Authority',
    metric2Label: 'Issued Credentials',
    metric2Sub: 'Institutional Digital Credentials',
    metric3Label: 'Active Keypairs',
    metric3Sub: 'Ed25519 Signing Keys'
  },
  HR: {
    badge: 'HR & TALENT VERIFIER',
    title: 'HR & Verifier Dashboard',
    subtitle: 'Candidate workforce qualification & official source registry verification',
    welcome: 'Talent Acquisition Verifier',
    metric2Label: 'Candidate Verifications',
    metric2Sub: 'Evaluated Applicant Records',
    metric3Label: 'Completed Checks',
    metric3Sub: 'Verification Runs'
  },
  AUDITOR: {
    badge: 'COMPLIANCE & AUDITOR',
    title: 'Compliance & Auditor Dashboard',
    subtitle: 'Tamper-evident audit trails, hash chain validation & evidence store inspection',
    welcome: 'Chief Compliance Auditor',
    metric2Label: 'Audit Records',
    metric2Sub: 'SHA-256 Hash Chained Logs',
    metric3Label: 'Evidence Checks',
    metric3Sub: 'Verification Runs Logged'
  },
  ADMIN: {
    badge: 'SYSTEM ADMINISTRATOR',
    title: 'System Administrator Dashboard',
    subtitle: 'Platform governance, organization trust accreditation & infrastructure health',
    welcome: 'System Administrator',
    metric2Label: 'Total Credentials',
    metric2Sub: 'Platform-wide Credentials',
    metric3Label: 'Evaluated Checks',
    metric3Sub: 'System Verification Runs'
  }
};

export default function UserDashboard({ onNavigate }) {
  const { user, role } = useAuth();
  const [copiedId, setCopiedId] = useState(false);
  const [applicantCredentials, setApplicantCredentials] = useState([]);
  const [stats, setStats] = useState({
    credentialsCount: 0,
    verificationsCount: 0,
    auditRecordsCount: 0,
    activeKeysCount: 0,
    backendStatus: 'CONNECTING'
  });
  const [recentVerifications, setRecentVerifications] = useState([]);
  const [loading, setLoading] = useState(true);

  const activeConfig = PERSONA_CONFIGS[role] || {
    badge: role || 'VERIFIED USER',
    title: `${role || 'User'} Dashboard`,
    subtitle: 'Cryptographic workforce verification dashboard',
    welcome: user?.name || user?.email || 'User',
    metric2Label: 'Active Credentials',
    metric2Sub: 'Digital Credentials',
    metric3Label: 'Completed Checks',
    metric3Sub: 'Verification Runs'
  };

  function handleCopyUserId() {
    if (user?.userId) {
      navigator.clipboard.writeText(user.userId);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  }

  async function loadDashboardData() {
    setLoading(true);
    try {
      // 1. Health check (public, safe for all)
      const healthRes = await api.health.check();
      const isHealthy = healthRes && healthRes.success;

      // 2. Fetch credentials if authorized role (USER, ISSUER, ADMIN, HR)
      let creds = [];
      if (role === 'USER' || role === 'ISSUER' || role === 'ADMIN' || role === 'HR') {
        try {
          const credRes = await api.credentials.list({ limit: 10 });
          if (credRes && credRes.success) {
            creds = credRes.data.credentials || [];
            setApplicantCredentials(creds);
          }
        } catch {}
      }

      // 3. Fetch verifications (safe for all)
      let verifs = [];
      try {
        const verRes = await api.verifications.list({ limit: 10 });
        if (verRes && verRes.success) {
          verifs = verRes.data.verifications || [];
        }
      } catch {}

      // 4. Fetch audit chain record count ONLY if auditor or admin
      let auditCount = 0;
      if (role === 'ADMIN' || role === 'AUDITOR') {
        try {
          const auditRes = await api.auditLogs.list({ limit: 1 });
          if (auditRes && auditRes.success) {
            auditCount = auditRes.data.pagination?.total || 0;
          }
        } catch {}
      }

      // 5. Fetch keys count if issuer or admin
      let keyCount = 0;
      if (role === 'ISSUER' || role === 'ADMIN') {
        try {
          const keyRes = await api.issuerKeys.list();
          if (keyRes && keyRes.success) {
            keyCount = (keyRes.data.keys || keyRes.data.issuerKeys || []).length;
          }
        } catch {}
      }

      setStats({
        credentialsCount: creds.length,
        verificationsCount: verifs.length,
        auditRecordsCount: auditCount,
        activeKeysCount: keyCount,
        backendStatus: isHealthy ? 'ONLINE' : 'OFFLINE'
      });
      setRecentVerifications(verifs);
    } catch (err) {
      console.warn('Dashboard data fetch error', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboardData();
  }, [role]);

  return (
    <div className="page-content">
      {/* Header Banner Tailored to Persona */}
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.35rem' }}>
            <span className="section-eyebrow-badge" style={{ margin: 0, textTransform: 'uppercase' }}>
              {activeConfig.badge}
            </span>
            <span className="level-badge" style={{ fontSize: '0.72rem' }}>
              ROLE: {role}
            </span>
          </div>
          <h2>{activeConfig.title}</h2>
          <p className="page-subtitle" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span>Welcome back, <strong className="text-cyan">{user?.name || user?.email || activeConfig.welcome}</strong> • {activeConfig.subtitle}</span>
            {user?.userId && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem', marginLeft: '0.5rem' }}>
                • User ID: <code className="code-snippet text-xs">{user.userId}</code>
                <button
                  className="icon-action-btn"
                  onClick={handleCopyUserId}
                  title="Copy User ID"
                  style={{ padding: '2px', cursor: 'pointer' }}
                >
                  {copiedId ? <Check size={13} className="text-success" /> : <Copy size={13} />}
                </button>
              </span>
            )}
          </p>
        </div>
        <button className="action-btn secondary text-xs" onClick={loadDashboardData} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'pulse-dot' : ''} />
          Refresh
        </button>
      </div>

      {/* Auditor Workflow Journey Banner */}
      {role === 'AUDITOR' && (
        <div className="glass-card" style={{ padding: '0.85rem 1.25rem', marginBottom: '1.5rem', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(0, 240, 255, 0.2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.82rem' }}>
              <span className="text-muted" style={{ fontWeight: 700, letterSpacing: '0.5px' }}>AUDITOR FLOW:</span>
              <strong style={{ color: 'var(--accent-cyan)' }}>Auditor Dashboard (Current)</strong>
              <span className="text-muted">→</span>
              <span style={{ cursor: 'pointer', color: 'var(--accent-blue)', textDecoration: 'underline' }} onClick={() => onNavigate('audit_logs')}>Audit Logs</span>
              <span className="text-muted">→</span>
              <span className="text-muted">Select Event</span>
              <span className="text-muted">→</span>
              <span className="text-muted">Event Details</span>
              <span className="text-muted">→</span>
              <span style={{ cursor: 'pointer', color: 'var(--accent-purple)', textDecoration: 'underline' }} onClick={() => onNavigate('verification_evidence')}>Evidence</span>
              <span className="text-muted">→</span>
              <span style={{ cursor: 'pointer', color: '#10b981', textDecoration: 'underline' }} onClick={() => onNavigate('chain_validation')}>Validate Hash Chain</span>
            </div>
            <button className="action-btn primary text-xs" onClick={() => onNavigate('audit_logs')}>
              Open Audit Logs Pipeline →
            </button>
          </div>
        </div>
      )}

      {/* Admin Governance Journey Banner */}
      {role === 'ADMIN' && (
        <div className="glass-card" style={{ padding: '0.85rem 1.25rem', marginBottom: '1.5rem', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(139, 92, 246, 0.25)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.82rem' }}>
              <span className="text-muted" style={{ fontWeight: 700, letterSpacing: '0.5px' }}>ADMIN FLOW:</span>
              <strong style={{ color: 'var(--accent-purple)' }}>Admin Dashboard (Current)</strong>
              <span className="text-muted">→</span>
              <span style={{ cursor: 'pointer', color: 'var(--accent-cyan)', textDecoration: 'underline' }} onClick={() => onNavigate('admin_users')}>Users</span>
              <span className="text-muted">→</span>
              <span style={{ cursor: 'pointer', color: 'var(--accent-blue)', textDecoration: 'underline' }} onClick={() => onNavigate('admin_organizations')}>Organizations</span>
              <span className="text-muted">→</span>
              <span style={{ cursor: 'pointer', color: 'var(--accent-purple)', textDecoration: 'underline' }} onClick={() => onNavigate('admin_issuers')}>Issuers</span>
              <span className="text-muted">→</span>
              <span style={{ cursor: 'pointer', color: 'var(--accent-cyan)', textDecoration: 'underline' }} onClick={() => onNavigate('admin_trusted_sources')}>Trusted Sources</span>
              <span className="text-muted">→</span>
              <span style={{ cursor: 'pointer', color: '#10b981', textDecoration: 'underline' }} onClick={() => onNavigate('admin_settings')}>System Health</span>
            </div>
            <button className="action-btn primary text-xs" onClick={() => onNavigate('admin_users')}>
              Start Admin Governance Flow →
            </button>
          </div>
        </div>
      )}

      {/* Metrics Row */}
      <div className="metrics-grid">
        <div className="metric-card glass-card">
          <div className="metric-card-top">
            <span className="metric-label">Backend Engine</span>
            <div className="metric-icon bg-cyan-subtle">
              <Server size={18} className="text-cyan" />
            </div>
          </div>
          <div className="metric-card-bottom">
            <div className="metric-status-row">
              <span className={`status-indicator-dot ${stats.backendStatus === 'ONLINE' ? 'online' : 'offline'}`}></span>
              <span className="metric-status-text">{stats.backendStatus === 'ONLINE' ? 'Online' : 'Offline'}</span>
            </div>
            <span className="metric-subtext">Ed25519 & SHA-256 Engine</span>
          </div>
        </div>

        <div className="metric-card glass-card">
          <div className="metric-card-top">
            <span className="metric-label">{activeConfig.metric2Label}</span>
            <div className="metric-icon bg-blue-subtle">
              <Award size={18} className="text-blue" />
            </div>
          </div>
          <div className="metric-card-bottom">
            <div className="metric-number">{role === 'AUDITOR' ? stats.auditRecordsCount : stats.credentialsCount}</div>
            <span className="metric-subtext">{activeConfig.metric2Sub}</span>
          </div>
        </div>

        <div className="metric-card glass-card">
          <div className="metric-card-top">
            <span className="metric-label">{activeConfig.metric3Label}</span>
            <div className="metric-icon bg-purple-subtle">
              <ShieldCheck size={18} className="text-purple" />
            </div>
          </div>
          <div className="metric-card-bottom">
            <div className="metric-number">{role === 'ISSUER' ? (stats.activeKeysCount || stats.verificationsCount) : stats.verificationsCount}</div>
            <span className="metric-subtext">{activeConfig.metric3Sub}</span>
          </div>
        </div>

        {role === 'USER' && (
          <div className="metric-card glass-card">
            <div className="metric-card-top">
              <span className="metric-label">Identity Status</span>
              <div className="metric-icon bg-green-subtle">
                <SvgVerifiedShield size={20} />
              </div>
            </div>
            <div className="metric-card-bottom">
              <div className="metric-status-row">
                <span className="status-indicator-dot online"></span>
                <span className="metric-status-text">Verified Profile</span>
              </div>
              <span className="metric-subtext">Ed25519 Cryptographic Trust</span>
            </div>
          </div>
        )}

        {role === 'ISSUER' && (
          <div className="metric-card glass-card">
            <div className="metric-card-top">
              <span className="metric-label">Signing Mandate</span>
              <div className="metric-icon bg-green-subtle">
                <Key size={18} className="text-success" />
              </div>
            </div>
            <div className="metric-card-bottom">
              <div className="metric-status-row">
                <span className="status-indicator-dot online"></span>
                <span className="metric-status-text">Active Authority</span>
              </div>
              <span className="metric-subtext">Verified Institutional Status</span>
            </div>
          </div>
        )}

        {role === 'HR' && (
          <div className="metric-card glass-card">
            <div className="metric-card-top">
              <span className="metric-label">Verification Mode</span>
              <div className="metric-icon bg-blue-subtle">
                <ShieldCheck size={18} className="text-blue" />
              </div>
            </div>
            <div className="metric-card-bottom">
              <div className="metric-status-row">
                <span className="status-indicator-dot online"></span>
                <span className="metric-status-text">16-Check Pipeline</span>
              </div>
              <span className="metric-subtext">Cryptographic & Official Source</span>
            </div>
          </div>
        )}

        {(role === 'AUDITOR' || role === 'ADMIN') && (
          <div className="metric-card glass-card">
            <div className="metric-card-top">
              <span className="metric-label">Audit Chain</span>
              <div className="metric-icon bg-green-subtle">
                <GitCommit size={18} className="text-success" />
              </div>
            </div>
            <div className="metric-card-bottom">
              <div className="metric-status-row">
                <span className="status-indicator-dot online"></span>
                <span className="metric-status-text">Valid & Intact</span>
              </div>
              <span className="metric-subtext">{stats.auditRecordsCount} Tamper-Evident Records</span>
            </div>
          </div>
        )}
      </div>

      {/* Quick Action Cards based on Role */}
      <div className="section-header">
        <h3>Role Operations & Portals</h3>
      </div>
      <div className="action-cards-grid">
        {(role === 'USER' || role === 'ADMIN') && (
          <>
            <div className="action-tile glass-card" onClick={() => onNavigate('upload_document')}>
              <div className="tile-icon bg-cyan-subtle">
                <UploadCloud size={24} className="text-cyan" />
              </div>
              <h4>Upload Document</h4>
              <p>Compute SHA-256 digests and store immutable local artifacts for verification.</p>
              <div className="tile-footer">
                <span>Upload Document</span>
                <ArrowRight size={14} />
              </div>
            </div>

            <div className="action-tile glass-card" onClick={() => onNavigate('verify_document')}>
              <div className="tile-icon bg-blue-subtle">
                <ShieldCheck size={24} className="text-blue" />
              </div>
              <h4>Verify Credential</h4>
              <p>Run 16-check evidence pipeline with Ed25519 digital signature validation.</p>
              <div className="tile-footer">
                <span>Run Verification</span>
                <ArrowRight size={14} />
              </div>
            </div>

            <div className="action-tile glass-card" onClick={() => onNavigate('my_credentials')}>
              <div className="tile-icon bg-purple-subtle">
                <Award size={24} className="text-purple" />
              </div>
              <h4>My Credentials</h4>
              <p>Inspect your portable workforce credentials, signing keys, and release versions.</p>
              <div className="tile-footer">
                <span>View Portfolio</span>
                <ArrowRight size={14} />
              </div>
            </div>
          </>
        )}

        {(role === 'ISSUER' || role === 'ADMIN') && (
          <>
            <div className="action-tile glass-card" onClick={() => onNavigate('issuer_status')}>
              <div className="tile-icon bg-green-subtle">
                <CheckCircle2 size={24} className="text-success" />
              </div>
              <h4>Issuer Authority Status</h4>
              <p>Review institutional accreditation, legal signing mandates, and active profiles.</p>
              <div className="tile-footer">
                <span>View Status</span>
                <ArrowRight size={14} />
              </div>
            </div>

            <div className="action-tile glass-card" onClick={() => onNavigate('key_status')}>
              <div className="tile-icon bg-purple-subtle">
                <Key size={24} className="text-purple" />
              </div>
              <h4>Cryptographic Key Management</h4>
              <p>Inspect active Ed25519 keys, trigger cryptographic rotation, and flag compromises.</p>
              <div className="tile-footer">
                <span>Inspect Keys</span>
                <ArrowRight size={14} />
              </div>
            </div>

            <div className="action-tile glass-card" onClick={() => onNavigate('issue_credential')}>
              <div className="tile-icon bg-cyan-subtle">
                <Award size={24} className="text-cyan" />
              </div>
              <h4>Issue Credential</h4>
              <p>Sign workforce qualifications with active institutional Ed25519 keypair.</p>
              <div className="tile-footer">
                <span>Issue Credential</span>
                <ArrowRight size={14} />
              </div>
            </div>

            <div className="action-tile glass-card" onClick={() => onNavigate('credential_list')}>
              <div className="tile-icon bg-blue-subtle">
                <History size={24} className="text-blue" />
              </div>
              <h4>Credential Registry & Revocations</h4>
              <p>Manage issued credentials, version lineages, and execute auditable revocations.</p>
              <div className="tile-footer">
                <span>Manage Registry</span>
                <ArrowRight size={14} />
              </div>
            </div>
          </>
        )}

        {(role === 'HR' || role === 'ADMIN') && (
          <>
            <div className="action-tile glass-card" onClick={() => onNavigate('verify_document')}>
              <div className="tile-icon bg-blue-subtle">
                <ShieldCheck size={24} className="text-blue" />
              </div>
              <h4>HR Candidate Verification</h4>
              <p>Verify applicant degrees, certificates, and employment records cryptographically.</p>
              <div className="tile-footer">
                <span>Evaluate Applicant</span>
                <ArrowRight size={14} />
              </div>
            </div>

            <div className="action-tile glass-card" onClick={() => onNavigate('verify_source')}>
              <div className="tile-icon bg-cyan-subtle">
                <Server size={24} className="text-cyan" />
              </div>
              <h4>Verify Official Source</h4>
              <p>Directly query whitelisted university and government registries with SSRF protection.</p>
              <div className="tile-footer">
                <span>Query Source</span>
                <ArrowRight size={14} />
              </div>
            </div>

            <div className="action-tile glass-card" onClick={() => onNavigate('verification_history')}>
              <div className="tile-icon bg-purple-subtle">
                <History size={24} className="text-purple" />
              </div>
              <h4>Candidate Verification Logs</h4>
              <p>Inspect immutable audit logs, previousHash chains, and past candidate evaluations.</p>
              <div className="tile-footer">
                <span>Inspect Logs</span>
                <ArrowRight size={14} />
              </div>
            </div>

            <div className="action-tile glass-card" onClick={() => onNavigate('verification_evidence')}>
              <div className="tile-icon bg-green-subtle">
                <CheckCircle2 size={24} className="text-success" />
              </div>
              <h4>Verification Evidence Store</h4>
              <p>Browse discrete, immutable evidence packages collected across all verification runs.</p>
              <div className="tile-footer">
                <span>Inspect Evidence</span>
                <ArrowRight size={14} />
              </div>
            </div>
          </>
        )}

        {(role === 'AUDITOR' || role === 'ADMIN') && (
          <>
            <div className="action-tile glass-card" onClick={() => onNavigate('audit_logs')}>
              <div className="tile-icon bg-blue-subtle">
                <History size={24} className="text-blue" />
              </div>
              <h4>Hash-Chained Audit Logs</h4>
              <p>Review append-only events, previousHash linkage, and anchor external checkpoints.</p>
              <div className="tile-footer">
                <span>Inspect Logs</span>
                <ArrowRight size={14} />
              </div>
            </div>

            <div className="action-tile glass-card" onClick={() => onNavigate('verification_evidence')}>
              <div className="tile-icon bg-purple-subtle">
                <CheckCircle2 size={24} className="text-purple" />
              </div>
              <h4>Verification Evidence Store</h4>
              <p>Inspect discrete, immutable evidence records collected across all pipeline runs.</p>
              <div className="tile-footer">
                <span>Browse Evidence</span>
                <ArrowRight size={14} />
              </div>
            </div>

            <div className="action-tile glass-card" onClick={() => onNavigate('chain_validation')}>
              <div className="tile-icon bg-green-subtle">
                <GitCommit size={24} className="text-success" />
              </div>
              <h4>Audit Chain Bitwise Validation</h4>
              <p>Verify cryptographic integrity of SHA-256 hash-chained immutable audit events.</p>
              <div className="tile-footer">
                <span>Validate Chain</span>
                <ArrowRight size={14} />
              </div>
            </div>
          </>
        )}

        {role === 'ADMIN' && (
          <>
            <div className="action-tile glass-card" onClick={() => onNavigate('admin_users')}>
              <div className="tile-icon bg-blue-subtle">
                <Users size={24} className="text-blue" />
              </div>
              <h4>User Directory & RBAC</h4>
              <p>Authoritative identity registry, RBAC role assignment, and user administration.</p>
              <div className="tile-footer">
                <span>Manage Users</span>
                <ArrowRight size={14} />
              </div>
            </div>

            <div className="action-tile glass-card" onClick={() => onNavigate('admin_organizations')}>
              <div className="tile-icon bg-cyan-subtle">
                <Building size={24} className="text-cyan" />
              </div>
              <h4>Organization Trust Governance</h4>
              <p>Verify and accredit institutions, universities, and enterprise certificate authorities.</p>
              <div className="tile-footer">
                <span>Accredit Orgs</span>
                <ArrowRight size={14} />
              </div>
            </div>

            <div className="action-tile glass-card" onClick={() => onNavigate('admin_issuers')}>
              <div className="tile-icon bg-purple-subtle">
                <Award size={24} className="text-purple" />
              </div>
              <h4>Issuer Accreditation</h4>
              <p>Review and authorize institutional signing profiles and legal mandates.</p>
              <div className="tile-footer">
                <span>Manage Issuers</span>
                <ArrowRight size={14} />
              </div>
            </div>

            <div className="action-tile glass-card" onClick={() => onNavigate('admin_trusted_sources')}>
              <div className="tile-icon bg-cyan-subtle">
                <Link2 size={24} className="text-cyan" />
              </div>
              <h4>Whitelisted Trusted Sources</h4>
              <p>Manage official verification registries and enforce strict SSRF domain protection.</p>
              <div className="tile-footer">
                <span>Manage Sources</span>
                <ArrowRight size={14} />
              </div>
            </div>

            <div className="action-tile glass-card" onClick={() => onNavigate('admin_settings')}>
              <div className="tile-icon bg-green-subtle">
                <Settings size={24} className="text-success" />
              </div>
              <h4>System Health & Primitives</h4>
              <p>Inspect backend runtime health, MongoDB connection status, and cryptographic parameters.</p>
              <div className="tile-footer">
                <span>System Health</span>
                <ArrowRight size={14} />
              </div>
            </div>
          </>
        )}
      </div>

      {/* For HR Persona: Candidate Qualifications Awaiting Verification */}
      {role === 'HR' && applicantCredentials.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <div className="section-header">
            <div>
              <h3>Candidate Qualifications Ready for HR Verification</h3>
              <p className="text-muted text-xs">Direct pipeline entry: Select a candidate credential to trigger the 16-check verification engine.</p>
            </div>
            <button className="link-btn" onClick={() => onNavigate('verify_document')}>
              Open Verification Engine →
            </button>
          </div>

          <div className="glass-card table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Credential ID</th>
                  <th>Candidate Qualification</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Issued Date</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {applicantCredentials.slice(0, 5).map((c) => (
                  <tr key={c.credentialId}>
                    <td className="code-snippet" style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>{c.credentialId}</td>
                    <td><strong>{c.title}</strong></td>
                    <td><span className="badge-tag">{c.credentialType}</span></td>
                    <td><StatusBadge status={c.status} /></td>
                    <td className="text-muted text-xs">{new Date(c.createdAt).toLocaleDateString()}</td>
                    <td>
                      <button
                        className="action-btn primary text-xs"
                        style={{ padding: '4px 10px' }}
                        onClick={() => onNavigate('verify_document', { credentialId: c.credentialId })}
                        title="Evaluate this candidate qualification in Verification Engine"
                      >
                        Verify Candidate →
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Verifications Table */}
      <div className="section-header" style={{ marginTop: '2rem' }}>
        <h3>Recent Verifications</h3>
        <button className="link-btn" onClick={() => onNavigate('verification_history')}>
          View Full History
        </button>
      </div>

      <div className="glass-card table-container">
        {recentVerifications.length === 0 ? (
          <div className="empty-state">
            <ShieldCheck size={36} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
            <p>No recent verifications recorded.</p>
            <button className="action-btn primary text-xs" onClick={() => onNavigate('verify_document')}>
              Start First Verification
            </button>
          </div>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Verification ID</th>
                <th>Credential / Target</th>
                <th>Cryptographic Status</th>
                <th>Categorical Result</th>
                <th>Trust Level</th>
                <th>Timestamp</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {recentVerifications.map((v) => (
                <tr 
                  key={v.verificationId} 
                  onClick={() => onNavigate('verification_history', { verificationId: v.verificationId, credentialId: v.credentialId })}
                  style={{ cursor: 'pointer' }}
                  title="Click to view full verification details"
                >
                  <td className="code-snippet" style={{ color: 'var(--accent-cyan)', fontWeight: 600 }}>{v.verificationId}</td>
                  <td>{v.credentialId || (v.documentHash ? `${v.documentHash.slice(0, 16)}...` : 'N/A')}</td>
                  <td><StatusBadge status={v.cryptographicStatus} /></td>
                  <td><StatusBadge status={v.finalResult || v.result} /></td>
                  <td><span className="level-badge">{v.trustLevel || 'LEVEL 0'}</span></td>
                  <td className="text-muted text-xs">{new Date(v.evaluatedAt || v.createdAt).toLocaleString()}</td>
                  <td>
                    <div style={{ display: 'flex', gap: '0.4rem' }}>
                      <button 
                        className="icon-action-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigate('verification_history', { verificationId: v.verificationId, credentialId: v.credentialId });
                        }}
                        title="Inspect Exact Verification"
                      >
                        Inspect →
                      </button>
                      <button 
                        className="icon-action-btn"
                        style={{ color: 'var(--accent-purple)' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          onNavigate('verification_evidence', { verificationId: v.verificationId, credentialId: v.credentialId });
                        }}
                        title="Inspect Discrete Evidence Package"
                      >
                        Evidence
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Analytics Overview — ADMIN & ISSUER */}
      {(role === 'ADMIN' || role === 'ISSUER') && (
        <AnalyticsSection onNavigate={onNavigate} />
      )}

      {/* API Keys & Webhooks — ADMIN only */}
      {role === 'ADMIN' && (
        <ApiKeysWebhooksSection />
      )}

      {/* Platform Features, Trusted Partners & Simple Pricing Preview */}
      <SimplePricingPreview onNavigate={onNavigate} />
    </div>
  );
}

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
  GitCommit
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import StatusBadge from '../components/StatusBadge';

export default function UserDashboard({ onNavigate }) {
  const { user, role } = useAuth();
  const [stats, setStats] = useState({
    credentialsCount: 0,
    verificationsCount: 0,
    auditRecordsCount: 0,
    backendStatus: 'CONNECTING'
  });
  const [recentVerifications, setRecentVerifications] = useState([]);
  const [loading, setLoading] = useState(true);

  async function loadDashboardData() {
    setLoading(true);
    try {
      // 1. Health check
      const healthRes = await api.health.check();
      const isHealthy = healthRes && healthRes.success;

      // 2. Fetch credentials if user
      let creds = [];
      try {
        const credRes = await api.credentials.list({ limit: 5 });
        if (credRes && credRes.success) {
          creds = credRes.data.credentials || [];
        }
      } catch {}

      // 3. Fetch verifications
      let verifs = [];
      try {
        const verRes = await api.verifications.list({ limit: 5 });
        if (verRes && verRes.success) {
          verifs = verRes.data.verifications || [];
        }
      } catch {}

      // 4. Fetch audit chain validation summary if auditor/admin
      let auditCount = 0;
      try {
        const auditRes = await api.auditLogs.list({ limit: 1 });
        if (auditRes && auditRes.success) {
          auditCount = auditRes.data.pagination?.total || 0;
        }
      } catch {}

      setStats({
        credentialsCount: creds.length,
        verificationsCount: verifs.length,
        auditRecordsCount: auditCount,
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
  }, []);

  return (
    <div className="page-content">
      {/* Header Banner */}
      <div className="page-header">
        <div>
          <h2>Welcome back, {user?.name || user?.email || 'Scholar'}</h2>
          <p className="page-subtitle">
            Cryptographic workforce verification dashboard • Active role: <strong className="text-cyan">{role}</strong>
          </p>
        </div>
        <button className="action-btn secondary text-xs" onClick={loadDashboardData} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'pulse-dot' : ''} />
          Refresh
        </button>
      </div>

      {/* Metrics Row */}
      <div className="metrics-grid">
        <div className="metric-card glass-card">
          <div className="metric-icon bg-blue-subtle">
            <Server size={20} className="text-blue" />
          </div>
          <div className="metric-value">
            <StatusBadge status={stats.backendStatus} />
          </div>
          <div className="metric-label">Backend Cryptographic Engine</div>
        </div>

        <div className="metric-card glass-card">
          <div className="metric-icon bg-cyan-subtle">
            <Award size={20} className="text-cyan" />
          </div>
          <div className="metric-value">{stats.credentialsCount}</div>
          <div className="metric-label">Active Credentials</div>
        </div>

        <div className="metric-card glass-card">
          <div className="metric-icon bg-purple-subtle">
            <ShieldCheck size={20} className="text-purple" />
          </div>
          <div className="metric-value">{stats.verificationsCount}</div>
          <div className="metric-label">Completed Verifications</div>
        </div>

        <div className="metric-card glass-card">
          <div className="metric-icon bg-green-subtle">
            <GitCommit size={20} className="text-success" />
          </div>
          <div className="metric-value">{stats.auditRecordsCount || 'Valid'}</div>
          <div className="metric-label">Hash-Chained Audit Events</div>
        </div>
      </div>

      {/* Quick Action Cards based on Role */}
      <div className="section-header">
        <h3>Role Operations & Portals</h3>
      </div>
      <div className="action-cards-grid">
        {(role === 'USER' || role === 'ADMIN' || !role) && (
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
          </>
        )}

        {(role === 'AUDITOR' || role === 'ADMIN') && (
          <>
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
          </>
        )}

        {role === 'ADMIN' && (
          <>
            <div className="action-tile glass-card" onClick={() => onNavigate('admin_organizations')}>
              <div className="tile-icon bg-cyan-subtle">
                <Server size={24} className="text-cyan" />
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
          </>
        )}
      </div>

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
              </tr>
            </thead>
            <tbody>
              {recentVerifications.map((v) => (
                <tr key={v.verificationId}>
                  <td className="code-snippet">{v.verificationId}</td>
                  <td>{v.credentialId || v.documentHash?.slice(0, 16) + '...'}</td>
                  <td><StatusBadge status={v.cryptographicStatus} /></td>
                  <td><StatusBadge status={v.finalResult || v.result} /></td>
                  <td><span className="level-badge">{v.trustLevel || 'LEVEL 0'}</span></td>
                  <td className="text-muted text-xs">{new Date(v.evaluatedAt || v.createdAt).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

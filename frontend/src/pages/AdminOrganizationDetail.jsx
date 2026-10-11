import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Building, 
  ShieldCheck, 
  ArrowLeft, 
  Globe, 
  CheckCircle2, 
  AlertTriangle, 
  RefreshCw, 
  Users, 
  KeyRound, 
  FileBadge, 
  Link2, 
  Clock, 
  Calendar,
  Lock,
  ExternalLink,
  ShieldAlert,
  Sliders
} from 'lucide-react';
import api from '../services/api';
import StatusBadge from '../components/StatusBadge';

export default function AdminOrganizationDetail({ onNavigate }) {
  const { organizationId } = useParams();
  const navigate = useNavigate();

  const [organization, setOrganization] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  // Associated resources
  const [issuers, setIssuers] = useState([]);
  const [trustedSources, setTrustedSources] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loadingResources, setLoadingResources] = useState(false);

  async function fetchOrg() {
    setLoading(true);
    setError('');
    try {
      const res = await api.organizations.getById(organizationId);
// Log request and response for debugging
console.log('Fetching organization with ID:', organizationId);
console.log('API response:', res);
// Support { success: true, data: { organization: ... } } and direct responses
const org = res?.data?.organization || res?.organization || (res?.success ? res.data : null) || res;
      if (!org || (!org.organizationId && !org.name)) {
        setError(`Organization not found. Response: ${JSON.stringify(res)}`);
      } else {
        setOrganization(org);
        loadRelatedResources(org);
      }
    } catch (e) {
      setError(e.message || 'Failed to load organization details');
    } finally {
      setLoading(false);
    }
  }

  async function loadRelatedResources(org) {
    setLoadingResources(true);
    const orgId = org.organizationId;
    const orgCode = org.organizationCode || org.code;

    try {
      // 1. Load Issuers
      const issuersRes = await api.issuers.list({ organizationId: orgId }).catch(() => null);
      if (issuersRes?.success && Array.isArray(issuersRes?.data?.issuers)) {
        const orgIssuers = issuersRes.data.issuers.filter(
          (i) => i.organizationId === orgId || i.organizationId === orgCode || i.organizationCode === orgCode
        );
        setIssuers(orgIssuers.length > 0 ? orgIssuers : issuersRes.data.issuers.filter(i => i.organizationId === orgId));
      }

      // 2. Load Trusted Sources
      const sourcesRes = await api.trustedSources.list({ organizationId: orgId }).catch(() => null);
      if (sourcesRes?.success && Array.isArray(sourcesRes?.data?.sources)) {
        const orgSources = sourcesRes.data.sources.filter(
          (s) => s.organizationId === orgId || s.organizationId === orgCode
        );
        setTrustedSources(orgSources.length > 0 ? orgSources : sourcesRes.data.sources.filter(s => s.organizationId === orgId));
      }

      // 3. Load Audit Logs
      const logsRes = await api.auditLogs.list({ limit: 10 }).catch(() => null);
      if (logsRes?.success && Array.isArray(logsRes?.data?.logs)) {
        setAuditLogs(logsRes.data.logs);
      }
    } catch (err) {
      console.warn('Failed to load related resources for organization', err);
    } finally {
      setLoadingResources(false);
    }
  }

  useEffect(() => {
    if (organizationId) {
      fetchOrg();
    }
  }, [organizationId]);

  async function handleVerify() {
    if (!confirm(`Verify and accredit "${organization.name}"? Member issuers will become eligible for accreditation.`)) return;
    setError('');
    setMessage('');
    try {
      const res = await api.organizations.verify(organization.organizationId);
      if (res && res.success) {
        setMessage(`Organization "${organization.name}" verified and accredited successfully.`);
        fetchOrg();
      }
    } catch (err) {
      setError(err.message || 'Failed to verify organization');
    }
  }

  async function handleSuspend() {
    const reason = prompt('Enter suspension reason:', 'Administrative compliance review');
    if (!reason) return;
    setError('');
    setMessage('');
    try {
      const res = await api.organizations.suspend(organization.organizationId, reason);
      if (res && res.success) {
        setMessage(`Organization "${organization.name}" has been suspended.`);
        fetchOrg();
      }
    } catch (err) {
      setError(err.message || 'Failed to suspend organization');
    }
  }

  async function handleRevoke() {
    const reason = prompt('Enter revocation reason (irreversible accreditation revocation):', 'Revocation of accreditation');
    if (!reason) return;
    setError('');
    setMessage('');
    try {
      const res = await api.organizations.revoke(organization.organizationId, reason);
      if (res && res.success) {
        setMessage(`Organization "${organization.name}" accreditation revoked.`);
        fetchOrg();
      }
    } catch (err) {
      setError(err.message || 'Failed to revoke organization');
    }
  }

  // Issuer actions
  async function handleApproveIssuer(issuerId) {
    if (!confirm(`Approve issuer ${issuerId}?`)) return;
    try {
      const res = await api.issuers.approve(issuerId);
      if (res && res.success) {
        setMessage(`Issuer ${issuerId} approved.`);
        loadRelatedResources(organization);
      }
    } catch (err) {
      setError(err.message || 'Failed to approve issuer');
    }
  }

  async function handleSuspendIssuer(issuerId) {
    const reason = prompt('Enter suspension reason:', 'Issuer compliance audit pending');
    if (!reason) return;
    try {
      const res = await api.issuers.suspend(issuerId, reason);
      if (res && res.success) {
        setMessage(`Issuer ${issuerId} suspended.`);
        loadRelatedResources(organization);
      }
    } catch (err) {
      setError(err.message || 'Failed to suspend issuer');
    }
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Building },
    { id: 'issuers', label: `Issuers (${issuers.length})`, icon: FileBadge },
    { id: 'sources', label: `Trusted Sources (${trustedSources.length})`, icon: Link2 },
    { id: 'audit', label: 'Audit Trail', icon: Clock },
  ];

  if (loading) {
    return (
      <div className="page-content">
        <div className="glass-card" style={{ padding: '3rem', textAlign: 'center' }}>
          <RefreshCw size={28} className="pulse-dot" style={{ margin: '0 auto 1rem', display: 'block' }} />
          <p className="text-muted">Loading organization specifications & institutional trust details...</p>
        </div>
      </div>
    );
  }

  if (error && !organization) {
    return (
      <div className="page-content">
        <div className="glass-card" style={{ padding: '3rem', textAlign: 'center' }}>
          <AlertTriangle size={36} style={{ color: 'var(--accent-red)', margin: '0 auto 1rem', display: 'block' }} />
          <h3>Organization Not Found</h3>
          <p className="text-muted" style={{ margin: '0.5rem 0 1.5rem' }}>
            {error || `Unable to locate organization with ID: ${organizationId}`}
          </p>
          <button className="action-btn secondary text-xs" onClick={() => navigate('/admin/organizations')}>
            <ArrowLeft size={14} /> Back to Organizations
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content">
      {/* Admin Flow Breadcrumbs */}
      <div className="glass-card" style={{ padding: '0.75rem 1.25rem', marginBottom: '1.25rem', background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(139, 92, 246, 0.25)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap', fontSize: '0.8rem' }}>
          <span className="text-muted" style={{ fontWeight: 700 }}>ADMIN FLOW:</span>
          <span style={{ cursor: 'pointer', color: 'var(--accent-purple)' }} onClick={() => navigate('/dashboard')}>Admin Dashboard</span>
          <span className="text-muted">→</span>
          <span style={{ cursor: 'pointer', color: 'var(--accent-cyan)' }} onClick={() => navigate('/admin/organizations')}>Organizations Registry</span>
          <span className="text-muted">→</span>
          <strong style={{ color: 'var(--accent-blue)', textDecoration: 'underline' }}>{organization.name} (Manage)</strong>
        </div>
      </div>

      {/* Header Banner */}
      <div className="page-header" style={{ marginBottom: '1.25rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.35rem' }}>
            <button 
              className="action-btn secondary text-xs" 
              onClick={() => navigate('/admin/organizations')}
              style={{ padding: '0.35rem 0.6rem' }}
              title="Back to Organizations"
            >
              <ArrowLeft size={14} /> Back
            </button>
            <h2 style={{ margin: 0 }}>{organization.name}</h2>
            <StatusBadge status={organization.organizationVerificationStatus} />
            <span className="badge-tag">{organization.type}</span>
          </div>
          <p className="page-subtitle" style={{ margin: 0 }}>
            Identifier: <code className="code-snippet">{organization.organizationId}</code> • Domain: <strong style={{ color: 'var(--text-primary)' }}>{organization.officialDomain}</strong>
          </p>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button className="action-btn secondary text-xs" onClick={fetchOrg} disabled={loading}>
            <RefreshCw size={13} className={loading ? 'pulse-dot' : ''} /> Refresh
          </button>
          {organization.organizationVerificationStatus !== 'VERIFIED' && organization.organizationVerificationStatus !== 'REVOKED' && (
            <button className="action-btn primary text-xs" onClick={handleVerify}>
              <ShieldCheck size={13} /> Verify & Accredit
            </button>
          )}
          {organization.organizationVerificationStatus === 'VERIFIED' && (
            <button className="action-btn secondary text-xs" onClick={handleSuspend}>
              <AlertTriangle size={13} /> Suspend Trust
            </button>
          )}
          {organization.organizationVerificationStatus !== 'REVOKED' && (
            <button className="action-btn danger text-xs" onClick={handleRevoke}>
              <ShieldAlert size={13} /> Revoke
            </button>
          )}
        </div>
      </div>

      {/* Alert Messages */}
      {message && (
        <div className="alert-banner success" style={{ marginBottom: '1rem' }}>
          <CheckCircle2 size={16} />
          <span>{message}</span>
        </div>
      )}

      {error && (
        <div className="alert-banner danger" style={{ marginBottom: '1rem' }}>
          <AlertTriangle size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.25rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '0.5rem' }}>
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              className={`action-btn ${isActive ? 'primary' : 'secondary'} text-xs`}
              onClick={() => setActiveTab(tab.id)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <Icon size={14} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 1: Overview */}
      {activeTab === 'overview' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Key Metric Highlights */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
            <div className="glass-card" style={{ padding: '1rem' }}>
              <div className="text-muted" style={{ fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Trust Status</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <StatusBadge status={organization.organizationVerificationStatus} />
                <span style={{ fontSize: '0.85rem' }}>{organization.status || 'ACTIVE'}</span>
              </div>
            </div>
            <div className="glass-card" style={{ padding: '1rem' }}>
              <div className="text-muted" style={{ fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Domain Authority</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600 }}>
                <Globe size={16} style={{ color: 'var(--accent-cyan)' }} />
                <span>{organization.officialDomain}</span>
              </div>
            </div>
            <div className="glass-card" style={{ padding: '1rem' }}>
              <div className="text-muted" style={{ fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Associated Issuers</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, fontSize: '1.1rem' }}>
                <FileBadge size={16} style={{ color: 'var(--accent-purple)' }} />
                <span>{issuers.length} Accredited</span>
              </div>
            </div>
            <div className="glass-card" style={{ padding: '1rem' }}>
              <div className="text-muted" style={{ fontSize: '0.75rem', textTransform: 'uppercase', marginBottom: '0.25rem' }}>Verification Sources</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 600, fontSize: '1.1rem' }}>
                <Link2 size={16} style={{ color: '#10b981' }} />
                <span>{trustedSources.length} Registered</span>
              </div>
            </div>
          </div>

          {/* Detailed Specifications */}
          <div className="glass-card" style={{ padding: '1.5rem' }}>
            <h3 style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Building size={18} style={{ color: 'var(--accent-blue)' }} /> Institutional Profile & Trust Specifications
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.25rem' }}>
              <div>
                <span className="text-muted" style={{ fontSize: '0.8rem', display: 'block' }}>Organization ID</span>
                <span className="code-snippet">{organization.organizationId}</span>
              </div>
              <div>
                <span className="text-muted" style={{ fontSize: '0.8rem', display: 'block' }}>Organization Code</span>
                <strong>{organization.organizationCode || organization.code || 'N/A'}</strong>
              </div>
              <div>
                <span className="text-muted" style={{ fontSize: '0.8rem', display: 'block' }}>Institution Name</span>
                <strong>{organization.name}</strong>
              </div>
              <div>
                <span className="text-muted" style={{ fontSize: '0.8rem', display: 'block' }}>Entity Classification</span>
                <span className="badge-tag">{organization.type}</span>
              </div>
              <div>
                <span className="text-muted" style={{ fontSize: '0.8rem', display: 'block' }}>Official Domain</span>
                <a 
                  href={`https://${organization.officialDomain}`} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  style={{ color: 'var(--accent-blue)', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', textDecoration: 'none' }}
                >
                  {organization.officialDomain} <ExternalLink size={12} />
                </a>
              </div>
              <div>
                <span className="text-muted" style={{ fontSize: '0.8rem', display: 'block' }}>Trust Accreditation Status</span>
                <StatusBadge status={organization.organizationVerificationStatus} />
              </div>
              <div>
                <span className="text-muted" style={{ fontSize: '0.8rem', display: 'block' }}>Verification Method</span>
                <span>{Array.isArray(organization.verificationMethods) ? organization.verificationMethods.join(', ') : (organization.verificationMethods || 'ADMIN_REVIEW')}</span>
              </div>
              <div>
                <span className="text-muted" style={{ fontSize: '0.8rem', display: 'block' }}>Verified By</span>
                <span>{organization.verifiedBy || 'System Administrator'}</span>
              </div>
              <div>
                <span className="text-muted" style={{ fontSize: '0.8rem', display: 'block' }}>Verification Timestamp</span>
                <span>{organization.verifiedAt ? new Date(organization.verifiedAt).toLocaleString() : 'N/A'}</span>
              </div>
              <div>
                <span className="text-muted" style={{ fontSize: '0.8rem', display: 'block' }}>Lifecycle Status</span>
                <span style={{ fontWeight: 600 }}>{organization.status || 'ACTIVE'}</span>
              </div>
              <div>
                <span className="text-muted" style={{ fontSize: '0.8rem', display: 'block' }}>Created At</span>
                <span>{organization.createdAt ? new Date(organization.createdAt).toLocaleString() : 'N/A'}</span>
              </div>
              <div>
                <span className="text-muted" style={{ fontSize: '0.8rem', display: 'block' }}>Last Updated</span>
                <span>{organization.updatedAt ? new Date(organization.updatedAt).toLocaleString() : 'N/A'}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Issuers */}
      {activeTab === 'issuers' && (
        <div className="glass-card table-container">
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0 }}>Accredited Issuers for {organization.name}</h3>
              <p className="text-muted" style={{ margin: 0, fontSize: '0.8rem' }}>Credential-issuing authorities operating under this institutional trust anchor.</p>
            </div>
            <button className="action-btn secondary text-xs" onClick={() => navigate('/admin/issuers')}>
              Go to Issuers Management →
            </button>
          </div>
          {loadingResources ? (
            <div className="empty-state">Loading accredited issuers...</div>
          ) : issuers.length === 0 ? (
            <div className="empty-state">
              <FileBadge size={36} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
              <p>No issuers associated with this organization yet.</p>
              <button 
                className="action-btn primary text-xs" 
                style={{ marginTop: '0.75rem' }}
                onClick={() => navigate('/admin/issuers')}
              >
                Register an Issuer for {organization.name}
              </button>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Issuer ID</th>
                  <th>Issuer Code</th>
                  <th>Status</th>
                  <th>Public Key ID</th>
                  <th>Registered</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {issuers.map((issuer) => (
                  <tr key={issuer.issuerId}>
                    <td className="code-snippet">{issuer.issuerId}</td>
                    <td><strong>{issuer.issuerCode}</strong></td>
                    <td><StatusBadge status={issuer.status} /></td>
                    <td className="code-snippet">{issuer.publicKeyId || 'Pending'}</td>
                    <td>{issuer.createdAt ? new Date(issuer.createdAt).toLocaleDateString() : 'N/A'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        {issuer.status !== 'APPROVED' && issuer.status !== 'REVOKED' && (
                          <button
                            className="action-btn primary text-xs"
                            onClick={() => handleApproveIssuer(issuer.issuerId)}
                            style={{ padding: '0.2rem 0.5rem' }}
                          >
                            Approve
                          </button>
                        )}
                        {issuer.status === 'APPROVED' && (
                          <button
                            className="action-btn secondary text-xs"
                            onClick={() => handleSuspendIssuer(issuer.issuerId)}
                            style={{ padding: '0.2rem 0.5rem' }}
                          >
                            Suspend
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Tab 3: Trusted Sources */}
      {activeTab === 'sources' && (
        <div className="glass-card table-container">
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0 }}>Trusted Sources for {organization.name}</h3>
              <p className="text-muted" style={{ margin: 0, fontSize: '0.8rem' }}>Official verification endpoints and external registries bound to this organization.</p>
            </div>
            <button className="action-btn secondary text-xs" onClick={() => navigate('/admin/trusted-sources')}>
              Go to Trusted Sources →
            </button>
          </div>
          {loadingResources ? (
            <div className="empty-state">Loading verification sources...</div>
          ) : trustedSources.length === 0 ? (
            <div className="empty-state">
              <Link2 size={36} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
              <p>No verification sources registered for this organization.</p>
              <button 
                className="action-btn primary text-xs" 
                style={{ marginTop: '0.75rem' }}
                onClick={() => navigate('/admin/trusted-sources')}
              >
                Register Trusted Source
              </button>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Source Code</th>
                  <th>Name</th>
                  <th>Type</th>
                  <th>Base URL</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {trustedSources.map((source) => (
                  <tr key={source.sourceCode || source._id}>
                    <td className="code-snippet">{source.sourceCode}</td>
                    <td><strong>{source.name}</strong></td>
                    <td><span className="badge-tag">{source.sourceType}</span></td>
                    <td style={{ fontSize: '0.8rem' }}>{source.baseUrl}</td>
                    <td><StatusBadge status={source.status || 'ACTIVE'} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Tab 4: Audit Trail */}
      {activeTab === 'audit' && (
        <div className="glass-card table-container">
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ margin: 0 }}>Immutable Audit Trail</h3>
              <p className="text-muted" style={{ margin: 0, fontSize: '0.8rem' }}>Cryptographically hash-chained audit events recording institutional actions.</p>
            </div>
            <button className="action-btn secondary text-xs" onClick={() => navigate('/admin/settings')}>
              View Full Chain →
            </button>
          </div>
          {auditLogs.length === 0 ? (
            <div className="empty-state">
              <Clock size={36} style={{ opacity: 0.3, marginBottom: '0.75rem' }} />
              <p>No recent audit logs available.</p>
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Seq #</th>
                  <th>Action</th>
                  <th>Actor Role</th>
                  <th>Entity Type</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.slice(0, 10).map((log) => (
                  <tr key={log._id || log.sequenceNumber}>
                    <td className="code-snippet">#{log.sequenceNumber}</td>
                    <td><strong>{log.action}</strong></td>
                    <td><span className="badge-tag">{log.actorRole || 'SYSTEM'}</span></td>
                    <td>{log.targetEntityType || 'ORGANIZATION'}</td>
                    <td>{log.createdAt ? new Date(log.createdAt).toLocaleString() : 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}

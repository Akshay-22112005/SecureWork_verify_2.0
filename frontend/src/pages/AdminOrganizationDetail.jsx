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

function parseOrganizationUserCsv(csv) {
  const records = [];
  let row = [];
  let value = '';
  let quoted = false;
  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index];
    if (character === '"') {
      if (quoted && csv[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === ',' && !quoted) {
      row.push(value);
      value = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && csv[index + 1] === '\n') index += 1;
      row.push(value);
      if (row.some((cell) => cell.trim())) records.push(row);
      row = [];
      value = '';
    } else {
      value += character;
    }
  }
  if (quoted) return { rows: [], error: 'CSV contains an unterminated quoted field.' };
  row.push(value);
  if (row.some((cell) => cell.trim())) records.push(row);
  if (!records.length) return { rows: [], error: '' };

  const headers = records[0].map((header, index) => (index === 0 ? header.replace(/^\uFEFF/, '') : header).trim().toLowerCase());
  const nameIndex = headers.indexOf('name');
  const emailIndex = headers.indexOf('email');
  const roleIndex = headers.indexOf('role');
  if (nameIndex < 0 || emailIndex < 0) return { rows: [], error: 'CSV headers must include name and email.' };
  return {
    rows: records.slice(1).map((cells) => ({
      name: cells[nameIndex] || '',
      email: cells[emailIndex] || '',
      role: roleIndex >= 0 ? (cells[roleIndex] || 'ISSUER') : 'ISSUER'
    })),
    error: ''
  };
}

export default function AdminOrganizationDetail({ onNavigate }) {
  const { organizationId } = useParams();
  const navigate = useNavigate();

  const [organization, setOrganization] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [showRegisterModal, setShowRegisterModal] = useState(false);
  const [issuerEmail, setIssuerEmail] = useState('');
  const [verifiedUser, setVerifiedUser] = useState(null);
  const [verifyingUser, setVerifyingUser] = useState(false);
  const [registeringIssuer, setRegisteringIssuer] = useState(false);
  const [modalError, setModalError] = useState('');
  const [organizationUsers, setOrganizationUsers] = useState([]);
  const [loadingOrganizationUsers, setLoadingOrganizationUsers] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [showAssignUserModal, setShowAssignUserModal] = useState(false);
  const [assignUserEmail, setAssignUserEmail] = useState('');
  const [assignUserRole, setAssignUserRole] = useState('ISSUER');
  const [unassignedUsers, setUnassignedUsers] = useState([]);
  const [searchingUnassignedUsers, setSearchingUnassignedUsers] = useState(false);
  const [assignUserError, setAssignUserError] = useState('');
  const [inviteEmailNotFound, setInviteEmailNotFound] = useState(false);
  const [showBulkUploadModal, setShowBulkUploadModal] = useState(false);
  const [showTrustedSourceModal, setShowTrustedSourceModal] = useState(false);
  const [trustedSourceName, setTrustedSourceName] = useState('');
  const [trustedSourceType, setTrustedSourceType] = useState('DID_DOCUMENT');
  const [trustedSourceUrl, setTrustedSourceUrl] = useState('');
  const [registeringTrustedSource, setRegisteringTrustedSource] = useState(false);
  const [trustedSourceError, setTrustedSourceError] = useState('');
  const [verifyingTrustedSource, setVerifyingTrustedSource] = useState('');
  const [issuerAction, setIssuerAction] = useState('');
  const [bulkCsvText, setBulkCsvText] = useState('');
  const [bulkRows, setBulkRows] = useState([]);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkError, setBulkError] = useState('');
  const [bulkSummary, setBulkSummary] = useState(null);

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

  async function fetchOrganizationUsers() {
    if (!organization) return;
    setLoadingOrganizationUsers(true);
    try {
      const res = await api.admin.getOrganizationUsers(organization.organizationId);
      setOrganizationUsers(res?.data?.users || res?.users || []);
    } catch (err) {
      setError(err.message || 'Failed to load organization users');
    } finally {
      setLoadingOrganizationUsers(false);
    }
  }

  useEffect(() => {
    if (activeTab === 'rbac' && organization) fetchOrganizationUsers();
  }, [activeTab, organization?.organizationId]);

  async function searchUnassignedUsers() {
    const email = assignUserEmail.trim();
    if (!email) {
      setAssignUserError('Enter an email address to search.');
      return;
    }
    setAssignUserError('');
    setInviteEmailNotFound(false);
    setSearchingUnassignedUsers(true);
    try {
      const res = await api.admin.searchOrganizationUser(organization.organizationId, email);
      const result = res?.data || res;
      if (!result?.found) {
        setUnassignedUsers([]);
        setInviteEmailNotFound(true);
      } else if (!result.available) {
        setUnassignedUsers([]);
        setAssignUserError(result.message || 'This account is already assigned to another organization.');
      } else {
        setUnassignedUsers(result.user ? [result.user] : []);
      }
    } catch (err) {
      setAssignUserError(err.message || 'Unable to search users.');
    } finally {
      setSearchingUnassignedUsers(false);
    }
  }

  async function handleAssignOrganizationUser(user) {
    try {
      await api.admin.assignUserToOrganization(organization.organizationId, user.userId || user.id || user._id, assignUserRole);
      setMessage(`${user.name} was assigned to ${organization.name} as ${assignUserRole}.`);
      closeAssignUserModal();
      await fetchOrganizationUsers();
    } catch (err) {
      setAssignUserError(err.message || 'Failed to assign user.');
    }
  }

  function closeAssignUserModal() {
    setShowAssignUserModal(false);
    setAssignUserEmail('');
    setUnassignedUsers([]);
    setAssignUserError('');
    setInviteEmailNotFound(false);
    setAssignUserRole('ISSUER');
  }

  async function handleInviteOrganizationUser() {
    const email = assignUserEmail.trim();
    if (!email) return;
    try {
      await api.admin.inviteUserToOrganization(organization.organizationId, { email, role: assignUserRole });
      setMessage(`Invitation dispatched to ${email}!`);
      closeAssignUserModal();
      await fetchOrganizationUsers();
    } catch (err) {
      setAssignUserError(err.message || 'Failed to send organization invitation.');
    }
  }

  async function handleOrganizationUserRoleChange(user, role) {
    try {
      await api.admin.assignUserToOrganization(organization.organizationId, user.userId || user.id || user._id, role);
      await fetchOrganizationUsers();
      setMessage(`${user.name}'s organization role was updated to ${role}.`);
    } catch (err) {
      setError(err.message || 'Failed to update organization role');
    }
  }

  async function handleRevokeOrganizationUser(user) {
    if (!confirm(`Revoke ${user.name}'s access to ${organization.name}?`)) return;
    try {
      await api.admin.removeUserFromOrganization(organization.organizationId, user.userId || user.id || user._id);
      setOrganizationUsers((current) => current.filter((entry) => String(entry._id || entry.id) !== String(user._id || user.id)));
      setMessage(`${user.name}'s access to ${organization.name} was revoked.`);
    } catch (err) {
      setError(err.message || 'Failed to revoke organization access');
    }
  }

  async function handleResendInvite(user) {
    try {
      await api.admin.resendUserInvitation(organization.organizationId, user.userId || user.id || user._id);
      setMessage(`Invitation resent to ${user.email}.`);
    } catch (err) {
      setError(err.message || 'Failed to resend organization invitation');
    }
  }

  function updateBulkCsv(text) {
    setBulkCsvText(text);
    const parsed = parseOrganizationUserCsv(text);
    setBulkRows(parsed.rows);
    setBulkError(parsed.error);
    setBulkSummary(null);
  }

  async function handleBulkCsvFile(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setBulkError('Choose a .csv file.');
      return;
    }
    updateBulkCsv(await file.text());
  }

  function downloadOrganizationUsersSample() {
    const blob = new Blob(['name,email,role\nJane Doe,jane@example.com,ISSUER\nAlex Smith,alex@example.com,MEMBER\n'], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'organization_users_sample.csv';
    link.click();
    URL.revokeObjectURL(url);
  }

  async function handleBulkUpload() {
    if (bulkError) return;
    if (!bulkRows.length) {
      setBulkError('Paste CSV data or choose a CSV file first.');
      return;
    }
    setBulkLoading(true);
    setBulkError('');
    setBulkSummary(null);
    try {
      const response = await api.admin.bulkUploadOrganizationUsers(organization.organizationId, bulkRows);
      const summary = response?.data || response;
      setBulkSummary(summary);
      setMessage(`${summary.successCount || 0} Users Imported / ${summary.invitedCount || 0} Pending Invites Sent`);
      await fetchOrganizationUsers();
    } catch (err) {
      setBulkError(err.message || 'Bulk user upload failed.');
    } finally {
      setBulkLoading(false);
    }
  }

  async function handleRegisterTrustedSource(event) {
    event.preventDefault();
    setTrustedSourceError('');
    setRegisteringTrustedSource(true);
    try {
      await api.admin.registerOrganizationSource(organization.organizationId, {
        organizationId: organization.organizationId,
        name: trustedSourceName.trim(),
        sourceType: trustedSourceType,
        baseUrl: trustedSourceUrl.trim()
      });
      setMessage(`Trusted source registered for ${organization.name}. It is pending verification.`);
      setTrustedSourceName('');
      setTrustedSourceType('DID_DOCUMENT');
      setTrustedSourceUrl('');
      setShowTrustedSourceModal(false);
      await loadRelatedResources(organization);
    } catch (err) {
      setTrustedSourceError(err.message || 'Failed to register trusted source.');
    } finally {
      setRegisteringTrustedSource(false);
    }
  }

  async function handleVerifyTrustedSource(source) {
    const sourceId = source._id || source.sourceCode;
    setVerifyingTrustedSource(sourceId);
    setError('');
    try {
      await api.admin.verifyOrganizationSource(organization.organizationId, sourceId);
      setMessage(`Trusted source "${source.name}" is now active.`);
      await loadRelatedResources(organization);
    } catch (err) {
      setError(err.message || 'Failed to verify trusted source.');
    } finally {
      setVerifyingTrustedSource('');
    }
  }

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

  async function runOrganizationIssuerAction(issuer, action) {
    const key = `${issuer.issuerId}:${action}`;
    if (action === 'revoke' && !confirm(`Revoke issuer ${issuer.issuerId}?`)) return;
    const reason = action === 'suspend' ? prompt('Enter suspension reason:', 'Issuer compliance audit pending') : undefined;
    if (action === 'suspend' && !reason) return;
    setIssuerAction(key);
    setError('');
    try {
      if (action === 'approve') await api.admin.approveOrganizationIssuer(organization.organizationId, issuer.issuerId);
      if (action === 'suspend') await api.admin.suspendOrganizationIssuer(organization.organizationId, issuer.issuerId, reason);
      if (action === 'revoke') await api.admin.revokeOrganizationIssuer(organization.organizationId, issuer.issuerId);
      const actionLabel = action === 'approve' ? 'activated' : action === 'suspend' ? 'suspended' : 'revoked';
      setMessage(`Issuer ${issuer.issuerId} ${actionLabel}.`);
      await loadRelatedResources(organization);
    } catch (err) {
      setError(err.message || `Failed to ${action} issuer.`);
    } finally {
      setIssuerAction('');
    }
  }

  async function handleVerifyUser() {
    setModalError('');
    setVerifiedUser(null);
    const email = issuerEmail.trim();
    if (!email) {
      setModalError('Enter an email address to verify.');
      return;
    }
    setVerifyingUser(true);
    try {
      const res = await api.issuers.lookupRecipient(email);
      const result = res?.data || res;
      if (!result?.found || !result?.recipient) {
        setModalError('User not found. Ensure the user has registered an account first.');
        return;
      }
      setVerifiedUser(result.recipient);
    } catch (err) {
      setModalError(err.message || 'Unable to verify this user.');
    } finally {
      setVerifyingUser(false);
    }
  }

  async function handleConfirmRegisterIssuer() {
    if (!organization || !verifiedUser) return;
    setModalError('');
    setRegisteringIssuer(true);
    try {
      const code = `ISS_${(organization.organizationCode || organization.organizationId).replace(/[^A-Z0-9]/gi, '_').toUpperCase()}_${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
      const res = await api.admin.registerOrganizationIssuer(organization.organizationId, {
        userId: verifiedUser.userId,
        issuerCode: code
      });
      const issuer = res?.data?.issuer || res?.issuer;
      if (!issuer?.issuerId) throw new Error('Issuer registration did not return an issuer ID.');
      setShowRegisterModal(false);
      setIssuerEmail('');
      setVerifiedUser(null);
      setMessage(`Issuer registered successfully for ${organization.name}`);
      await loadRelatedResources(organization);
    } catch (err) {
      setModalError(err.message || 'Failed to register issuer.');
    } finally {
      setRegisteringIssuer(false);
    }
  }

  function openRegisterModal() {
    setIssuerEmail('');
    setVerifiedUser(null);
    setModalError('');
    setShowRegisterModal(true);
  }

  const tabs = [
    { id: 'overview', label: 'Overview', icon: Building },
    { id: 'issuers', label: `Issuers (${issuers.length})`, icon: FileBadge },
    { id: 'rbac', label: 'RBAC & Users', icon: Users },
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
        <div className="flex items-center space-x-3" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button className="action-btn secondary text-xs" onClick={fetchOrg} disabled={loading} style={{ minHeight: '36px', height: '36px', padding: '0 0.75rem', borderRadius: '0.5rem', boxSizing: 'border-box', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', whiteSpace: 'nowrap' }}>
            <RefreshCw size={13} className={loading ? 'pulse-dot' : ''} /> Refresh
          </button>
          {organization.organizationVerificationStatus !== 'VERIFIED' && organization.organizationVerificationStatus !== 'REVOKED' && (
            <button className="action-btn primary text-xs" onClick={handleVerify} style={{ minHeight: '36px', height: '36px', padding: '0 0.75rem', borderRadius: '0.5rem', boxSizing: 'border-box', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', whiteSpace: 'nowrap' }}>
              <ShieldCheck size={13} /> Verify & Accredit
            </button>
          )}
          {organization.organizationVerificationStatus === 'VERIFIED' && (
            <button className="action-btn secondary text-xs" onClick={handleSuspend} style={{ minHeight: '36px', height: '36px', padding: '0 0.75rem', borderRadius: '0.5rem', boxSizing: 'border-box', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', whiteSpace: 'nowrap' }}>
              <AlertTriangle size={13} /> Suspend Trust
            </button>
          )}
          {organization.organizationVerificationStatus !== 'REVOKED' && (
            <button className="action-btn danger text-xs" onClick={handleRevoke} style={{ minHeight: '36px', height: '36px', padding: '0 0.75rem', borderRadius: '0.5rem', boxSizing: 'border-box', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', whiteSpace: 'nowrap' }}>
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
            <button className="action-btn primary text-xs" onClick={openRegisterModal}>
              + Register Issuer
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
                onClick={openRegisterModal}
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
                    <td>
                      {issuer.publicKeyId ? (
                        <span className="code-snippet">{issuer.publicKeyId}</span>
                      ) : (
                        <span className="badge-tag" style={{ color: '#fbbf24', borderColor: 'rgba(251, 191, 36, 0.35)', background: 'rgba(251, 191, 36, 0.08)' }}>
                          Pending Key Generation
                        </span>
                      )}
                    </td>
                    <td>{issuer.createdAt ? new Date(issuer.createdAt).toLocaleDateString() : 'N/A'}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.4rem' }}>
                        {issuer.status === 'PENDING' && (
                          <button
                            className="action-btn primary text-xs"
                            onClick={() => runOrganizationIssuerAction(issuer, 'approve')}
                            disabled={issuerAction === `${issuer.issuerId}:approve`}
                            style={{ padding: '0.2rem 0.5rem' }}
                          >
                            {issuerAction === `${issuer.issuerId}:approve` ? 'Approving…' : 'Approve'}
                          </button>
                        )}
                        {(issuer.status === 'ACTIVE' || issuer.status === 'APPROVED') && (
                          <button
                            className="action-btn secondary text-xs"
                            onClick={() => runOrganizationIssuerAction(issuer, 'suspend')}
                            disabled={issuerAction === `${issuer.issuerId}:suspend`}
                            style={{ padding: '0.2rem 0.5rem' }}
                          >
                            {issuerAction === `${issuer.issuerId}:suspend` ? 'Suspending…' : 'Suspend'}
                          </button>
                        )}
                        {(issuer.status === 'ACTIVE' || issuer.status === 'APPROVED') && (
                          <button className="action-btn danger text-xs" onClick={() => runOrganizationIssuerAction(issuer, 'revoke')} disabled={issuerAction === `${issuer.issuerId}:revoke`} style={{ padding: '0.2rem 0.5rem' }}>
                            {issuerAction === `${issuer.issuerId}:revoke` ? 'Revoking…' : 'Revoke'}
                          </button>
                        )}
                        {issuer.status === 'SUSPENDED' && (
                          <button className="action-btn primary text-xs" onClick={() => runOrganizationIssuerAction(issuer, 'approve')} disabled={issuerAction === `${issuer.issuerId}:approve`} style={{ padding: '0.2rem 0.5rem' }}>
                            {issuerAction === `${issuer.issuerId}:approve` ? 'Activating…' : 'Activate'}
                          </button>
                        )}
                        {issuer.status === 'REVOKED' && <span className="text-muted text-xs">Revoked</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'rbac' && (
        <div className="glass-card table-container">
          <div style={{ padding: '1rem 1.25rem', borderBottom: '1px solid var(--border-color)' }}>
            <h3 style={{ margin: 0 }}>Organization User Directory &amp; Access Control</h3>
            <p className="text-muted" style={{ margin: '0.25rem 0 0', fontSize: '0.8rem' }}>
              Manage organization membership and role-based access for {organization.name}.
            </p>
          </div>
          <div className="flex items-center justify-between gap-4 w-full" style={{ padding: '1rem 1.25rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', width: '100%', flexWrap: 'wrap', borderBottom: '1px solid var(--border-color)' }}>
            <input
              type="search"
              className="form-input"
              value={userSearch}
              onChange={(event) => setUserSearch(event.target.value)}
              placeholder="Search by name or email"
              aria-label="Search organization users by name or email"
              style={{ maxWidth: '360px', minWidth: '220px' }}
            />
            <div className="flex items-center space-x-3 ml-auto" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginLeft: 'auto' }}>
              <button
                className="action-btn primary text-xs"
                onClick={() => { setAssignUserError(''); setInviteEmailNotFound(false); setUnassignedUsers([]); setAssignUserEmail(''); setShowAssignUserModal(true); }}
              >
                + Assign User to Org
              </button>
              <button
                className="action-btn secondary text-xs"
                onClick={() => { setBulkCsvText(''); setBulkRows([]); setBulkError(''); setBulkSummary(null); setShowBulkUploadModal(true); }}
              >
                + Bulk CSV Upload
              </button>
            </div>
          </div>
          {loadingOrganizationUsers ? (
            <div className="empty-state">Loading organization users...</div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>USER ID</th><th>NAME</th><th>EMAIL</th><th>ROLE</th><th>STATUS</th><th>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {organizationUsers
                  .filter((user) => `${user.name || ''} ${user.email || ''}`.toLowerCase().includes(userSearch.trim().toLowerCase()))
                  .map((user) => (
                    <tr key={user._id || user.id || user.userId}>
                      <td className="code-snippet">{user.userId || user._id || user.id}</td>
                      <td><strong>{user.name}</strong></td>
                      <td>{user.email}</td>
                      <td><span className="badge-tag" style={{ color: user.role === 'ISSUER' ? 'var(--accent-purple)' : 'var(--accent-cyan)', borderColor: 'rgba(139, 92, 246, 0.35)' }}>{user.role}</span></td>
                      <td>
                        {user.status === 'PENDING_INVITE' ? (
                          <span className="badge-tag" style={{ color: '#fbbf24', borderColor: 'rgba(251, 191, 36, 0.4)' }}>Pending Invite</span>
                        ) : (
                          <span className="badge-tag" style={{ color: user.status === 'ACTIVE' ? 'var(--accent-emerald)' : 'var(--accent-purple)' }}>{user.status || 'PENDING'}</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
                          <select
                            className="form-select text-xs"
                            aria-label={`Change ${user.name}'s organization role`}
                            value={user.role}
                            onChange={(event) => handleOrganizationUserRoleChange(user, event.target.value)}
                            style={{ padding: '0.25rem 0.4rem', width: 'auto', minWidth: '105px' }}
                          >
                            {!['ISSUER', 'MEMBER'].includes(user.role) && <option value={user.role}>{user.role}</option>}
                            <option value="ISSUER">ISSUER</option>
                            <option value="MEMBER">MEMBER</option>
                          </select>
                          <button className="action-btn danger text-xs" onClick={() => handleRevokeOrganizationUser(user)} style={{ padding: '0.25rem 0.5rem' }}>
                            Revoke Org Access
                          </button>
                          {user.status === 'PENDING_INVITE' && (
                            <button className="action-btn secondary text-xs" onClick={() => handleResendInvite(user)} style={{ padding: '0.25rem 0.5rem', color: '#fbbf24', borderColor: 'rgba(251, 191, 36, 0.4)' }}>
                              Resend Invite
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                {organizationUsers.length === 0 && (
                  <tr><td colSpan="6" className="text-muted" style={{ textAlign: 'center', padding: '1.5rem' }}>No users are assigned to this organization yet.</td></tr>
                )}
                {organizationUsers.length > 0 && organizationUsers.filter((user) => `${user.name || ''} ${user.email || ''}`.toLowerCase().includes(userSearch.trim().toLowerCase())).length === 0 && (
                  <tr><td colSpan="6" className="text-muted" style={{ textAlign: 'center', padding: '1.5rem' }}>No users match your search.</td></tr>
                )}
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
            <button className="action-btn primary text-xs" onClick={() => { setTrustedSourceError(''); setShowTrustedSourceModal(true); }}>
              + Register Trusted Source
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
                onClick={() => { setTrustedSourceError(''); setShowTrustedSourceModal(true); }}
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
                  <th>Actions</th>
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
                    <td>
                      {source.status === 'PENDING' ? (
                        <button
                          type="button"
                          className="action-btn primary text-xs"
                          onClick={() => handleVerifyTrustedSource(source)}
                          disabled={verifyingTrustedSource === (source._id || source.sourceCode)}
                        >
                          {verifyingTrustedSource === (source._id || source.sourceCode) ? 'Verifying…' : 'Verify & Activate'}
                        </button>
                      ) : source.status === 'ACTIVE' ? (
                        <span className="text-xs" style={{ color: '#34d399', fontWeight: 600 }}>Active</span>
                      ) : <span className="text-muted text-xs">—</span>}
                    </td>
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

      {showRegisterModal && (
        <div role="presentation" onClick={(event) => { if (event.target === event.currentTarget && !registeringIssuer) setShowRegisterModal(false); }} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.68)', display: 'grid', placeItems: 'center', padding: '1rem' }}>
          <section role="dialog" aria-modal="true" aria-labelledby="register-issuer-title" className="glass-card" style={{ width: 'min(100%, 520px)', padding: '1.5rem', boxShadow: '0 20px 70px rgba(0,0,0,0.45)' }}>
            <h2 id="register-issuer-title" style={{ marginTop: 0 }}>Register Issuer for {organization.name}</h2>
            <div style={{ display: 'grid', gap: '0.3rem', marginBottom: '1rem' }}>
              <label className="text-muted" htmlFor="issuer-organization-id">Organization</label>
              <input id="issuer-organization-id" value={`${organization.name} (${organization.organizationId})`} readOnly className="form-input" />
            </div>
            <label className="text-muted" htmlFor="issuer-email">User email</label>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.35rem' }}>
              <input id="issuer-email" type="email" value={issuerEmail} onChange={(event) => { setIssuerEmail(event.target.value); setVerifiedUser(null); setModalError(''); }} placeholder="name@example.com" className="form-input" style={{ flex: 1, minWidth: 0 }} disabled={registeringIssuer} />
              <button type="button" className="action-btn secondary text-xs" onClick={handleVerifyUser} disabled={verifyingUser || registeringIssuer || !issuerEmail.trim()}>{verifyingUser ? 'Verifying…' : 'Verify Email'}</button>
            </div>
            {verifiedUser && (
              <div className="glass-card" style={{ padding: '0.85rem', marginTop: '1rem', borderColor: 'rgba(16,185,129,0.5)' }}>
                <strong style={{ display: 'block' }}>{verifiedUser.name}</strong>
                <span>{verifiedUser.email}</span>
                <div className="text-muted" style={{ marginTop: '0.25rem' }}>Current role: {verifiedUser.role || 'USER'}</div>
              </div>
            )}
            {modalError && <div role="alert" className="alert-banner danger" style={{ marginTop: '1rem' }}><AlertTriangle size={16} /><span>{modalError}</span></div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem' }}>
              <button type="button" className="action-btn secondary text-xs" onClick={() => setShowRegisterModal(false)} disabled={registeringIssuer}>Cancel</button>
              <button type="button" className="action-btn primary text-xs" onClick={handleConfirmRegisterIssuer} disabled={!verifiedUser || registeringIssuer}>{registeringIssuer ? 'Registering…' : 'Confirm & Bind Issuer'}</button>
            </div>
          </section>
        </div>
      )}

      {showAssignUserModal && (
        <div role="presentation" onClick={(event) => { if (event.target === event.currentTarget && !searchingUnassignedUsers) closeAssignUserModal(); }} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.68)', display: 'grid', placeItems: 'center', padding: '1rem' }}>
          <section role="dialog" aria-modal="true" aria-labelledby="assign-organization-user-title" className="glass-card" style={{ width: 'min(100%, 560px)', maxHeight: '85vh', overflowY: 'auto', padding: '1.5rem', boxShadow: '0 20px 70px rgba(0,0,0,0.45)' }}>
            <h2 id="assign-organization-user-title" style={{ marginTop: 0 }}>Assign User to {organization.name}</h2>
            <label className="text-muted" htmlFor="assign-user-email">Search unassigned users by email</label>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.35rem' }}>
              <input id="assign-user-email" type="email" className="form-input" value={assignUserEmail} onChange={(event) => { setAssignUserEmail(event.target.value); setInviteEmailNotFound(false); setUnassignedUsers([]); setAssignUserError(''); }} onKeyDown={(event) => { if (event.key === 'Enter') searchUnassignedUsers(); }} placeholder="name@example.com" style={{ flex: 1, minWidth: 0 }} />
              <button type="button" className="action-btn secondary text-xs" onClick={searchUnassignedUsers} disabled={searchingUnassignedUsers}>{searchingUnassignedUsers ? 'Searching…' : 'Search'}</button>
            </div>
            {!inviteEmailNotFound && (
              <>
                <label className="text-muted" htmlFor="assign-user-role" style={{ display: 'block', marginTop: '1rem' }}>Organization role</label>
                <select id="assign-user-role" className="form-select" value={assignUserRole} onChange={(event) => setAssignUserRole(event.target.value)} style={{ marginTop: '0.35rem' }}>
                  <option value="ISSUER">ISSUER</option>
                  <option value="MEMBER">MEMBER</option>
                </select>
              </>
            )}
            {assignUserError && <div role="alert" className="alert-banner danger" style={{ marginTop: '1rem' }}><AlertTriangle size={16} /><span>{assignUserError}</span></div>}
            {inviteEmailNotFound && (
              <div className="glass-card" style={{ padding: '1rem', marginTop: '1rem', border: '1px solid rgba(139, 92, 246, 0.4)', background: 'rgba(139, 92, 246, 0.08)' }}>
                <strong style={{ display: 'block', marginBottom: '0.8rem' }}>No registered account found for {assignUserEmail.trim()}.</strong>
                <label className="text-muted" htmlFor="invite-user-role">Pre-assigned organization role</label>
                <select id="invite-user-role" className="form-select" value={assignUserRole} onChange={(event) => setAssignUserRole(event.target.value)} style={{ marginTop: '0.35rem' }}>
                  <option value="ISSUER">ISSUER</option>
                  <option value="MEMBER">MEMBER</option>
                </select>
                <button type="button" className="action-btn primary text-xs" onClick={handleInviteOrganizationUser} style={{ marginTop: '0.85rem' }}>
                  📧 Send Email Invite &amp; Pre-Bind Account
                </button>
              </div>
            )}
            {unassignedUsers.length > 0 && (
              <div style={{ marginTop: '1rem', display: 'grid', gap: '0.5rem' }}>
                {unassignedUsers.map((user) => (
                  <div key={user.userId || user.id || user._id} className="glass-card" style={{ padding: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap', borderColor: 'rgba(139, 92, 246,  0.25)' }}>
                    <div><strong style={{ display: 'block' }}>{user.name}</strong><span className="text-muted">{user.email}</span></div>
                    <button type="button" className="action-btn primary text-xs" onClick={() => handleAssignOrganizationUser(user)}>Assign</button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
              <button type="button" className="action-btn secondary text-xs" onClick={closeAssignUserModal} disabled={searchingUnassignedUsers}>Close</button>
            </div>
          </section>
        </div>
      )}

      {showBulkUploadModal && (
        <div role="presentation" onClick={(event) => { if (event.target === event.currentTarget && !bulkLoading) setShowBulkUploadModal(false); }} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.68)', display: 'grid', placeItems: 'center', padding: '1rem' }}>
          <section role="dialog" aria-modal="true" aria-labelledby="bulk-organization-users-title" className="glass-card" style={{ width: 'min(100%, 680px)', maxHeight: '88vh', overflowY: 'auto', padding: '1.5rem', boxShadow: '0 20px 70px rgba(0,0,0,0.45)', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
            <h2 id="bulk-organization-users-title" style={{ marginTop: 0 }}>Bulk CSV User Upload</h2>
            <p className="text-muted" style={{ marginTop: '-0.4rem' }}>Import existing accounts and send expiring invitations to new users.</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', margin: '1rem 0' }}>
              <label className="action-btn secondary text-xs" htmlFor="organization-users-csv">Choose CSV File</label>
              <input id="organization-users-csv" type="file" accept=".csv,text/csv" onChange={handleBulkCsvFile} style={{ maxWidth: '100%' }} />
              <button type="button" className="action-btn secondary text-xs" onClick={downloadOrganizationUsersSample}>Download Sample CSV</button>
            </div>
            <label className="text-muted" htmlFor="organization-users-csv-text">Or paste CSV text (`name,email,role`)</label>
            <textarea
              id="organization-users-csv-text"
              className="form-input"
              value={bulkCsvText}
              onChange={(event) => updateBulkCsv(event.target.value)}
              placeholder={'name,email,role\nJane Doe,jane@example.com,ISSUER\nAlex Smith,alex@example.com,MEMBER'}
              rows={7}
              style={{ display: 'block', width: '100%', marginTop: '0.4rem', resize: 'vertical', fontFamily: 'monospace' }}
            />
            <div className="text-muted text-xs" style={{ marginTop: '0.45rem' }}>{bulkRows.length} user row(s) parsed. Roles: ISSUER or MEMBER; omitted roles default to ISSUER.</div>
            {bulkError && <div role="alert" className="alert-banner danger" style={{ marginTop: '1rem' }}><AlertTriangle size={16} /><span>{bulkError}</span></div>}
            {bulkSummary && (
              <div role="status" className="alert-banner success" style={{ marginTop: '1rem', display: 'block' }}>
                <strong>{bulkSummary.successCount} Users Imported / {bulkSummary.invitedCount} Pending Invites Sent</strong>
                <div className="text-xs" style={{ marginTop: '0.25rem' }}>{bulkSummary.existingUpdatedCount} existing accounts updated.</div>
                {bulkSummary.errors?.length > 0 && (
                  <ul className="text-xs" style={{ marginBottom: 0, maxHeight: '100px', overflowY: 'auto' }}>
                    {bulkSummary.errors.map((item, index) => <li key={`${item.row}-${index}`}>Row {item.row}{item.email ? ` (${item.email})` : ''}: {item.message}</li>)}
                  </ul>
                )}
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem', marginTop: '1.25rem' }}>
              <button type="button" className="action-btn secondary text-xs" onClick={() => setShowBulkUploadModal(false)} disabled={bulkLoading}>Close</button>
              <button type="button" className="action-btn primary text-xs" onClick={handleBulkUpload} disabled={bulkLoading || !bulkRows.length || Boolean(bulkError)}>
                {bulkLoading ? 'Importing…' : `Import ${bulkRows.length} User${bulkRows.length === 1 ? '' : 's'}`}
              </button>
            </div>
          </section>
        </div>
      )}

      {showTrustedSourceModal && (
        <div role="presentation" onClick={(event) => { if (event.target === event.currentTarget && !registeringTrustedSource) setShowTrustedSourceModal(false); }} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.68)', display: 'grid', placeItems: 'center', padding: '1rem' }}>
          <form role="dialog" aria-modal="true" aria-labelledby="trusted-source-title" className="glass-card" onSubmit={handleRegisterTrustedSource} style={{ width: 'min(100%, 560px)', padding: '1.5rem', boxShadow: '0 20px 70px rgba(0,0,0,0.45)', border: '1px solid rgba(139, 92, 246, 0.3)' }}>
            <h2 id="trusted-source-title" style={{ marginTop: 0 }}>Register Trusted Source for {organization.name}</h2>
            <p className="text-muted" style={{ marginTop: '-0.4rem' }}>The new source will be scoped to this organization and begin pending verification.</p>
            <label className="text-muted" htmlFor="trusted-source-name">Source Name</label>
            <input id="trusted-source-name" required className="form-input" value={trustedSourceName} onChange={(event) => setTrustedSourceName(event.target.value)} placeholder="Sambhram Primary DID Gateway" style={{ width: '100%', margin: '0.35rem 0 1rem' }} disabled={registeringTrustedSource} />
            <label className="text-muted" htmlFor="trusted-source-type">Source Type</label>
            <select id="trusted-source-type" className="form-select" value={trustedSourceType} onChange={(event) => setTrustedSourceType(event.target.value)} style={{ width: '100%', margin: '0.35rem 0 1rem' }} disabled={registeringTrustedSource}>
              <option value="DID_DOCUMENT">DID_DOCUMENT</option>
              <option value="PUBLIC_KEY_ENDPOINT">PUBLIC_KEY_ENDPOINT</option>
              <option value="OIDC_DISCOVERY">OIDC_DISCOVERY</option>
            </select>
            <label className="text-muted" htmlFor="trusted-source-url">Endpoint URL</label>
            <input id="trusted-source-url" type="url" required className="form-input" value={trustedSourceUrl} onChange={(event) => setTrustedSourceUrl(event.target.value)} placeholder="https://sambhram.edu/.well-known/did.json" style={{ width: '100%', margin: '0.35rem 0 1rem' }} disabled={registeringTrustedSource} />
            <div className="glass-card" style={{ padding: '0.75rem 0.9rem', borderColor: 'rgba(251,191,36,0.35)', marginBottom: '1rem' }}>
              <span className="text-muted">Trust status</span> <span className="text-xs" style={{ color: '#fbbf24', fontWeight: 600, marginLeft: '0.4rem' }}>PENDING VERIFICATION</span>
            </div>
            {trustedSourceError && <div role="alert" className="alert-banner danger" style={{ marginBottom: '1rem' }}><AlertTriangle size={16} /><span>{trustedSourceError}</span></div>}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
              <button type="button" className="action-btn secondary text-xs" onClick={() => setShowTrustedSourceModal(false)} disabled={registeringTrustedSource}>Cancel</button>
              <button type="submit" className="action-btn primary text-xs" disabled={registeringTrustedSource}>{registeringTrustedSource ? 'Registering…' : 'Register Source'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

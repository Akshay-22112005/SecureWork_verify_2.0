import React from 'react';
import { useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  UploadCloud, 
  ShieldCheck, 
  History, 
  Award, 
  FileSearch, 
  Building, 
  Key, 
  Users, 
  Settings, 
  FileSpreadsheet, 
  Link2, 
  FileBadge, 
  CheckSquare, 
  ExternalLink,
  GitCommit,
  X
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Sidebar({ activePage, onNavigate, mobileOpen, onCloseMobile }) {
  const { role, isAdmin, isAuditor, isIssuer, isHr, isUser } = useAuth();
  const location = useLocation();
  const currentPath = location?.pathname || '';

  // Mapping from item ID to path
  const itemPaths = {
    dashboard: '/dashboard',
    verify_document: '/verify',
    upload_document: '/upload',
    my_credentials: '/credentials',
    verification_history: '/history',
    document_analysis: '/analysis',
    issuer_status: '/issuer/status',
    issue_credential: '/credentials/issue',
    credential_list: '/credentials/all',
    key_status: '/keys',
    hr_verify: '/verify',
    verify_source: '/trusted-sources/verify',
    verification_evidence: '/audit/evidence',
    hr_history: '/history',
    audit_logs: '/audit/logs',
    chain_validation: '/audit/chain',
    admin_users: '/admin/users',
    admin_organizations: '/admin/organizations',
    admin_trusted_sources: '/admin/trusted-sources',
    admin_issuers: '/admin/issuers',
    admin_settings: '/admin/settings'
  };

  function handleItemClick(itemId) {
    const targetPath = itemPaths[itemId] || `/${itemId}`;
    if (onNavigate) {
      onNavigate(targetPath);
    }
    if (onCloseMobile) {
      onCloseMobile();
    }
  }

  // Navigation schema organized by category
  const navSections = [
    {
      title: 'General',
      items: [
        { id: 'dashboard', path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'verify_document', path: '/verify', label: 'Public Verification', icon: ShieldCheck }
      ]
    },
    {
      title: 'User / Credential Holder',
      visible: isUser || isAdmin,
      items: [
        { id: 'upload_document', path: '/upload', label: 'Upload Document', icon: UploadCloud },
        { id: 'my_credentials', path: '/credentials', label: 'My Credentials', icon: Award },
        { id: 'verification_history', path: '/history', label: 'Verification History', icon: History },
        { id: 'document_analysis', path: '/analysis', label: 'Document Analysis (OCR/AI)', icon: FileSearch }
      ]
    },
    {
      title: 'Issuer Management',
      visible: isIssuer || isAdmin,
      items: [
        { id: 'issuer_status', path: '/issuer/status', label: 'Issuer Status', icon: FileBadge },
        { id: 'issue_credential', path: '/credentials/issue', label: 'Issue Credential', icon: Award },
        { id: 'credential_list', path: '/credentials/all', label: 'Credential List', icon: FileSpreadsheet },
        { id: 'key_status', path: '/keys', label: 'Cryptographic Key Status', icon: Key }
      ]
    },
    {
      title: 'HR / Verifier',
      visible: isHr || isAdmin,
      items: [
        { id: 'hr_verify', path: '/verify', label: 'HR Verify Document', icon: ShieldCheck },
        { id: 'verify_source', path: '/trusted-sources/verify', label: 'Verify Official Source', icon: ExternalLink },
        { id: 'verification_evidence', path: '/audit/evidence', label: 'Verification Evidence', icon: CheckSquare },
        { id: 'hr_history', path: '/history', label: 'Candidate Verification Logs', icon: History }
      ]
    },
    {
      title: 'Auditor & Compliance',
      visible: isAuditor || isAdmin,
      items: [
        { id: 'audit_logs', path: '/audit/logs', label: 'Hash-Chained Audit Logs', icon: History },
        { id: 'verification_evidence', path: '/audit/evidence', label: 'Verification Evidence', icon: CheckSquare },
        { id: 'chain_validation', path: '/audit/chain', label: 'Audit Chain Validation', icon: GitCommit }
      ]
    },
    {
      title: 'Administration',
      visible: isAdmin,
      items: [
        { id: 'admin_users', path: '/admin/users', label: 'User Directory & RBAC', icon: Users },
        { id: 'admin_organizations', path: '/admin/organizations', label: 'Organizations & Trust', icon: Building },
        { id: 'admin_trusted_sources', path: '/admin/trusted-sources', label: 'Trusted Sources (SSRF Safe)', icon: Link2 },
        { id: 'admin_issuers', path: '/admin/issuers', label: 'Issuer Accreditation', icon: FileBadge },
        { id: 'admin_settings', path: '/admin/settings', label: 'System Health & Settings', icon: Settings }
      ]
    }
  ];

  return (
    <>
      {mobileOpen && (
        <div 
          className="mobile-sidebar-backdrop" 
          onClick={onCloseMobile}
          aria-hidden="true"
        />
      )}
      <aside className={`app-sidebar ${mobileOpen ? 'mobile-open' : ''}`}>
        <div className="sidebar-scroll-wrapper">
          {mobileOpen && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 0.5rem 0.5rem 0.5rem', borderBottom: '1px solid var(--border-subtle)', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>NAVIGATION</span>
              <button 
                className="icon-action-btn" 
                onClick={onCloseMobile}
                style={{ padding: '4px' }}
                aria-label="Close Navigation"
              >
                <X size={18} />
              </button>
            </div>
          )}

          {navSections
            .filter((sec) => sec.visible !== false)
            .map((sec) => (
              <div key={sec.title} className="nav-section">
                <div className="nav-section-title">{sec.title}</div>
                <div className="nav-item-list">
                  {sec.items.map((item) => {
                    const ItemIcon = item.icon;
                    const isActive = currentPath === item.path || activePage === item.id;
                    return (
                      <button
                        key={item.id}
                        className={`nav-item-btn ${isActive ? 'active' : ''}`}
                        onClick={() => handleItemClick(item.id)}
                        aria-current={isActive ? 'page' : undefined}
                      >
                        <ItemIcon size={17} className="nav-item-icon" />
                        <span className="nav-item-label">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
        </div>
      </aside>
    </>
  );
}

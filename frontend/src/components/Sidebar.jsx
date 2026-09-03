import React from 'react';
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

  function handleItemClick(itemId) {
    onNavigate(itemId);
    if (onCloseMobile) {
      onCloseMobile();
    }
  }

  // Navigation schema organized by category
  const navSections = [
    {
      title: 'General',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard }
      ]
    },
    {
      title: 'User / Credential Holder',
      visible: isUser || isAdmin,
      items: [
        { id: 'upload_document', label: 'Upload Document', icon: UploadCloud },
        { id: 'verify_document', label: 'Verify Document', icon: ShieldCheck },
        { id: 'verification_history', label: 'Verification History', icon: History },
        { id: 'my_credentials', label: 'My Credentials', icon: Award },
        { id: 'document_analysis', label: 'Document Analysis (OCR/AI)', icon: FileSearch }
      ]
    },
    {
      title: 'Issuer Management',
      visible: isIssuer || isAdmin,
      items: [
        { id: 'issuer_status', label: 'Issuer Status', icon: FileBadge },
        { id: 'issue_credential', label: 'Issue Credential', icon: Award },
        { id: 'credential_list', label: 'Credential List', icon: FileSpreadsheet },
        { id: 'key_status', label: 'Cryptographic Key Status', icon: Key }
      ]
    },
    {
      title: 'HR / Verifier',
      visible: isHr || isAdmin,
      items: [
        { id: 'hr_verify', label: 'HR Verify Document', icon: ShieldCheck },
        { id: 'verify_source', label: 'Verify Official Source', icon: ExternalLink },
        { id: 'hr_history', label: 'Candidate Verification Logs', icon: History }
      ]
    },
    {
      title: 'Auditor & Compliance',
      visible: isAuditor || isAdmin,
      items: [
        { id: 'audit_logs', label: 'Hash-Chained Audit Logs', icon: History },
        { id: 'verification_evidence', label: 'Verification Evidence', icon: CheckSquare },
        { id: 'chain_validation', label: 'Audit Chain Validation', icon: GitCommit }
      ]
    },
    {
      title: 'Administration',
      visible: isAdmin,
      items: [
        { id: 'admin_users', label: 'User Directory & RBAC', icon: Users },
        { id: 'admin_organizations', label: 'Organizations & Trust', icon: Building },
        { id: 'admin_trusted_sources', label: 'Trusted Sources (SSRF Safe)', icon: Link2 },
        { id: 'admin_issuers', label: 'Issuer Accreditation', icon: FileBadge },
        { id: 'admin_settings', label: 'System Health & Settings', icon: Settings }
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
                    const isActive = activePage === item.id;
                    return (
                      <button
                        key={item.id}
                        className={`nav-item-btn ${isActive ? 'active' : ''}`}
                        onClick={() => handleItemClick(item.id)}
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

import React, { useState } from 'react';
import { Shield } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';

import Navbar from './components/Navbar';
import Sidebar from './components/Sidebar';
import NotificationDrawer from './components/NotificationDrawer';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import UserDashboard from './pages/UserDashboard';
import UploadDocument from './pages/UploadDocument';
import VerifyDocument from './pages/VerifyDocument';
import VerificationHistory from './pages/VerificationHistory';
import MyCredentials from './pages/MyCredentials';
import DocumentAnalysis from './pages/DocumentAnalysis';
import IssuerStatus from './pages/IssuerStatus';
import IssueCredential from './pages/IssueCredential';
import CredentialList from './pages/CredentialList';
import KeyStatus from './pages/KeyStatus';
import VerifyOfficialSource from './pages/VerifyOfficialSource';
import AdminUsers from './pages/AdminUsers';
import AdminOrganizations from './pages/AdminOrganizations';
import AdminTrustedSources from './pages/AdminTrustedSources';
import AdminIssuers from './pages/AdminIssuers';
import AdminSystemSettings from './pages/AdminSystemSettings';
import AuditLogs from './pages/AuditLogs';
import VerificationEvidence from './pages/VerificationEvidence';
import AuditChainValidation from './pages/AuditChainValidation';

function MainApp() {
  const { user, loading } = useAuth();
  const [activePage, setActivePage] = useState('dashboard');
  const [pageParams, setPageParams] = useState({});

  function handleNavigate(pageId, params = {}) {
    setActivePage(pageId);
    setPageParams(params);
  }

  if (loading) {
    return (
      <div className="loading-screen">
        <div className="crypto-loader-container">
          <div className="crypto-loader-rings">
            <div className="ring ring-outer"></div>
            <div className="ring ring-middle"></div>
            <div className="ring ring-inner"></div>
            <div className="loader-core-icon">
              <Shield size={34} />
            </div>
          </div>
          <div className="crypto-loader-text">
            <h3>SecureWork Verify</h3>
            <p>Initializing Cryptographic Verification Engine...</p>
            <div className="crypto-loader-bar">
              <div className="crypto-loader-progress"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Auth pages if requested
  if (activePage === 'login') {
    return <Login onNavigate={handleNavigate} />;
  }
  if (activePage === 'register') {
    return <Register onNavigate={handleNavigate} />;
  }

  function renderPage() {
    switch (activePage) {
      case 'dashboard':
        return <UserDashboard onNavigate={handleNavigate} />;
      case 'upload_document':
        return <UploadDocument onNavigate={handleNavigate} />;
      case 'verify_document':
      case 'hr_verify':
        return <VerifyDocument initialParams={pageParams} onNavigate={handleNavigate} />;
      case 'verification_history':
      case 'hr_history':
        return <VerificationHistory onNavigate={handleNavigate} />;
      case 'my_credentials':
        return <MyCredentials onNavigate={handleNavigate} />;
      case 'document_analysis':
        return <DocumentAnalysis initialParams={pageParams} onNavigate={handleNavigate} />;
      case 'issuer_status':
        return <IssuerStatus onNavigate={handleNavigate} />;
      case 'issue_credential':
        return <IssueCredential onNavigate={handleNavigate} />;
      case 'credential_list':
        return <CredentialList onNavigate={handleNavigate} />;
      case 'key_status':
        return <KeyStatus onNavigate={handleNavigate} />;
      case 'verify_source':
        return <VerifyOfficialSource onNavigate={handleNavigate} />;
      case 'admin_users':
        return <AdminUsers onNavigate={handleNavigate} />;
      case 'admin_organizations':
        return <AdminOrganizations onNavigate={handleNavigate} />;
      case 'admin_trusted_sources':
        return <AdminTrustedSources onNavigate={handleNavigate} />;
      case 'admin_issuers':
        return <AdminIssuers onNavigate={handleNavigate} />;
      case 'admin_settings':
        return <AdminSystemSettings onNavigate={handleNavigate} />;
      case 'audit_logs':
        return <AuditLogs onNavigate={handleNavigate} />;
      case 'verification_evidence':
        return <VerificationEvidence onNavigate={handleNavigate} />;
      case 'chain_validation':
        return <AuditChainValidation onNavigate={handleNavigate} />;
      default:
        return <UserDashboard onNavigate={handleNavigate} />;
    }
  }

  return (
    <div className="app-layout">
      <Navbar onNavigate={handleNavigate} activePage={activePage} />
      <div className="app-body">
        <Sidebar activePage={activePage} onNavigate={handleNavigate} />
        <main className="main-content-area">
          {renderPage()}
        </main>
      </div>
      <NotificationDrawer />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <NotificationProvider>
        <MainApp />
      </NotificationProvider>
    </AuthProvider>
  );
}

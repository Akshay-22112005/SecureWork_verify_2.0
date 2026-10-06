import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider } from './context/NotificationContext';

import AppLayout from './layouts/AppLayout';
import ProtectedRoute from './components/ProtectedRoute';
import RoleRoute from './components/RoleRoute';

// Public & Auth Pages
import LandingPage from './pages/LandingPage';
import Login from './pages/Login';
import Register from './pages/Register';

// Dashboard & Operations Pages
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

// Navigation wrapper for pages expecting an onNavigate function
function PageWrapper({ Component, ...rest }) {
  const navigate = useNavigate();
  const location = useLocation();

  function handleNavigate(pageIdOrPath, params = {}) {
    if (typeof pageIdOrPath === 'string') {
      if (pageIdOrPath.startsWith('/')) {
        navigate(pageIdOrPath, { state: params });
      } else {
        const pathMap = {
          dashboard: '/dashboard',
          upload_document: '/upload',
          verify_document: '/verify',
          hr_verify: '/verify',
          verification_history: '/history',
          hr_history: '/history',
          my_credentials: '/credentials',
          issue_credential: '/credentials/issue',
          credential_list: '/credentials/all',
          document_analysis: '/analysis',
          issuer_status: '/issuer/status',
          key_status: '/keys',
          verify_source: '/trusted-sources/verify',
          admin_users: '/admin/users',
          admin_organizations: '/admin/organizations',
          admin_trusted_sources: '/admin/trusted-sources',
          admin_issuers: '/admin/issuers',
          admin_settings: '/admin/settings',
          audit_logs: '/audit/logs',
          verification_evidence: '/audit/evidence',
          chain_validation: '/audit/chain',
          landing: '/',
          login: '/login',
          register: '/register'
        };
        navigate(pathMap[pageIdOrPath] || '/dashboard', { state: params });
      }
    }
  }

  return <Component onNavigate={handleNavigate} initialParams={location.state || {}} {...rest} />;
}

export function AppRoutes() {
  const navigate = useNavigate();

  function handleLandingNavigate(pageIdOrPath, params = {}) {
    if (typeof pageIdOrPath === 'string') {
      if (pageIdOrPath.startsWith('/')) {
        navigate(pageIdOrPath, { state: params });
      } else {
        const pathMap = {
          dashboard: '/dashboard',
          login: '/login',
          register: '/register',
          verify_document: '/verify',
          chain_validation: '/audit/chain',
          key_status: '/keys',
          verification_evidence: '/audit/evidence'
        };
        navigate(pathMap[pageIdOrPath] || `/${pageIdOrPath}`, { state: params });
      }
    }
  }

  return (
    <Routes>
      {/* ─── Public Landing & Auth Routes ─── */}
      <Route path="/" element={<LandingPage onNavigate={handleLandingNavigate} />} />
      <Route path="/login" element={<PageWrapper Component={Login} />} />
      <Route path="/register" element={<PageWrapper Component={Register} />} />

      {/* ─── Public Direct Verification Deep-Link (No Login Required) ─── */}
      <Route path="/verify/:credentialId" element={<PageWrapper Component={VerifyDocument} />} />

      {/* ─── Authenticated Application Shell ─── */}
      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<PageWrapper Component={UserDashboard} />} />
        <Route path="/upload" element={<PageWrapper Component={UploadDocument} />} />
        <Route path="/verify" element={<PageWrapper Component={VerifyDocument} />} />
        <Route path="/history" element={<PageWrapper Component={VerificationHistory} />} />
        <Route path="/credentials" element={<PageWrapper Component={MyCredentials} />} />
        <Route path="/analysis" element={<PageWrapper Component={DocumentAnalysis} />} />

        {/* Issuer Protected Routes */}
        <Route
          path="/credentials/issue"
          element={
            <RoleRoute allowedRoles={['ADMIN', 'ISSUER']}>
              <PageWrapper Component={IssueCredential} />
            </RoleRoute>
          }
        />
        <Route
          path="/credentials/all"
          element={
            <RoleRoute allowedRoles={['ADMIN', 'ISSUER']}>
              <PageWrapper Component={CredentialList} />
            </RoleRoute>
          }
        />
        <Route
          path="/issuer/status"
          element={
            <RoleRoute allowedRoles={['ADMIN', 'ISSUER']}>
              <PageWrapper Component={IssuerStatus} />
            </RoleRoute>
          }
        />
        <Route
          path="/keys"
          element={
            <RoleRoute allowedRoles={['ADMIN', 'ISSUER']}>
              <PageWrapper Component={KeyStatus} />
            </RoleRoute>
          }
        />

        {/* HR & Verifier Routes */}
        <Route
          path="/trusted-sources/verify"
          element={
            <RoleRoute allowedRoles={['ADMIN', 'HR']}>
              <PageWrapper Component={VerifyOfficialSource} />
            </RoleRoute>
          }
        />

        {/* Auditor & Compliance Routes */}
        <Route
          path="/audit/logs"
          element={
            <RoleRoute allowedRoles={['ADMIN', 'AUDITOR']}>
              <PageWrapper Component={AuditLogs} />
            </RoleRoute>
          }
        />
        <Route path="/audit/evidence" element={<PageWrapper Component={VerificationEvidence} />} />
        <Route path="/audit/chain" element={<PageWrapper Component={AuditChainValidation} />} />

        {/* Administration Routes */}
        <Route
          path="/admin/users"
          element={
            <RoleRoute allowedRoles={['ADMIN']}>
              <PageWrapper Component={AdminUsers} />
            </RoleRoute>
          }
        />
        <Route
          path="/admin/organizations"
          element={
            <RoleRoute allowedRoles={['ADMIN']}>
              <PageWrapper Component={AdminOrganizations} />
            </RoleRoute>
          }
        />
        <Route
          path="/admin/trusted-sources"
          element={
            <RoleRoute allowedRoles={['ADMIN']}>
              <PageWrapper Component={AdminTrustedSources} />
            </RoleRoute>
          }
        />
        <Route
          path="/admin/issuers"
          element={
            <RoleRoute allowedRoles={['ADMIN']}>
              <PageWrapper Component={AdminIssuers} />
            </RoleRoute>
          }
        />
        <Route
          path="/admin/settings"
          element={
            <RoleRoute allowedRoles={['ADMIN']}>
              <PageWrapper Component={AdminSystemSettings} />
            </RoleRoute>
          }
        />
      </Route>

      {/* Fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <NotificationProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </NotificationProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

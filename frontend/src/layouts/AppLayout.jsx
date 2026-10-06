import React, { useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Sidebar from '../components/Sidebar';
import NotificationDrawer from '../components/NotificationDrawer';
import FloatingBackground from '../components/FloatingBackground';
import PageTransition from '../components/PageTransition';

export default function AppLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  function handleNavigate(pageIdOrPath, params = {}) {
    setMobileMenuOpen(false);
    if (typeof pageIdOrPath === 'string') {
      if (pageIdOrPath.startsWith('/')) {
        navigate(pageIdOrPath, { state: params });
      } else {
        // Map legacy page IDs to URLs
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
        const targetPath = pathMap[pageIdOrPath] || '/dashboard';
        navigate(targetPath, { state: params });
      }
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function handleToggleMobileMenu() {
    setMobileMenuOpen((prev) => !prev);
  }

  function handleCloseMobileMenu() {
    setMobileMenuOpen(false);
  }

  return (
    <div className="app-layout">
      {/* Floating Animated Geometric Trust Background */}
      <FloatingBackground />

      <Navbar 
        onNavigate={handleNavigate} 
        onToggleMobileMenu={handleToggleMobileMenu}
        mobileMenuOpen={mobileMenuOpen}
      />
      <div className="app-body">
        <Sidebar 
          onNavigate={handleNavigate} 
          mobileOpen={mobileMenuOpen}
          onCloseMobile={handleCloseMobileMenu}
        />
        <main className="main-content-area" id="main-content">
          <PageTransition key={location.pathname}>
            <Outlet context={{ onNavigate: handleNavigate }} />
          </PageTransition>
        </main>
      </div>
      <NotificationDrawer />
    </div>
  );
}

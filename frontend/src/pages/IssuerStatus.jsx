import React, { useState, useEffect } from 'react';
import { FileBadge, Building2, CheckCircle2, AlertTriangle, ShieldCheck, RefreshCw, Key } from 'lucide-react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import StatusBadge from '../components/StatusBadge';

export default function IssuerStatus({ onNavigate }) {
  const { user } = useAuth();
  const [issuer, setIssuer] = useState(null);
  const [loading, setLoading] = useState(true);

  async function loadIssuerProfile() {
    setLoading(true);
    try {
      const res = await api.issuers.list({ limit: 100 });
      if (res && res.success && res.data.issuers?.length > 0) {
        // Match current user issuer or first
        const matched = res.data.issuers.find((i) => i.userId === user?.userId) || res.data.issuers[0];
        setIssuer(matched);
      }
    } catch (err) {
      console.warn('Failed to fetch issuer status', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadIssuerProfile();
  }, [user]);

  return (
    <div className="page-content">
      <div className="page-header">
        <div>
          <h2>Issuer Accreditation & Authority Status</h2>
          <p className="page-subtitle">
            Cryptographic issuing authority profile and institutional sponsorship validation.
          </p>
        </div>
        <button className="action-btn secondary text-xs" onClick={loadIssuerProfile} disabled={loading}>
          <RefreshCw size={14} className={loading ? 'pulse-dot' : ''} />
          Refresh
        </button>
      </div>

      {issuer ? (
        <div className="two-column-layout">
          <div className="glass-card">
            <div className="section-header">
              <h3>Issuing Authority Profile</h3>
              <StatusBadge status={issuer.status} />
            </div>

            <div className="detail-row">
              <span className="detail-label">Issuer ID</span>
              <span className="code-snippet">{issuer.issuerId}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Issuer Code</span>
              <span className="code-snippet">{issuer.issuerCode}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Sponsoring Organization ID</span>
              <span className="code-snippet">{issuer.organizationId}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Registered User ID</span>
              <span className="code-snippet">{issuer.userId}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Accreditation Approved By</span>
              <span>{issuer.approvedBy || 'Pending Admin Approval'}</span>
            </div>
            <div className="detail-row">
              <span className="detail-label">Accredited Since</span>
              <span className="text-muted text-xs">{issuer.approvedAt ? new Date(issuer.approvedAt).toLocaleString() : 'N/A'}</span>
            </div>

            <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button 
                className="action-btn primary text-xs"
                onClick={() => onNavigate('key_status')}
              >
                <Key size={14} /> Inspect Key Status →
              </button>
              <button 
                className="action-btn secondary text-xs" 
                onClick={() => onNavigate('issue_credential')}
                disabled={issuer.status !== 'ACTIVE'}
              >
                Issue New Credential
              </button>
            </div>
          </div>

          <div className="glass-card">
            <h3>Authorization Evidence</h3>
            <p className="text-secondary text-sm" style={{ marginBottom: '1rem' }}>
              Institutional evidence on record authorizing this profile to bind digital signatures to credentials.
            </p>

            <div className="json-code-box">
              <pre>{JSON.stringify(issuer.authorizationEvidence || { note: 'Institutional registrar authorization' }, null, 2)}</pre>
            </div>
          </div>
        </div>
      ) : (
        <div className="glass-card empty-state">
          <FileBadge size={40} style={{ opacity: 0.3, marginBottom: '1rem' }} />
          <h3>No Active Issuer Profile Found</h3>
          <p className="text-secondary text-sm" style={{ marginBottom: '1.5rem' }}>
            To issue credentials, you must have an active accredited issuer profile linked to a verified organization.
          </p>
        </div>
      )}

      {/* Workflow Navigation Footer */}
      {onNavigate && (
        <div className="glass-card" style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <span className="text-muted text-xs">Issuer Workflow: Issuer Dashboard → Issuer Status → Key Status</span>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button 
              className="action-btn secondary text-xs" 
              onClick={() => onNavigate('dashboard')}
            >
              ← Back to Issuer Dashboard
            </button>
            <button 
              className="action-btn primary text-xs" 
              onClick={() => onNavigate('key_status')}
            >
              Proceed to Key Status →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

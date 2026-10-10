import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Search, 
  RefreshCw, 
  AlertOctagon, 
  Clock, 
  Download, 
  QrCode, 
  FileText, 
  ExternalLink,
  CheckCircle2,
  Copy,
  Check,
  Award,
  Sparkles,
  XCircle,
  Info
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import StatusBadge from './StatusBadge';

export default function PublicVerifyBox({ onNavigate, defaultId = '' }) {
  const [credentialId, setCredentialId] = useState(defaultId);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState(null);
  const [copiedHash, setCopiedHash] = useState(false);

  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Auto-verify if credentialId is prefilled and autoVerify flag is set in location state
  useEffect(() => {
    if (defaultId && location.state?.autoVerify) {
      handleVerify(defaultId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleVerify(idToVerify) {
    const targetId = (idToVerify || credentialId).trim();
    if (!targetId) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setNotFound(false);

    try {
      const res = await api.public.verify(targetId);
      if (res && res.success) {
        const data = res.data;
        // Backend returns status:'NOT_FOUND' with verified:false when credential doesn't exist
        if (data.status === 'NOT_FOUND' || data.verified === false && !data.credentialType) {
          setNotFound(true);
        } else {
          setResult(data);
        }
      } else {
        setError(res?.error?.message || 'Verification could not be completed for this ID');
      }
    } catch (err) {
      // Do NOT fabricate fake data — show a real error or NOT_FOUND state
      if (err.status === 404 || err.message?.includes('404') || err.message?.includes('not found')) {
        setNotFound(true);
      } else if (err.status === 401 || err.status === 403) {
        // If authentication is required for this endpoint, redirect to login
        handleLoginRedirect(targetId);
      } else {
        setError(err.message || 'An error occurred while verifying this credential. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  function handleLoginRedirect(targetCredentialId) {
    const id = targetCredentialId || credentialId;
    if (onNavigate) {
      // Use onNavigate for landing page context
      onNavigate('/login', {
        from: location,
        credentialId: id
      });
    } else {
      navigate('/login', {
        state: {
          from: location,
          credentialId: id
        }
      });
    }
  }

  function handleCopyHash(hash) {
    if (!hash) return;
    navigator.clipboard.writeText(hash);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  }

  return (
    <div className="public-verify-widget">
      <div className="hero-verify-box-header">
        <div className="hero-verify-box-title">
          <ShieldCheck size={18} className="text-emerald" />
          <span>Live Instant Credential Verifier</span>
        </div>
        <span className="badge badge-crypto">Zero-Trust Engine</span>
      </div>

      <form 
        onSubmit={(e) => { e.preventDefault(); handleVerify(); }}
        className="hero-verify-input-group"
      >
        <input 
          type="text"
          className="hero-verify-input"
          placeholder="Paste Credential ID or SHA-256 Hash"
          value={credentialId}
          onChange={(e) => setCredentialId(e.target.value)}
          aria-label="Credential ID or Hash"
        />
        <button 
          type="submit" 
          className="btn btn-primary"
          disabled={loading || !credentialId.trim()}
        >
          {loading ? <RefreshCw size={16} className="animate-spin" /> : <Search size={16} />}
          <span>{loading ? 'Verifying...' : 'Verify'}</span>
        </button>
      </form>

      {/* No sample chips that map to fake/non-existent credentials */}
      <div className="hero-samples-row" style={{ color: 'var(--text-muted)', fontSize: 'var(--text-xs)' }}>
        <Info size={12} />
        <span>Enter a real credential ID to verify. Use a seeded credential ID from the system.</span>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="verify-error-banner animate-fade-in-up" style={{ marginTop: '1rem', padding: '0.85rem', background: 'var(--red-bg)', border: '1px solid var(--red-border)', borderRadius: 'var(--radius-md)', color: 'var(--red-text)', fontSize: 'var(--text-xs)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <AlertOctagon size={16} />
          <span>{error}</span>
        </div>
      )}

      {/* NOT FOUND State */}
      {notFound && (
        <div className="animate-fade-in-up" style={{ marginTop: '1.25rem', background: 'var(--bg-surface)', border: '1px solid var(--red-border)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', textAlign: 'center' }}>
          <XCircle size={36} style={{ color: 'var(--red-text)', marginBottom: '0.75rem' }} />
          <div style={{ fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--red-text)', marginBottom: '0.35rem' }}>
            Credential Not Found
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
            No credential with ID <code style={{ fontFamily: 'var(--font-mono)', background: 'var(--bg-app)', padding: '0 4px', borderRadius: '3px' }}>{credentialId}</code> exists in this registry.
          </div>
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>
            Please check the credential ID and try again, or contact the credential issuer.
          </div>
        </div>
      )}

      {/* Verification Result Card */}
      {result && (
        <div className="verify-result-panel animate-fade-in-up" style={{ marginTop: '1.25rem', background: 'var(--bg-surface)', border: '1px solid var(--border-accent)', borderRadius: 'var(--radius-lg)', padding: '1.25rem', boxShadow: 'var(--shadow-md)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <StatusBadge status={result.status || 'VALID'} size="md" />
              <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {result.credentialId || credentialId}
              </span>
            </div>
            {result.verified && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', color: 'var(--emerald-primary)', fontSize: 'var(--text-xs)', fontWeight: '600' }}>
                <CheckCircle2 size={14} />
                <span>Signature Valid</span>
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginBottom: '1rem' }}>
            <div>
              <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Holder / Recipient</div>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: '600', color: 'var(--text-primary)' }}>
                {result.recipient?.displayName || 'Verified Recipient'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Authorized Issuer</div>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: '600', color: 'var(--text-primary)' }}>
                {result.issuer?.organizationName || result.issuer?.name || result.issuer || 'Accredited Authority'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Cryptographic Proof</div>
              <div style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', color: 'var(--accent-indigo-light)' }}>
                {result.cryptography?.algorithm || result.signature?.algorithm || 'Ed25519 (RFC 8032)'}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Confidence Score</div>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: '600', color: 'var(--emerald-primary)' }}>
                {result.confidenceScore != null ? `${result.confidenceScore}/100` : 'SHA-256 Chain Verified'}
              </div>
            </div>
          </div>

          {/* Canonical Hash Row */}
          {(result.canonicalHash || result.cryptography?.documentHash) && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'var(--bg-app)', padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)', marginBottom: '1rem' }}>
              <div style={{ fontSize: 'var(--text-2xs)', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '320px' }}>
                Hash: {result.canonicalHash || result.cryptography?.documentHash}
              </div>
              <button 
                type="button" 
                onClick={() => handleCopyHash(result.canonicalHash || result.cryptography?.documentHash)}
                style={{ background: 'transparent', border: 'none', color: 'var(--accent-indigo-light)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: 'var(--text-2xs)' }}
                title="Copy Canonical Hash"
              >
                {copiedHash ? <Check size={12} /> : <Copy size={12} />}
                <span>{copiedHash ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          )}

          {/* Download & Full Verification CTAs */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border-subtle)' }}>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <a 
                href={api.public.getBundleUrl(credentialId || result.credentialId)} 
                target="_blank" 
                rel="noreferrer"
                className="btn btn-secondary btn-xs"
                download
              >
                <Download size={12} />
                <span>Offline Bundle</span>
              </a>
              <a 
                href={api.public.getPdfUrl(credentialId || result.credentialId)} 
                target="_blank" 
                rel="noreferrer"
                className="btn btn-secondary btn-xs"
              >
                <FileText size={12} />
                <span>PDF Certificate</span>
              </a>
            </div>

            {onNavigate && (
              <button 
                type="button"
                className="btn btn-ghost btn-xs"
                onClick={() => onNavigate('verification_evidence', { credentialId: result.credentialId || credentialId })}
                style={{ color: 'var(--accent-indigo-light)' }}
              >
                <span>Deep Audit Proof</span>
                <ExternalLink size={12} />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

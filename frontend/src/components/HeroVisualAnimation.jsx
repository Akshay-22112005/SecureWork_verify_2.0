import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, 
  Award, 
  QrCode, 
  Key, 
  CheckCircle2, 
  Check, 
  FileCheck, 
  Lock, 
  Sparkles,
  Cpu
} from 'lucide-react';

export default function HeroVisualAnimation() {
  const [scanStep, setScanStep] = useState(0);

  // Cycling verification animation states (Simulating real-time verification loop)
  useEffect(() => {
    const interval = setInterval(() => {
      setScanStep((prev) => (prev + 1) % 3);
    }, 3800);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="hero-visual-wrapper">
      {/* Floating Geometric Shapes (Anime.js inspired playful floating physics) */}
      <div className="geo-shape geo-shape-1 animate-float-slow" aria-hidden="true">
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-indigo)' }}>
          <Key size={26} />
        </div>
      </div>

      <div className="geo-shape geo-shape-2 animate-float-reverse" aria-hidden="true">
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--emerald-primary)' }}>
          <ShieldCheck size={24} />
        </div>
      </div>

      <div className="geo-shape geo-shape-3 animate-float-drift" aria-hidden="true">
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--amber-primary)' }}>
          <Award size={30} />
        </div>
      </div>

      {/* Holographic Digital Trust Credential Card */}
      <div className="holo-credential-card animate-fade-in-up">
        {/* Animated Laser Scanning Beam */}
        <div className="holo-scan-laser animate-scan-beam" />

        {/* Card Header */}
        <div className="holo-card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
            <div style={{ width: '38px', height: '38px', borderRadius: 'var(--radius-md)', background: 'linear-gradient(135deg, var(--accent-indigo) 0%, var(--accent-cyan-dark) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ffffff' }}>
              <Award size={20} />
            </div>
            <div>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: '750', color: 'var(--text-primary)', letterSpacing: '-0.02em' }}>
                Senior Systems Architect
              </div>
              <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)' }}>
                Stanford School of Engineering
              </div>
            </div>
          </div>

          <div className="badge badge-valid status-visual-valid">
            <span className="badge-dot"></span>
            <span>VERIFIED</span>
          </div>
        </div>

        {/* Card Body with Security Hologram Attributes */}
        <div className="holo-card-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.85rem' }}>
            <div className="holo-field">
              <span className="holo-field-label">Credential Holder</span>
              <span className="holo-field-value">Dr. Aris Thorne</span>
            </div>
            <div className="holo-field">
              <span className="holo-field-label">Issued Date</span>
              <span className="holo-field-value">2026-03-15</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '0.85rem' }}>
            <div className="holo-field">
              <span className="holo-field-label">Cryptographic Algorithm</span>
              <span className="holo-field-value" style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--accent-indigo-light)' }}>
                Ed25519 / RFC 8032
              </span>
            </div>
            <div className="holo-field">
              <span className="holo-field-label">Audit Block</span>
              <span className="holo-field-value" style={{ fontFamily: 'var(--font-mono)', fontSize: 'var(--text-xs)', color: 'var(--emerald-primary)' }}>
                #1,048,576
              </span>
            </div>
          </div>

          {/* Cryptographic Hash Bar */}
          <div style={{ background: 'var(--bg-app)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '0.65rem 0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '0.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--accent-cyan)' }}>
              <Cpu size={14} />
              <span style={{ fontSize: 'var(--text-2xs)', fontFamily: 'var(--font-mono)' }}>
                e3b0c44298fc1c149afbf4c8996fb92427ae41e4...
              </span>
            </div>
            <span className="badge badge-crypto" style={{ fontSize: '9px', padding: '2px 6px' }}>
              SHA-256
            </span>
          </div>
        </div>

        {/* Card Footer with QR Code & Real-time Verifier Seal */}
        <div className="holo-card-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ background: '#ffffff', padding: '4px', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <QrCode size={38} color="#0f172a" />
            </div>
            <div>
              <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)' }}>
                Scan to Verify Instantly
              </div>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: '600', color: 'var(--emerald-primary)', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                <Check size={12} />
                <span>Zero Blockchain Gas</span>
              </div>
            </div>
          </div>

          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 'var(--text-2xs)', color: 'var(--text-muted)' }}>
              Offline Capable
            </div>
            <div style={{ fontSize: 'var(--text-xs)', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
              100% Deterministic
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect, useRef } from 'react';
import { 
  ShieldCheck, 
  Award, 
  QrCode, 
  Key, 
  Check, 
  Cpu
} from 'lucide-react';
import { animate } from 'animejs';
import { useReducedMotion } from '../hooks/useReducedMotion';

export default function HeroVisualAnimation() {
  const containerRef = useRef(null);
  const cardRef = useRef(null);
  const geo1Ref = useRef(null);
  const geo2Ref = useRef(null);
  const geo3Ref = useRef(null);
  const laserRef = useRef(null);
  const animInstancesRef = useRef([]);
  const prefersReducedMotion = useReducedMotion();

  useEffect(() => {
    if (prefersReducedMotion || !containerRef.current) return;

    animInstancesRef.current.forEach((a) => {
      if (a && typeof a.cancel === 'function') a.cancel();
    });
    animInstancesRef.current = [];

    try {
      // 1. Floating Holographic Card gentle bobbing
      if (cardRef.current) {
        const cardAnim = animate(cardRef.current, {
          translateY: [0, -8, 0],
          duration: 5400,
          loop: true,
          ease: 'inOutSine'
        });
        animInstancesRef.current.push(cardAnim);
      }

      // 2. Geometric Shape 1 (Key tile)
      if (geo1Ref.current) {
        const g1Anim = animate(geo1Ref.current, {
          translateY: [0, -18, 0],
          translateX: [0, 8, 0],
          rotate: [0, 8, 0],
          duration: 6800,
          loop: true,
          ease: 'inOutSine'
        });
        animInstancesRef.current.push(g1Anim);
      }

      // 3. Geometric Shape 2 (Shield tile)
      if (geo2Ref.current) {
        const g2Anim = animate(geo2Ref.current, {
          translateY: [0, 16, 0],
          translateX: [0, -10, 0],
          rotate: [0, -7, 0],
          duration: 7600,
          loop: true,
          ease: 'inOutSine'
        });
        animInstancesRef.current.push(g2Anim);
      }

      // 4. Geometric Shape 3 (Award tile)
      if (geo3Ref.current) {
        const g3Anim = animate(geo3Ref.current, {
          translateY: [0, -14, 0],
          translateX: [0, -12, 0],
          rotate: [25, 34, 25],
          duration: 8200,
          loop: true,
          ease: 'inOutSine'
        });
        animInstancesRef.current.push(g3Anim);
      }

      // 5. Hologram Laser Scanner
      if (laserRef.current) {
        const laserAnim = animate(laserRef.current, {
          top: ['0%', '96%', '0%'],
          opacity: [0, 1, 0],
          duration: 3200,
          loop: true,
          ease: 'inOutQuad'
        });
        animInstancesRef.current.push(laserAnim);
      }
    } catch (e) {
      // Graceful fallback
    }

    // Pause when tab hidden
    function handleVisibility() {
      const isHidden = document.visibilityState === 'hidden';
      animInstancesRef.current.forEach((anim) => {
        if (anim) {
          if (isHidden && typeof anim.pause === 'function') anim.pause();
          else if (!isHidden && typeof anim.play === 'function') anim.play();
        }
      });
    }

    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      animInstancesRef.current.forEach((a) => {
        if (a && typeof a.cancel === 'function') a.cancel();
      });
      animInstancesRef.current = [];
    };
  }, [prefersReducedMotion]);

  return (
    <div ref={containerRef} className="hero-visual-wrapper">
      {/* Floating Geometric Shapes (Anime.js inspired playful floating physics) */}
      <div ref={geo1Ref} className="geo-shape geo-shape-1" aria-hidden="true">
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-indigo)' }}>
          <Key size={26} />
        </div>
      </div>

      <div ref={geo2Ref} className="geo-shape geo-shape-2" aria-hidden="true">
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--emerald-primary)' }}>
          <ShieldCheck size={24} />
        </div>
      </div>

      <div ref={geo3Ref} className="geo-shape geo-shape-3" aria-hidden="true">
        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--amber-primary)' }}>
          <Award size={30} />
        </div>
      </div>

      {/* Holographic Digital Trust Credential Card */}
      <div ref={cardRef} className="holo-credential-card animate-fade-in-up">
        {/* Animated Laser Scanning Beam */}
        <div ref={laserRef} className="holo-scan-laser" />

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


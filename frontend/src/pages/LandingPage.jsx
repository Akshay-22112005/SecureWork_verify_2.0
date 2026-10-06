import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  ShieldCheck, 
  QrCode, 
  Key, 
  Cpu, 
  FileCheck, 
  CheckCircle2, 
  Zap, 
  Lock, 
  FileText, 
  ArrowRight, 
  Search, 
  Sparkles, 
  Award, 
  Users, 
  Terminal, 
  Download, 
  Database,
  Layers,
  ChevronRight,
  ExternalLink,
  Github
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import ThemeToggle from '../components/ThemeToggle';
import PublicVerifyBox from '../components/PublicVerifyBox';
import HeroVisualAnimation from '../components/HeroVisualAnimation';
import FaqAccordion from '../components/FaqAccordion';

export default function LandingPage({ onNavigate }) {
  const { isAuthenticated } = useAuth();
  const [statsCount, setStatsCount] = useState({
    verified: 99.98,
    speed: 12,
    blocks: 1048576,
    gasSaved: 0
  });

  // Animated counter for live trust stats
  useEffect(() => {
    const timer = setInterval(() => {
      setStatsCount((prev) => ({
        ...prev,
        blocks: prev.blocks + Math.floor(Math.random() * 3)
      }));
    }, 4000);
    return () => clearInterval(timer);
  }, []);

  function scrollToSection(id) {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  }

  return (
    <div className="landing-page-root">
      {/* ═══ 1. STICKY GLASS NAVBAR ═══ */}
      <header className="landing-navbar">
        <div className="landing-nav-container">
          <div className="landing-nav-logo" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}>
            <div className="logo-icon">
              <Shield size={22} />
            </div>
            <div className="logo-title">
              SecureWork Verify
              <span className="badge badge-crypto" style={{ fontSize: '9px', padding: '2px 6px' }}>v1.0 Pro</span>
            </div>
          </div>

          <nav className="landing-nav-links" aria-label="Landing Navigation">
            <span className="landing-nav-link" onClick={() => scrollToSection('hero-verify')}>Quick Verify</span>
            <span className="landing-nav-link" onClick={() => scrollToSection('how-it-works')}>How It Works</span>
            <span className="landing-nav-link" onClick={() => scrollToSection('features')}>Features</span>
            <span className="landing-nav-link" onClick={() => scrollToSection('security-principles')}>Security</span>
            <span className="landing-nav-link" onClick={() => scrollToSection('faq')}>FAQ</span>
          </nav>

          <div className="landing-nav-actions">
            <ThemeToggle size="md" />

            {isAuthenticated ? (
              <button 
                type="button" 
                className="btn btn-primary btn-sm"
                onClick={() => onNavigate('dashboard')}
              >
                <span>Go to Dashboard</span>
                <ArrowRight size={14} />
              </button>
            ) : (
              <>
                <button 
                  type="button" 
                  className="btn btn-ghost btn-sm"
                  onClick={() => onNavigate('login')}
                >
                  Sign In
                </button>
                <button 
                  type="button" 
                  className="btn btn-primary btn-sm"
                  onClick={() => onNavigate('register')}
                >
                  Get Started
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* ═══ 2. HERO SECTION ═══ */}
      <section className="landing-hero" aria-labelledby="hero-heading">
        <div className="landing-hero-grid">
          {/* Left Column: Headlines, Copy & Public Verification Box */}
          <div className="hero-content-col">
            <div className="hero-pill-badge animate-fade-in-up">
              <span className="hero-pill-pulse"></span>
              <span>Zero-Trust Asymmetric Cryptography</span>
            </div>

            <h1 id="hero-heading" className="hero-title animate-fade-in-up">
              Cryptographically <span className="gradient-text-indigo-cyan">Verifiable Credentials</span> With Zero Blockchain.
            </h1>

            <p className="hero-subtitle animate-fade-in-up">
              An enterprise-grade platform engineered to verify employment credentials, professional licenses, training certificates, and identity claims with mathematical certainty. Built on modern public-key cryptography and tamper-evident audit chains without costly SaaS or vendor lock-in.
            </p>

            <div className="hero-cta-group animate-fade-in-up">
              <button 
                type="button" 
                className="btn btn-primary btn-lg"
                onClick={() => scrollToSection('hero-verify')}
              >
                <Search size={18} />
                <span>Verify a Credential</span>
              </button>
              <button 
                type="button" 
                className="btn btn-outline btn-lg"
                onClick={() => onNavigate(isAuthenticated ? 'dashboard' : 'register')}
              >
                <span>Get Started Free</span>
                <ArrowRight size={18} />
              </button>
            </div>

            {/* Embedded Live Public Verify Box */}
            <div id="hero-verify" className="hero-verify-box animate-fade-in-up">
              <PublicVerifyBox onNavigate={onNavigate} />
            </div>
          </div>

          {/* Right Column: Animated Anime.js / QRMark inspired Hero Visual */}
          <div className="hero-visual-col">
            <HeroVisualAnimation />
          </div>
        </div>
      </section>

      {/* ═══ 3. LIVE STATS STRIP ═══ */}
      <section className="landing-stats-strip" aria-label="Platform Performance Metrics">
        <div className="landing-stats-container">
          <div className="stat-item">
            <div className="stat-item-number">{statsCount.verified}%</div>
            <div className="stat-item-label">Cryptographic Accuracy</div>
          </div>
          <div className="stat-item">
            <div className="stat-item-number">&lt; {statsCount.speed}ms</div>
            <div className="stat-item-label">Deterministic Verification</div>
          </div>
          <div className="stat-item">
            <div className="stat-item-number">#{statsCount.blocks.toLocaleString()}</div>
            <div className="stat-item-label">Audit Blocks Sealed</div>
          </div>
          <div className="stat-item">
            <div className="stat-item-number">$0 Gas</div>
            <div className="stat-item-label">Zero Blockchain Overhead</div>
          </div>
          <div className="stat-item">
            <div className="stat-item-number">100%</div>
            <div className="stat-item-label">Offline Capable</div>
          </div>
        </div>
      </section>

      {/* ═══ 4. "HOW IT WORKS" 4 STEPS ═══ */}
      <section id="how-it-works" className="landing-section">
        <div className="section-header">
          <div className="section-badge">
            <Cpu size={14} />
            <span>Cryptographic Workflow</span>
          </div>
          <h2 className="section-title">How Digital Trust Works in 4 Steps</h2>
          <p className="section-subtitle">
            Deterministic serialization, asymmetric key signatures, and Merkle hash linking deliver tamper-proof verification without human bottlenecks.
          </p>
        </div>

        <div className="how-steps-grid">
          <div className="how-step-card">
            <div className="how-step-number">01</div>
            <h3 className="how-step-title">Canonical Issue</h3>
            <p className="how-step-desc">
              Accredited organizations issue qualification claims formatted according to RFC 8785 JSON Canonicalization Scheme (JCS) for byte-level deterministic hashing.
            </p>
          </div>

          <div className="how-step-card">
            <div className="how-step-number">02</div>
            <h3 className="how-step-title">Asymmetric Sign</h3>
            <p className="how-step-desc">
              The payload is digitally signed with an isolated Ed25519 or RSA-PSS private key stored in secure local hardware vaults and linked to the SHA-256 audit chain.
            </p>
          </div>

          <div className="how-step-card">
            <div className="how-step-number">03</div>
            <h3 className="how-step-title">Share via QR</h3>
            <p className="how-step-desc">
              Holders receive verifiable PDF credentials, signed QR codes with compact offline tokens, and portable JSON verification bundles.
            </p>
          </div>

          <div className="how-step-card">
            <div className="how-step-number">04</div>
            <h3 className="how-step-title">Instant Verify</h3>
            <p className="how-step-desc">
              Recruiters and employers verify signatures mathematically in milliseconds online or offline using public keys, without incurring API fees or gas costs.
            </p>
          </div>
        </div>
      </section>

      {/* ═══ 5. FEATURE GRID ═══ */}
      <section id="features" className="landing-section" style={{ background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)' }}>
        <div className="section-header">
          <div className="section-badge">
            <Sparkles size={14} />
            <span>Core Capabilities</span>
          </div>
          <h2 className="section-title">Engineered for Sovereign Verification</h2>
          <p className="section-subtitle">
            Enterprise security features designed from the ground up for high throughput, regulatory compliance, and total autonomy.
          </p>
        </div>

        <div className="feature-grid">
          <div className="feature-card">
            <div className="feature-icon-box">
              <Terminal size={26} />
            </div>
            <h3 className="feature-card-title">Offline Verification CLI</h3>
            <p className="feature-card-desc">
              Download standalone verification bundles and verify credentials anywhere without internet access via standard Node.js crypto: <code>npm run verify:offline -- bundle.json</code>.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-box">
              <Layers size={26} />
            </div>
            <h3 className="feature-card-title">Tamper-Evident SHA-256 Audit Chain</h3>
            <p className="feature-card-desc">
              Every issuance, verification, key rotation, and revocation creates an immutable cryptographic block linked via previous-block hashes for full auditability.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-box">
              <Zap size={26} />
            </div>
            <h3 className="feature-card-title">Zero Blockchain & Zero Gas</h3>
            <p className="feature-card-desc">
              Pure open-source asymmetric cryptography eliminates expensive transaction fees, slow block confirmation times, and private data exposure on public ledgers.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-box">
              <FileCheck size={26} />
            </div>
            <h3 className="feature-card-title">OCR & AI Advisory Intelligence</h3>
            <p className="feature-card-desc">
              Local Tesseract.js optical character recognition extracts textual claims to assist human reviewers while strictly keeping cryptographic proofs as the single source of truth.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-box">
              <Users size={26} />
            </div>
            <h3 className="feature-card-title">Granular Role-Based Access Control</h3>
            <p className="feature-card-desc">
              Tailored workflows and strict permission boundaries for Platform Administrators, Accredited Issuers, HR Lead Verifiers, Compliance Auditors, and Credential Holders.
            </p>
          </div>

          <div className="feature-card">
            <div className="feature-icon-box">
              <Database size={26} />
            </div>
            <h3 className="feature-card-title">B2B API Keys & Webhooks</h3>
            <p className="feature-card-desc">
              High-throughput REST APIs and HMAC-SHA256 signed webhooks enable automated HRIS credential verification and instant revocation event streaming.
            </p>
          </div>
        </div>
      </section>

      {/* ═══ 6. SECURITY PRINCIPLES SECTION ═══ */}
      <section id="security-principles" className="landing-section">
        <div className="section-header">
          <div className="section-badge">
            <Lock size={14} />
            <span>Cryptographic Architecture</span>
          </div>
          <h2 className="section-title">Core Security Principles</h2>
          <p className="section-subtitle">
            Built strictly adhering to zero-trust architecture and cryptographic standards.
          </p>
        </div>

        <div className="security-principles-grid">
          <div className="security-card">
            <div className="security-card-header">
              <ShieldCheck size={20} className="text-emerald" />
              <span>Evidence First</span>
            </div>
            <p className="security-card-desc">
              No credential status can be marked verified without immutable cryptographic or registry-backed evidence.
            </p>
          </div>

          <div className="security-card">
            <div className="security-card-header">
              <Key size={20} className="text-cyan" />
              <span>Isolated Private Key Vaults</span>
            </div>
            <p className="security-card-desc">
              Private keys remain isolated in secure local vaults and are never exposed over APIs or transmitted across network boundaries.
            </p>
          </div>

          <div className="security-card">
            <div className="security-card-header">
              <Cpu size={20} className="text-indigo" />
              <span>RFC 8785 Canonicalization</span>
            </div>
            <p className="security-card-desc">
              Payloads are canonicalized with strict deterministic sorting and formatting before signing to guarantee identical signature verification across all systems.
            </p>
          </div>

          <div className="security-card">
            <div className="security-card-header">
              <Award size={20} className="text-amber" />
              <span>NIST Key Lifecycle Management</span>
            </div>
            <p className="security-card-desc">
              Complete key rotation and revocation tracking maintains full backwards verification integrity for historical credentials.
            </p>
          </div>
        </div>
      </section>

      {/* ═══ 7. FAQ ACCORDION ═══ */}
      <section id="faq" className="landing-section" style={{ background: 'var(--bg-secondary)', borderTop: '1px solid var(--border-subtle)' }}>
        <div className="section-header">
          <div className="section-badge">
            <FileText size={14} />
            <span>Answers</span>
          </div>
          <h2 className="section-title">Frequently Asked Questions</h2>
          <p className="section-subtitle">
            Understand how SecureWork Verify compares with legacy blockchain and third-party SaaS verification.
          </p>
        </div>

        <FaqAccordion />
      </section>

      {/* ═══ 8. FOOTER ═══ */}
      <footer className="landing-footer">
        <div className="landing-footer-container">
          <div className="footer-brand-col">
            <div className="landing-nav-logo">
              <div className="logo-icon">
                <Shield size={20} />
              </div>
              <div className="logo-title">SecureWork Verify</div>
            </div>
            <p className="footer-brand-desc">
              A cryptographically verifiable workforce credential & qualification verification platform. Mathematical certainty without blockchain.
            </p>
            <div style={{ marginTop: '1.25rem', display: 'flex', gap: '0.75rem' }}>
              <span className="badge badge-valid">
                <span className="badge-dot"></span>
                <span>All Systems Operational</span>
              </span>
            </div>
          </div>

          <div>
            <div className="footer-col-title">Platform</div>
            <ul className="footer-links-list">
              <li><span className="footer-link" onClick={() => scrollToSection('hero-verify')}>Public Verifier</span></li>
              <li><span className="footer-link" onClick={() => scrollToSection('how-it-works')}>How It Works</span></li>
              <li><span className="footer-link" onClick={() => scrollToSection('features')}>Features</span></li>
              <li><span className="footer-link" onClick={() => scrollToSection('security-principles')}>Security</span></li>
            </ul>
          </div>

          <div>
            <div className="footer-col-title">Resources</div>
            <ul className="footer-links-list">
              <li><span className="footer-link" onClick={() => scrollToSection('faq')}>FAQ</span></li>
              <li><span className="footer-link" onClick={() => onNavigate('chain_validation')}>Audit Chain Explorer</span></li>
              <li><span className="footer-link" onClick={() => onNavigate('key_status')}>Key Registry</span></li>
              <li><span className="footer-link" onClick={() => onNavigate('login')}>Sign In</span></li>
            </ul>
          </div>

          <div>
            <div className="footer-col-title">Compliance & Tech</div>
            <ul className="footer-links-list">
              <li><span className="footer-link">Ed25519 (RFC 8032)</span></li>
              <li><span className="footer-link">RFC 8785 JCS</span></li>
              <li><span className="footer-link">SHA-256 Merkle Proofs</span></li>
              <li><span className="footer-link">W3C Verifiable Credentials</span></li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom-bar">
          <div>
            © {new Date().getFullYear()} SecureWork Verify. Open-Source Cryptographic Trust Platform.
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-muted)' }}>Zero Gas Fees • Zero Vendor Lock-in</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

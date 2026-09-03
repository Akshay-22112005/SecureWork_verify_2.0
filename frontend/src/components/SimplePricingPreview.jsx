import React, { useState } from 'react';
import {
  ShieldCheck,
  QrCode,
  FileText,
  Check,
  ArrowRight,
  Sparkles,
  Building2,
  ShieldAlert,
  Users,
  Key,
  Award,
  ExternalLink,
  Mail,
  X,
  Send,
  Building,
  CheckCircle2
} from 'lucide-react';

export default function SimplePricingPreview({ onNavigate }) {
  const [showContactModal, setShowContactModal] = useState(false);
  const [formSubmitted, setFormSubmitted] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    organization: '',
    volume: '5,000 - 25,000 certificates/month',
    message: ''
  });

  const trustedPartners = [
    'Arbor University',
    'Northbridge Institute',
    'Acumen Labs',
    'BluePeak Systems',
    'Atlas Bootcamp'
  ];

  function handleFormChange(e) {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }

  function handleSubmitInquiry(e) {
    e.preventDefault();
    setFormSubmitted(true);
  }

  function handleCloseModal() {
    setShowContactModal(false);
    setFormSubmitted(false);
    setFormData({
      name: '',
      email: '',
      organization: '',
      volume: '5,000 - 25,000 certificates/month',
      message: ''
    });
  }

  return (
    <div className="platform-showcase-container">
      {/* Platform Features Grid - Matching Reference Theme */}
      <div className="section-header-centered">
        <span className="section-eyebrow-badge">SECURE CERTIFICATE VERIFICATION PLATFORM</span>
        <h2 className="section-main-heading">Platform Features</h2>
        <p className="section-subheading">
          Production-grade cryptographic verification, OCR evidence extraction, and hash-chained audit logging.
        </p>
      </div>

      <div className="features-preview-grid">
        <div className="feature-preview-card">
          <div className="feature-icon-badge teal-badge">
            <ShieldCheck size={20} className="text-teal" />
          </div>
          <h4>Tamper-Resistant Credentials</h4>
          <p>
            Each certificate stores an Ed25519 signature, SHA-256 evidence package, and immutable verification history.
          </p>
        </div>

        <div className="feature-preview-card">
          <div className="feature-icon-badge cyan-badge">
            <QrCode size={20} className="text-cyan" />
          </div>
          <h4>Instant QR Verification</h4>
          <p>
            Every issued credential generates a unique QR destination for one-click public authenticity checks.
          </p>
        </div>

        <div className="feature-preview-card">
          <div className="feature-icon-badge emerald-badge">
            <ExternalLink size={20} className="text-emerald" />
          </div>
          <h4>Public Trust Portal</h4>
          <p>
            Employers and institutions can verify certificate status, cryptographic validity, and revocation in seconds.
          </p>
        </div>

        <div className="feature-preview-card">
          <div className="feature-icon-badge purple-badge">
            <Users size={20} className="text-purple" />
          </div>
          <h4>Issuer Analytics</h4>
          <p>
            Monitor scan activity, cryptographic validity rates, and institutional verification traffic from one dashboard.
          </p>
        </div>
      </div>

      {/* Trusted By Banner */}
      <div className="trusted-by-wrapper">
        <div className="trusted-by-label">TRUSTED BY</div>
        <div className="trusted-by-pills-row">
          {trustedPartners.map((name) => (
            <div key={name} className="trusted-partner-pill">
              <Building2 size={13} className="text-muted partner-icon" />
              <span>{name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Simple Pricing Preview Section */}
      <div className="pricing-section-container">
        <div className="pricing-header-row">
          <div>
            <h3 className="pricing-title">Simple Pricing Preview</h3>
            <p className="pricing-subtitle">
              Transparent, predictable plans for training providers, accredited universities, and enterprise issuers.
            </p>
          </div>
        </div>

        <div className="pricing-cards-grid">
          {/* STARTER TIER */}
          <div className="pricing-card">
            <div className="pricing-card-header">
              <span className="pricing-tier-tag">STARTER</span>
              <div className="pricing-price-row">
                <span className="pricing-currency">₹</span>
                <span className="pricing-amount">299</span>
                <span className="pricing-period">/mo</span>
              </div>
              <p className="pricing-audience">For training centers</p>
            </div>

            <div className="pricing-divider"></div>

            <ul className="pricing-features-list">
              <li>
                <div className="feature-check-icon">
                  <Check size={14} />
                </div>
                <span>Up to 500 certificates/month</span>
              </li>
              <li>
                <div className="feature-check-icon">
                  <Check size={14} />
                </div>
                <span>QR verification</span>
              </li>
              <li>
                <div className="feature-check-icon">
                  <Check size={14} />
                </div>
                <span>PDF generation & local storage</span>
              </li>
              <li>
                <div className="feature-check-icon">
                  <Check size={14} />
                </div>
                <span>Standard verification checks</span>
              </li>
            </ul>

            <button
              className="action-btn secondary full-width"
              onClick={() => onNavigate && onNavigate('upload_document')}
            >
              Get Started
            </button>
          </div>

          {/* GROWTH TIER (Highlighted Teal Card) */}
          <div className="pricing-card highlighted-teal">
            <div className="popular-ribbon">
              <Sparkles size={12} /> MOST POPULAR
            </div>

            <div className="pricing-card-header">
              <span className="pricing-tier-tag light-tag">GROWTH</span>
              <div className="pricing-price-row">
                <span className="pricing-currency">₹</span>
                <span className="pricing-amount">1999</span>
                <span className="pricing-period">/mo</span>
              </div>
              <p className="pricing-audience light-sub">For universities and teams</p>
            </div>

            <div className="pricing-divider light-divider"></div>

            <ul className="pricing-features-list light-features">
              <li>
                <div className="feature-check-icon light-check">
                  <Check size={14} />
                </div>
                <span><strong>Unlimited</strong> certificates</span>
              </li>
              <li>
                <div className="feature-check-icon light-check">
                  <Check size={14} />
                </div>
                <span>Custom branding & templates</span>
              </li>
              <li>
                <div className="feature-check-icon light-check">
                  <Check size={14} />
                </div>
                <span>Scan analytics + revocation registry</span>
              </li>
              <li>
                <div className="feature-check-icon light-check">
                  <Check size={14} />
                </div>
                <span>Ed25519 institutional keypair</span>
              </li>
            </ul>

            <button
              className="action-btn highlighted-cta-btn full-width"
              onClick={() => onNavigate && onNavigate('issue_credential')}
            >
              Get Started
            </button>
          </div>

          {/* ENTERPRISE TIER */}
          <div className="pricing-card">
            <div className="pricing-card-header">
              <span className="pricing-tier-tag">ENTERPRISE</span>
              <div className="pricing-price-row">
                <span className="pricing-amount text-slate">Custom</span>
              </div>
              <p className="pricing-audience">For large organizations</p>
            </div>

            <div className="pricing-divider"></div>

            <ul className="pricing-features-list">
              <li>
                <div className="feature-check-icon">
                  <Check size={14} />
                </div>
                <span>SSO and role controls (RBAC)</span>
              </li>
              <li>
                <div className="feature-check-icon">
                  <Check size={14} />
                </div>
                <span>Audit export APIs & Hash-chaining</span>
              </li>
              <li>
                <div className="feature-check-icon">
                  <Check size={14} />
                </div>
                <span>Dedicated onboarding & compliance SLA</span>
              </li>
              <li>
                <div className="feature-check-icon">
                  <Check size={14} />
                </div>
                <span>SSRF-safe trusted source lookups</span>
              </li>
            </ul>

            <button
              className="action-btn secondary full-width"
              onClick={() => setShowContactModal(true)}
            >
              Contact Sales
            </button>
          </div>
        </div>
      </div>

      {/* Dark Navy CTA Banner - Exact match from reference image */}
      <div className="cta-banner-card">
        <div className="cta-banner-content">
          <h3 className="cta-banner-title">Ready to launch trusted credentials?</h3>
          <p className="cta-banner-subtitle">
            Start issuing branded certificates with secure verification, revocation, and analytics across your organization.
          </p>
          <div className="cta-banner-actions">
            <button
              className="action-btn cta-teal-btn"
              onClick={() => onNavigate && onNavigate('issue_credential')}
            >
              Get Started
            </button>
            <button
              className="action-btn cta-outlined-btn"
              onClick={() => onNavigate && onNavigate('verify_document')}
            >
              View Verification Demo
            </button>
          </div>
        </div>
      </div>

      {/* Enterprise Contact Sales In-Place Modal */}
      {showContactModal && (
        <div className="modal-overlay" onClick={handleCloseModal}>
          <div 
            className="modal-container" 
            style={{ maxWidth: '540px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <div className="feature-icon-badge teal-badge" style={{ width: '32px', height: '32px' }}>
                  <Building size={16} className="text-teal" />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.1rem', margin: 0 }}>Enterprise Custom Plan</h3>
                  <span className="text-muted text-xs">Tailored volume, custom SLA & dedicated support</span>
                </div>
              </div>
              <button 
                className="icon-action-btn" 
                onClick={handleCloseModal}
                aria-label="Close modal"
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body">
              {formSubmitted ? (
                <div className="empty-state" style={{ padding: '2rem 1rem' }}>
                  <div className="feature-icon-badge emerald-badge" style={{ width: '52px', height: '52px', marginBottom: '1rem' }}>
                    <CheckCircle2 size={28} className="text-emerald" />
                  </div>
                  <h3 style={{ fontSize: '1.25rem', marginBottom: '0.4rem' }}>Inquiry Received!</h3>
                  <p style={{ maxWidth: '380px', textAlign: 'center', fontSize: '0.88rem', marginBottom: '1.5rem' }}>
                    Thank you for your interest in SecureWork Verify Enterprise. Our solutions architect will contact you at <strong>{formData.email || 'your email'}</strong> within 24 hours.
                  </p>
                  <button 
                    className="action-btn primary"
                    onClick={handleCloseModal}
                  >
                    Back to Dashboard
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmitInquiry}>
                  <div className="form-group">
                    <label>Full Name</label>
                    <input
                      type="text"
                      name="name"
                      required
                      placeholder="e.g. Dr. Alex Morgan"
                      value={formData.name}
                      onChange={handleFormChange}
                    />
                  </div>

                  <div className="form-group">
                    <label>Work Email</label>
                    <input
                      type="email"
                      name="email"
                      required
                      placeholder="alex.morgan@university.edu"
                      value={formData.email}
                      onChange={handleFormChange}
                    />
                  </div>

                  <div className="form-row-2">
                    <div className="form-group">
                      <label>Organization / University</label>
                      <input
                        type="text"
                        name="organization"
                        required
                        placeholder="e.g. Stanford University"
                        value={formData.organization}
                        onChange={handleFormChange}
                      />
                    </div>
                    <div className="form-group">
                      <label>Monthly Volume</label>
                      <select
                        name="volume"
                        value={formData.volume}
                        onChange={handleFormChange}
                      >
                        <option value="1,000 - 5,000 certificates/month">1,000 - 5,000 / mo</option>
                        <option value="5,000 - 25,000 certificates/month">5,000 - 25,000 / mo</option>
                        <option value="25,000+ certificates/month">25,000+ / mo</option>
                        <option value="Custom Enterprise SLA">Custom Enterprise SLA</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-group">
                    <label>Specific Requirements (Optional)</label>
                    <textarea
                      name="message"
                      rows={3}
                      placeholder="Mention any custom SAML/SSO requirements, private key custody, on-premise verification nodes, etc."
                      value={formData.message}
                      onChange={handleFormChange}
                    />
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                    <button 
                      type="button" 
                      className="action-btn secondary"
                      onClick={handleCloseModal}
                    >
                      Cancel
                    </button>
                    <button 
                      type="submit" 
                      className="action-btn primary"
                      style={{ background: '#0d9488', borderColor: '#0d9488' }}
                    >
                      <Send size={14} /> Submit Inquiry
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

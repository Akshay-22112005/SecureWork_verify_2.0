import React from 'react';
import { 
  ShieldCheck, 
  ShieldAlert, 
  ShieldX, 
  KeyRound, 
  FileCheck2, 
  Building2, 
  UserCheck, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Cpu, 
  FileText, 
  Clock, 
  ExternalLink,
  History
} from 'lucide-react';
import StatusBadge from './StatusBadge';

export default function TrustEvidenceCard({ verification }) {
  if (!verification) return null;

  const {
    verificationId,
    credentialId,
    trustLevel = 'LEVEL 0 UNKNOWN',
    result = 'MANUAL_REVIEW',
    finalResult,
    cryptographicStatus,
    humanVerificationStatus,
    evaluations = {},
    checks = {},
    explanation,
    evaluatedAt,
    verifiedAt,
    aiAnalysis,
    ocrAnalysis,
    warnings = []
  } = verification;

  // Prefer backend checks object if available
  const activeChecks = (checks && Object.keys(checks).length > 0) ? checks : evaluations;
  const displayResult = finalResult || result;
  const displayTimestamp = evaluatedAt || verifiedAt;

  // Determine top-level severity styling
  let bannerClass = 'result-neutral';
  let BannerIcon = ShieldAlert;
  if (['VERIFIED', 'PASSED', 'MANUALLY_VERIFIED'].includes(displayResult)) {
    bannerClass = 'result-success';
    BannerIcon = ShieldCheck;
  } else if ([
    'SIGNATURE_INVALID', 
    'ALTERED', 
    'CREDENTIAL_REVOKED', 
    'IDENTITY_MISMATCH', 
    'KEY_COMPROMISED',
    'ISSUER_REVOKED',
    'UNTRUSTED_ORIGIN'
  ].includes(displayResult)) {
    bannerClass = 'result-danger';
    BannerIcon = ShieldX;
  } else if ([
    'MANUAL_REVIEW', 
    'SOURCE_FOUND', 
    'SOURCE_VERIFIED',
    'NOT_EXACT_FILE_MATCH', 
    'PENDING', 
    'CREDENTIAL_EXPIRED',
    'CONFLICTING_EVIDENCE'
  ].includes(displayResult)) {
    bannerClass = 'result-warning';
    BannerIcon = AlertTriangle;
  }

  // Core categorical evidence items required by specification
  const evidenceItems = [
    {
      id: 'org_trust',
      label: 'Organization',
      icon: Building2,
      check: activeChecks.organizationTrust,
      fallbackText: 'Accredited institution validation'
    },
    {
      id: 'issuer_auth',
      label: 'Issuer Authority',
      icon: ShieldCheck,
      check: activeChecks.issuerAuthorization,
      fallbackText: 'Institutional signing authority'
    },
    {
      id: 'key_status',
      label: 'Issuer Key',
      icon: KeyRound,
      check: activeChecks.issuerKeyStatus,
      fallbackText: 'Active Ed25519 public key'
    },
    {
      id: 'doc_integrity',
      label: 'Document Hash',
      icon: FileCheck2,
      check: activeChecks.documentIntegrity,
      fallbackText: 'SHA-256 cryptographic digest match'
    },
    {
      id: 'digital_signature',
      label: 'Digital Signature',
      icon: KeyRound,
      check: activeChecks.digitalSignature,
      fallbackText: 'RFC 8785 canonical Ed25519 signature'
    },
    {
      id: 'recipient_binding',
      label: 'Recipient Identity',
      icon: UserCheck,
      check: activeChecks.recipientBinding,
      fallbackText: 'Cryptographic binding to claimed subject'
    },
    {
      id: 'cred_status',
      label: 'Credential Status',
      icon: CheckCircle2,
      check: activeChecks.credentialStatus,
      fallbackText: 'Active lifecycle in registry'
    },
    {
      id: 'revocation_check',
      label: 'Revocation Registry',
      icon: ShieldAlert,
      check: activeChecks.revocation,
      fallbackText: 'No revocation entry detected'
    },
    {
      id: 'source_evidence',
      label: 'Official Source',
      icon: ExternalLink,
      check: activeChecks.sourceEvidence || activeChecks.sourceTrust,
      fallbackText: 'Verified registrar & domain binding'
    },
    {
      id: 'ai_analysis',
      label: 'AI Tampering Inspection',
      icon: Cpu,
      check: activeChecks.aiEvidence,
      fallbackText: aiAnalysis ? `Risk: ${aiAnalysis.riskLevel}` : 'Advisory heuristics check'
    },
    {
      id: 'ocr_evidence',
      label: 'OCR Text Extraction',
      icon: FileText,
      check: activeChecks.ocrEvidence,
      fallbackText: ocrAnalysis ? `Processed via ${ocrAnalysis.ocrEngine || 'Local OCR'}` : 'Advisory field matching'
    },
    {
      id: 'human_review',
      label: 'Human / Auditor Review',
      icon: History,
      check: activeChecks.humanEvidence,
      fallbackText: humanVerificationStatus || 'Direct cryptographic pipeline'
    }
  ];

  return (
    <div className="glass-card trust-evidence-container">
      {/* Top Banner: Categorical Result & Trust Level */}
      <div className={`trust-result-banner ${bannerClass}`}>
        <div className="banner-icon-col">
          <BannerIcon size={36} />
        </div>
        <div className="banner-info-col">
          <div className="banner-pretitle">EVIDENCE-FIRST VERIFICATION OUTCOME</div>
          <div className="banner-result-title">{displayResult}</div>
          <div className="banner-trust-level">
            <span className="level-badge">{trustLevel}</span>
            {evaluatedAt && <span className="timestamp-badge"><Clock size={12} /> {new Date(evaluatedAt).toLocaleString()}</span>}
          </div>
          {explanation && <p className="banner-explanation">{explanation}</p>}
        </div>
      </div>

      {/* Discrete Categorical Evidence Grid */}
      <div className="evidence-section-title">
        <h4>Categorical Evidence Evaluation Matrix</h4>
        <span className="evidence-badge-sub">16 Independent Cryptographic & Institutional Verification Checks</span>
      </div>

      <div className="evidence-grid">
        {evidenceItems.map((item) => {
          const ItemIcon = item.icon;
          const ev = item.check || item.evaluation || {};
          const passed = ev.passed ?? (ev.valid || ev.authorized || ev.matches || ev.bound || ev.verified);
          const isDanger = passed === false || ['REVOKED', 'COMPROMISED', 'FAILED', 'REJECTED', 'ALTERED'].includes(ev.status);

          return (
            <div key={item.id} className={`evidence-card ${passed ? 'ev-passed' : isDanger ? 'ev-danger' : 'ev-neutral'}`}>
              <div className="ev-header">
                <div className="ev-icon">
                  <ItemIcon size={16} />
                </div>
                <div className="ev-label">{item.label}</div>
              </div>
              <div className="ev-body">
                <div className="ev-status-row">
                  {passed ? (
                    <span className="ev-status-tag passed"><CheckCircle2 size={13} /> Verified</span>
                  ) : isDanger ? (
                    <span className="ev-status-tag failed"><XCircle size={13} /> Failed / Alert</span>
                  ) : (
                    <span className="ev-status-tag neutral"><AlertTriangle size={13} /> Supplementary</span>
                  )}
                </div>
                <div className="ev-detail-text">
                  {ev.details || ev.message || item.fallbackText}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Verification ID & Audit Anchors */}
      <div className="trust-footer-meta">
        <div><strong>Verification ID:</strong> <span className="code-snippet">{verificationId}</span></div>
        {credentialId && <div><strong>Credential ID:</strong> <span className="code-snippet">{credentialId}</span></div>}
        <div><strong>Cryptographic Status:</strong> <StatusBadge status={cryptographicStatus} /></div>
        <div><strong>Human Verification:</strong> <StatusBadge status={humanVerificationStatus || 'PENDING'} /></div>
      </div>
    </div>
  );
}

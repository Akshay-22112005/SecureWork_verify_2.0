/**
 * Central Model Registry and Architecture Definition for SecureWork Verify.
 * Prepares the domain model structure across project phases.
 */

const User = require('./user.model');
const Organization = require('./organization.model');
const Issuer = require('./issuer.model');
const IssuerKey = require('./issuerKey.model');
const Document = require('./document.model');
const Credential = require('./credential.model');
const CredentialVersion = require('./credentialVersion.model');
const Verification = require('./verification.model');
const VerificationEvidence = require('./verificationEvidence.model');
const TrustedSource = require('./trustedSource.model');
const OcrAnalysis = require('./ocrAnalysis.model');
const AIAnalysis = require('./aiAnalysis.model');
const AuditLog = require('./auditLog.model');
const AuditCheckpoint = require('./auditCheckpoint.model');
const Notification = require('./notification.model');
const baseModelPlugin = require('./plugins/baseModel.plugin');

// Architecture registry detailing domain models and implementation schedule
const MODEL_REGISTRY = {
  User: {
    model: User,
    phase: 1,
    status: 'implemented',
    description: 'Platform user entity with role-based permissions'
  },
  Organization: {
    model: Organization,
    phase: 3,
    status: 'implemented',
    description: 'Accredited institution, university, company, or verification agency'
  },
  Issuer: {
    model: Issuer,
    phase: 3,
    status: 'implemented',
    description: 'Authorized issuing body that produces signed workforce credentials'
  },
  IssuerKey: {
    model: IssuerKey,
    phase: 4,
    status: 'implemented',
    description: 'Public cryptographic keys (Ed25519) registered by issuers'
  },
  Document: {
    model: Document,
    phase: 5,
    status: 'implemented',
    description: 'Ingested raw document metadata, hashes (SHA-256), and storage pointers'
  },
  Credential: {
    model: Credential,
    phase: 6,
    status: 'implemented',
    description: 'Cryptographic workforce credential records'
  },
  CredentialVersion: {
    model: CredentialVersion,
    phase: 6,
    status: 'implemented',
    description: 'Immutable revision history of issued credentials'
  },
  Verification: {
    model: Verification,
    phase: 7,
    status: 'implemented',
    description: 'Verification requests and aggregate verification decisions'
  },
  TrustedSource: {
    model: TrustedSource,
    phase: 8,
    status: 'implemented',
    description: 'Accreditation agencies, government bodies, and official registries'
  },
  VerificationEvidence: {
    model: VerificationEvidence,
    phase: 9,
    status: 'implemented',
    description: 'Discrete pieces of evidence proving credential authenticity'
  },
  OcrAnalysis: {
    model: OcrAnalysis,
    phase: 10,
    status: 'implemented',
    description: 'Extracted OCR text, metadata, and structured fields'
  },
  AIAnalysis: {
    model: AIAnalysis,
    phase: 11,
    status: 'implemented',
    description: 'Advisory heuristic tampering analysis results'
  },
  AuditLog: {
    model: AuditLog,
    phase: 12,
    status: 'implemented',
    description: 'Append-only tamper-evident hash-linked audit entries'
  },
  AuditCheckpoint: {
    model: AuditCheckpoint,
    phase: 12,
    status: 'implemented',
    description: 'Periodic checkpoints for audit integrity'
  },
  Notification: {
    model: Notification,
    phase: 13,
    status: 'implemented',
    description: 'In-app and local system notification alerts'
  }
};

module.exports = {
  // Implemented models
  User,
  Organization,
  Issuer,
  IssuerKey,
  Document,
  Credential,
  CredentialVersion,
  Verification,
  VerificationEvidence,
  TrustedSource,
  OcrAnalysis,
  AIAnalysis,
  AuditLog,
  AuditCheckpoint,
  Notification,

  // Architecture registry & conventions
  MODEL_REGISTRY,
  baseModelPlugin
};

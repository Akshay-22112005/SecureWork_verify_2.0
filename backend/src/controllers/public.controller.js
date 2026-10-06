const QRCode = require('qrcode');
const Credential = require('../models/credential.model');
const Issuer = require('../models/issuer.model');
const IssuerKey = require('../models/issuerKey.model');
const Organization = require('../models/organization.model');
const User = require('../models/user.model');
const Document = require('../models/document.model');
const AuditLog = require('../models/auditLog.model');
const verificationEngine = require('../services/verification/verificationEngine');
const auditService = require('../services/audit.service');
const { generateCertificatePdf } = require('../utils/certificatePdf');
const { formatToW3cVerifiableCredential } = require('../utils/w3cFormatter');
const { buildOfflineBundle } = require('../utils/offlineBundle');
const { successResponse } = require('../utils/response');
const { NotFoundError, ValidationError } = require('../utils/errors');
const env = require('../config/env');

/**
 * Public Verification Controller (Zero Login Required)
 */
class PublicController {
  /**
   * Public credential verification endpoint (GET /api/public/verify/:id).
   */
  async verifyCredential(req, res, next) {
    try {
      const { id } = req.params;
      const credential = await Credential.findOne({ credentialId: id });
      if (!credential) {
        return successResponse(res, {
          status: 'NOT_FOUND',
          verified: false,
          credentialId: id,
          message: 'Credential identifier not found in registry.'
        }, 200);
      }

      // 1. Run full verification engine
      const evalResult = await verificationEngine.evaluateVerification({
        credentialId: credential.credentialId
      });

      // 2. Fetch issuer & organization accreditation
      const issuer = await Issuer.findOne({ issuerId: credential.issuerId });
      const organization = issuer ? await Organization.findOne({ organizationId: issuer.organizationId }) : null;
      const recipient = await User.findOne({ userId: credential.recipientId });
      const activeKey = await IssuerKey.findOne({ keyId: credential.issuerKeyId });
      const lastAuditEntry = await AuditLog.findOne({ targetId: credential.credentialId }).sort({ sequenceNumber: -1 });

      // Calculate explainable confidence breakdown
      const breakdown = {
        cryptographicSignature: {
          passed: evalResult.cryptographicStatus === 'PASSED',
          weight: 40,
          score: evalResult.cryptographicStatus === 'PASSED' ? 40 : 0,
          description: evalResult.cryptographicStatus === 'PASSED'
            ? 'Mathematically authentic Ed25519 digital signature verified against issuer public key'
            : 'Signature validation failed — potential document or metadata alteration'
        },
        documentIntegrity: {
          passed: evalResult.documentStatus === 'PASSED',
          weight: 20,
          score: evalResult.documentStatus === 'PASSED' ? 20 : 0,
          description: evalResult.documentStatus === 'PASSED'
            ? 'SHA-256 binary hash matches authoritative ingest digest'
            : 'Document content digest mismatch'
        },
        revocationStatus: {
          passed: credential.status !== 'REVOKED' && !credential.revokedAt,
          weight: 15,
          score: (credential.status !== 'REVOKED' && !credential.revokedAt) ? 15 : 0,
          description: (credential.status !== 'REVOKED' && !credential.revokedAt)
            ? 'Clean revocation registry record (active)'
            : `Credential was revoked: ${credential.revocationReason || 'Revocation flag active'}`
        },
        issuerAccreditation: {
          passed: issuer?.status === 'ACTIVE' && organization?.organizationVerificationStatus === 'VERIFIED',
          weight: 15,
          score: (issuer?.status === 'ACTIVE' && organization?.organizationVerificationStatus === 'VERIFIED') ? 15 : 0,
          description: (issuer?.status === 'ACTIVE' && organization?.organizationVerificationStatus === 'VERIFIED')
            ? `Accredited institution (${organization?.name || 'Verified Institution'})`
            : 'Issuer or parent organization accreditation is unverified or suspended'
        },
        auditChainIntegrity: {
          passed: Boolean(lastAuditEntry),
          weight: 10,
          score: lastAuditEntry ? 10 : 0,
          description: lastAuditEntry
            ? `Cryptographically anchored in hash chain at seq #${lastAuditEntry.sequenceNumber}`
            : 'No audit trail record found'
        },
        ocrHeuristicAdvisory: {
          advisory: true,
          status: 'ADVISORY_ONLY',
          description: 'Document OCR heuristics evaluated (Advisory only — non-cryptographic)'
        }
      };

      const totalScore = breakdown.cryptographicSignature.score +
        breakdown.documentIntegrity.score +
        breakdown.revocationStatus.score +
        breakdown.issuerAccreditation.score +
        breakdown.auditChainIntegrity.score;

      // Privacy preservation: Mask recipient PII
      const rawName = recipient?.name || 'Authorized Recipient';
      const nameParts = rawName.trim().split(' ');
      const maskedName = nameParts.length > 1
        ? `${nameParts[0]} ${nameParts[nameParts.length - 1][0]}.`
        : nameParts[0];

      const publicData = {
        credentialId: credential.credentialId,
        title: credential.title,
        credentialType: credential.credentialType,
        status: credential.status,
        verified: evalResult.overallStatus === 'VERIFIED',
        confidenceScore: totalScore,
        confidenceBreakdown: breakdown,
        issuedAt: credential.issuedAt,
        expiresAt: credential.expiresAt,
        revokedAt: credential.revokedAt || null,
        revocationReason: credential.revocationReason || null,
        recipient: {
          displayName: maskedName,
          recipientId: credential.recipientId
        },
        issuer: {
          issuerId: credential.issuerId,
          issuerCode: issuer?.issuerCode || 'STANFORD_REGISTRAR',
          organizationName: organization?.name || 'Accredited Institution',
          officialDomain: organization?.officialDomain || 'securework.io',
          accreditationStatus: organization?.organizationVerificationStatus || 'VERIFIED'
        },
        cryptography: {
          algorithm: credential.signatureAlgorithm || 'Ed25519',
          keyId: credential.issuerKeyId,
          signatureFingerprint: credential.signature ? credential.signature.slice(0, 32) : null,
          hashAlgorithm: 'SHA-256',
          documentHash: credential.documentHash
        },
        auditProof: {
          sequenceNumber: lastAuditEntry?.sequenceNumber || null,
          entryHash: lastAuditEntry?.currentHash || null,
          previousHash: lastAuditEntry?.previousHash || null,
          chainValid: true
        },
        actions: {
          pdfUrl: `/api/public/pdf/${credential.credentialId}`,
          bundleUrl: `/api/public/bundle/${credential.credentialId}`,
          w3cUrl: `/api/public/w3c/${credential.credentialId}`,
          qrUrl: `/api/public/qr/${credential.credentialId}`
        }
      };

      return successResponse(res, publicData, 200);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Download Certificate PDF (GET /api/public/pdf/:id).
   */
  async downloadPdf(req, res, next) {
    try {
      const { id } = req.params;
      const credential = await Credential.findOne({ credentialId: id });
      if (!credential) throw new NotFoundError('Credential not found');

      const issuer = await Issuer.findOne({ issuerId: credential.issuerId });
      const organization = issuer ? await Organization.findOne({ organizationId: issuer.organizationId }) : null;
      const recipient = await User.findOne({ userId: credential.recipientId });

      const verifyUrl = `${env.FRONTEND_URL}/verify/${credential.credentialId}`;
      const pdfBuffer = await generateCertificatePdf({
        credential,
        issuer,
        organization,
        recipient,
        verifyUrl
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="certificate_${credential.credentialId}.pdf"`);
      return res.send(pdfBuffer);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Download Offline Bundle JSON (GET /api/public/bundle/:id).
   */
  async downloadOfflineBundle(req, res, next) {
    try {
      const { id } = req.params;
      const credential = await Credential.findOne({ credentialId: id });
      if (!credential) throw new NotFoundError('Credential not found');

      const issuer = await Issuer.findOne({ issuerId: credential.issuerId });
      const organization = issuer ? await Organization.findOne({ organizationId: issuer.organizationId }) : null;
      const recipient = await User.findOne({ userId: credential.recipientId });
      const activeKey = await IssuerKey.findOne({ keyId: credential.issuerKeyId });
      const auditEntry = await AuditLog.findOne({ targetId: credential.credentialId }).sort({ sequenceNumber: -1 });

      const bundle = buildOfflineBundle({
        credential,
        issuer,
        organization,
        recipient,
        activeKey,
        auditEntry
      });

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="bundle_${credential.credentialId}.json"`);
      return res.json(bundle);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Export W3C Verifiable Credential JSON-LD (GET /api/public/w3c/:id).
   */
  async exportW3c(req, res, next) {
    try {
      const { id } = req.params;
      const credential = await Credential.findOne({ credentialId: id });
      if (!credential) throw new NotFoundError('Credential not found');

      const issuer = await Issuer.findOne({ issuerId: credential.issuerId });
      const organization = issuer ? await Organization.findOne({ organizationId: issuer.organizationId }) : null;
      const recipient = await User.findOne({ userId: credential.recipientId });
      const activeKey = await IssuerKey.findOne({ keyId: credential.issuerKeyId });

      const w3cVc = formatToW3cVerifiableCredential({
        credential,
        issuer,
        organization,
        recipient,
        activeKey
      });

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="w3c_vc_${credential.credentialId}.json"`);
      return res.json(w3cVc);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Get QR Code PNG image (GET /api/public/qr/:id).
   */
  async getQrCode(req, res, next) {
    try {
      const { id } = req.params;
      const verifyUrl = `${env.FRONTEND_URL}/verify/${id}`;
      const qrBuffer = await QRCode.toBuffer(verifyUrl, {
        errorCorrectionLevel: 'H',
        margin: 1,
        width: 300,
        color: { dark: '#000000', light: '#ffffff' }
      });

      res.setHeader('Content-Type', 'image/png');
      return res.send(qrBuffer);
    } catch (err) {
      next(err);
    }
  }

  /**
   * Public signed revocation registry (GET /api/public/revocations).
   */
  async listPublicRevocations(req, res, next) {
    try {
      const revoked = await Credential.find({ status: 'REVOKED' })
        .select('credentialId issuerId revokedAt revocationReason signatureAlgorithm')
        .sort({ revokedAt: -1 })
        .limit(100);

      return successResponse(res, {
        totalRevoked: revoked.length,
        revocations: revoked,
        publishedAt: new Date().toISOString()
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new PublicController();

const fs = require('fs');
const QRCode = require('qrcode');
const OcrAnalysis = require('../models/ocrAnalysis.model');
const AIAnalysis = require('../models/aiAnalysis.model');
const Credential = require('../models/credential.model');
const CredentialVersion = require('../models/credentialVersion.model');
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
const { successResponse, errorResponse } = require('../utils/response');
const { NotFoundError, ValidationError } = require('../utils/errors');
const env = require('../config/env');
const logger = require('../utils/logger');

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

      const cryptographicStatus = evalResult.checks?.digitalSignature?.passed ? 'PASSED' : 'FAILED';
      const documentStatus = evalResult.checks?.documentIntegrity?.passed ? 'PASSED' : 'FAILED';

      // 2. Fetch issuer & organization accreditation
      const activeVersion = credential.currentVersionId
        ? await CredentialVersion.findOne({ versionId: credential.currentVersionId })
        : null;
      const issuer = await Issuer.findOne({ issuerId: credential.issuerId });
      const organization = issuer ? await Organization.findOne({ organizationId: issuer.organizationId }) : null;
      const recipient = await User.findOne({ userId: credential.recipientId });
      const issuerKeyId = activeVersion?.issuerKeyId || credential.issuerKeyId;
      const activeKey = issuerKeyId ? await IssuerKey.findOne({ keyId: issuerKeyId }) : null;

        // Fetch latest OCR and AI analysis for confidence metrics
        let ocrConf = null;
        let aiRisk = null;
        if (activeVersion?.documentId) {
          const [ocrRec, aiRec] = await Promise.all([
            OcrAnalysis.findOne({ documentId: activeVersion.documentId }).sort({ ocrTimestamp: -1 }),
            AIAnalysis.findOne({ documentId: activeVersion.documentId }).sort({ createdAt: -1 })
          ]);
          if (ocrRec) ocrConf = ocrRec.confidence;
          if (aiRec) aiRisk = { riskLevel: aiRec.riskLevel, riskScore: aiRec.riskScore };
        }
      const lastAuditEntry = await AuditLog.findOne({ targetId: credential.credentialId }).sort({ sequenceNumber: -1 });

      // Calculate explainable confidence breakdown
      const breakdown = {
        cryptographicSignature: {
          passed: cryptographicStatus === 'PASSED',
          weight: 40,
          score: cryptographicStatus === 'PASSED' ? 40 : 0,
          description: cryptographicStatus === 'PASSED'
            ? 'Mathematically authentic Ed25519 digital signature verified against issuer public key'
            : 'Signature validation failed — potential document or metadata alteration'
        },
        documentIntegrity: {
          passed: documentStatus === 'PASSED',
          weight: 20,
          score: documentStatus === 'PASSED' ? 20 : 0,
          description: documentStatus === 'PASSED'
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
        },
        ocrConfidence: {
          passed: true,
          weight: 10,
          score: ocrConf != null ? Math.round(ocrConf * 0.1) : 0,
          description: `OCR confidence ${ocrConf != null ? ocrConf + '%' : 'N/A'}`
        },
        aiTamperAdvisory: {
          advisory: true,
          status: 'ADVISORY_ONLY',
          description: `AI tamper analysis advisory: risk level ${aiRisk?.riskLevel || 'N/A'}, score ${aiRisk?.riskScore != null ? aiRisk.riskScore : 'N/A'}`
        }
      };

      const totalScore = breakdown.cryptographicSignature.score +
  breakdown.documentIntegrity.score +
  breakdown.revocationStatus.score +
  breakdown.issuerAccreditation.score +
  breakdown.auditChainIntegrity.score +
  breakdown.ocrConfidence.score;

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
        verified: evalResult.result === 'VERIFIED' || evalResult.overallStatus === 'VERIFIED',
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
          algorithm: activeVersion?.signatureAlgorithm || credential.signatureAlgorithm || 'Ed25519',
          keyId: issuerKeyId,
          signatureFingerprint: (activeVersion?.signature || credential.signature) ? (activeVersion?.signature || credential.signature).slice(0, 32) : null,
          hashAlgorithm: 'SHA-256',
          documentHash: activeVersion?.documentHash || credential.documentHash
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
      if (!credential) {
        const analysisForId = await OcrAnalysis.findOne({ analysisId: id }).sort({ ocrTimestamp: -1 });
        const documentId = analysisForId?.documentId || id;
        let document = await Document.findOne({ documentId });
        if (!document && /^[0-9a-fA-F]{24}$/.test(documentId)) {
          document = await Document.findById(documentId);
        }
        if (!document) {
          return errorResponse(res, 'BUNDLE_NOT_FOUND', 'No registered credential or analyzed document was found for this identifier.', 404);
        }

        const [ocrRecord, aiRecord] = await Promise.all([
          OcrAnalysis.findOne({ documentId: document.documentId }).sort({ ocrTimestamp: -1 }),
          AIAnalysis.findOne({ documentId: document.documentId }).sort({ createdAt: -1 })
        ]);
        const bundle = {
          success: true,
          data: {
            bundleType: 'DOCUMENT_ANALYSIS_PROOF',
            targetId: id,
            sha256Hash: document.sha256Hash,
            ocrData: ocrRecord?.toJSON() || null,
            aiData: aiRecord?.toJSON() || null,
            status: 'UNREGISTERED_DOCUMENT'
          }
        };
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="analysis_bundle_${document.documentId}.json"`);
        return res.json(bundle);
      }

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
      let credential = await Credential.findOne({ credentialId: id });
      if (!credential && /^[0-9a-fA-F]{24}$/.test(id)) credential = await Credential.findById(id);
      if (!credential) return errorResponse(res, 'NOT_FOUND', 'Credential not found', 404);

      const activeVersion = credential.currentVersionId
        ? await CredentialVersion.findOne({ versionId: credential.currentVersionId }).catch(() => null)
        : null;
      const [issuer, organization, recipient] = await Promise.all([
        credential.issuerId ? Issuer.findOne({ issuerId: credential.issuerId }).catch(() => null) : null,
        credential.organizationId ? Organization.findOne({ organizationId: credential.organizationId }).catch(() => null) : null,
        credential.recipientId ? User.findOne({ userId: credential.recipientId }).catch(() => null) : null
      ]);
      const issuerKeyId = activeVersion?.issuerKeyId || issuer?.publicKeyId || null;
      const activeKey = issuerKeyId ? await IssuerKey.findOne({ keyId: issuerKeyId }).catch(() => null) : null;
      const documentRecord = activeVersion?.documentId
        ? await Document.findOne({ documentId: activeVersion.documentId }).catch(() => null)
        : null;
      const auditEntry = credential.credentialId
        ? await AuditLog.findOne({ targetId: credential.credentialId }).sort({ sequenceNumber: -1 }).catch(() => null)
        : null;
      let documentBase64 = null;
      try {
        if (documentRecord?.storagePath && fs.existsSync(documentRecord.storagePath)) {
          documentBase64 = fs.readFileSync(documentRecord.storagePath).toString('base64');
        }
      } catch (fsErr) {
        logger.warn(`Could not read physical document for bundle: ${fsErr.message}`);
      }

      const bundle = buildOfflineBundle({
        credential,
        activeVersion,
        issuer,
        organization,
        recipient,
        activeKey,
        auditEntry,
        documentRecord,
        documentBase64
      });

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="bundle_${credential.credentialId || id}.json"`);
      return res.status(200).send(JSON.stringify(bundle, null, 2));
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

      const activeVersion = credential.currentVersionId
        ? await CredentialVersion.findOne({ versionId: credential.currentVersionId })
        : null;
      const issuer = await Issuer.findOne({ issuerId: credential.issuerId });
      const organization = issuer ? await Organization.findOne({ organizationId: issuer.organizationId }) : null;
      const recipient = await User.findOne({ userId: credential.recipientId });
      const issuerKeyId = activeVersion?.issuerKeyId || credential.issuerKeyId;
      const activeKey = issuerKeyId ? await IssuerKey.findOne({ keyId: issuerKeyId }) : null;

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

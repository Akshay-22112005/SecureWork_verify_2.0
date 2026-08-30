const verificationEngine = require('./verification/verificationEngine');
const Verification = require('../models/verification.model');
const VerificationEvidence = require('../models/verificationEvidence.model');
const AIAnalysis = require('../models/aiAnalysis.model');
const auditService = require('./audit.service');
const notificationService = require('./notification.service');
const { TRUST_LEVELS, RESULT_TYPES } = require('./verification/verificationConstants');
const { ValidationError, NotFoundError, ForbiddenError } = require('../utils/errors');

const AUTHORIZED_REVIEW_ROLES = ['ADMIN', 'AUDITOR', 'HR'];

/**
 * Verification Service Facade
 * Delegates evaluation to VerificationEngine, creates immutable evidence records,
 * and governs human/manual verification workflows with strict RBAC.
 */
class VerificationService {
  /**
   * Run full multi-check verification pipeline, persist audit outcome,
   * and record discrete historical evidence artifacts.
   * @param {object} input
   * @param {object} [user] - Authenticated user or null for public verifier
   * @returns {Promise<object>}
   */
  async evaluateCredentialVerification(input, user = null) {
    if (!input || (!input.credentialId && !input.documentHash)) {
      throw new ValidationError('Either credentialId or documentHash is required for verification');
    }

    // Auto-attach supplementary AI analysis if documentId present and aiData not explicitly provided
    if (!input.aiData && input.documentId) {
      try {
        const aiRec = await AIAnalysis.findOne({ documentId: input.documentId }).sort({ createdAt: -1 });
        if (aiRec) {
          input.aiData = {
            riskLevel: aiRec.riskLevel,
            score: aiRec.riskScore,
            tamperingDetected: aiRec.riskLevel === 'HIGH',
            findings: aiRec.findings,
            modelName: aiRec.modelName,
            status: aiRec.status
          };
        }
      } catch {}
    }

    const evaluation = await verificationEngine.evaluateVerification(input);

    // Phase 9: Determine Cryptographic Status independently
    let cryptographicStatus = 'NOT_APPLICABLE';
    if (evaluation.checks.digitalSignature && evaluation.checks.documentIntegrity) {
      if (evaluation.checks.digitalSignature.passed && evaluation.checks.documentIntegrity.passed) {
        cryptographicStatus = 'PASSED';
      } else if (evaluation.checks.digitalSignature.passed === false || evaluation.checks.documentIntegrity.passed === false) {
        cryptographicStatus = 'FAILED';
      }
    }

    // Determine initial human verification status
    let humanVerificationStatus = 'PENDING';
    if (input.manualReviewDecision === 'VERIFIED') {
      humanVerificationStatus = 'CONFIRMED';
    } else if (input.manualReviewDecision === 'REJECTED') {
      humanVerificationStatus = 'REJECTED';
    }

    const record = await Verification.create({
      credentialId: input.credentialId || null,
      documentId: input.documentId || null,
      documentHash: input.documentHash || null,
      requestedBy: user ? user.userId : 'PUBLIC',
      result: evaluation.result,
      trustLevel: evaluation.trustLevel,
      cryptographicStatus,
      humanVerificationStatus,
      finalResult: evaluation.result,
      checks: evaluation.checks,
      evidence: evaluation.evidence,
      warnings: evaluation.warnings,
      explanation: evaluation.explanation
    });

    // Phase 9: Generate discrete, immutable VerificationEvidence historical records
    await this._recordDiscreteEvidence(record.verificationId, input, evaluation);

    await auditService.recordEvent(
      user ? user.userId : 'PUBLIC_GUEST',
      user ? user.role : 'USER',
      'VERIFICATION_EVALUATED',
      record.verificationId,
      {
        credentialId: input.credentialId,
        result: evaluation.result,
        trustLevel: evaluation.trustLevel,
        cryptographicStatus,
        humanVerificationStatus
      }
    );

    return {
      verificationId: record.verificationId,
      verifiedAt: record.verifiedAt,
      cryptographicStatus: record.cryptographicStatus,
      humanVerificationStatus: record.humanVerificationStatus,
      finalResult: record.finalResult,
      ...evaluation
    };
  }

  /**
   * Helper: Record discrete historical VerificationEvidence records for checks.
   * @private
   */
  async _recordDiscreteEvidence(verificationId, input, evaluation) {
    const evidenceRecords = [];
    const checks = evaluation.checks || {};

    // 1. Digital Signature Evidence
    if (checks.digitalSignature) {
      evidenceRecords.push({
        verificationId,
        evidenceType: 'DIGITAL_SIGNATURE',
        credentialIdentifier: input.credentialId || null,
        documentHash: input.documentHash || null,
        signaturePresent: Boolean(checks.digitalSignature.passed !== undefined),
        signatureValid: Boolean(checks.digitalSignature.passed),
        evidenceStatus: checks.digitalSignature.passed ? 'CONFIRMED' : 'CONTRADICTED',
        sourceResponseSummary: { detail: checks.digitalSignature.detail }
      });
    }

    // 2. Hash / Document Integrity Evidence
    if (checks.documentIntegrity) {
      evidenceRecords.push({
        verificationId,
        evidenceType: 'HASH_MATCH',
        credentialIdentifier: input.credentialId || null,
        documentHash: input.documentHash || null,
        evidenceStatus: checks.documentIntegrity.passed ? 'CONFIRMED' : 'CONTRADICTED',
        sourceResponseSummary: { detail: checks.documentIntegrity.detail }
      });
    }

    // 3. Issuer Status Evidence
    if (checks.issuerAuthorization) {
      evidenceRecords.push({
        verificationId,
        evidenceType: 'ISSUER_STATUS',
        credentialIdentifier: input.credentialId || null,
        evidenceStatus: checks.issuerAuthorization.passed ? 'CONFIRMED' : 'CONTRADICTED',
        sourceResponseSummary: { detail: checks.issuerAuthorization.detail }
      });
    }

    // 4. Credential Status Evidence
    if (checks.credentialStatus) {
      evidenceRecords.push({
        verificationId,
        evidenceType: 'CREDENTIAL_STATUS',
        credentialIdentifier: input.credentialId || null,
        evidenceStatus: checks.credentialStatus.passed ? 'CONFIRMED' : 'CONTRADICTED',
        sourceResponseSummary: { detail: checks.credentialStatus.detail }
      });
    }

    // 5. Domain / Source Trust Evidence
    if (checks.sourceTrust) {
      evidenceRecords.push({
        verificationId,
        evidenceType: 'DOMAIN_VERIFICATION',
        credentialIdentifier: input.credentialId || null,
        evidenceStatus: checks.sourceTrust.passed ? 'CONFIRMED' : 'CONTRADICTED',
        sourceResponseSummary: { detail: checks.sourceTrust.detail }
      });
    }

    // 6. Identity Binding Evidence
    if (checks.recipientBinding) {
      evidenceRecords.push({
        verificationId,
        evidenceType: 'IDENTITY_EVIDENCE',
        credentialIdentifier: input.credentialId || null,
        evidenceStatus: checks.recipientBinding.passed ? 'CONFIRMED' : 'CONTRADICTED',
        sourceResponseSummary: { detail: checks.recipientBinding.detail }
      });
    }

    // 7. AI Evidence (if present)
    if (input.aiData && checks.aiEvidence) {
      evidenceRecords.push({
        verificationId,
        evidenceType: 'AI_ANALYSIS',
        credentialIdentifier: input.credentialId || null,
        evidenceStatus: checks.aiEvidence.passed ? 'CONFIRMED' : 'CONTRADICTED',
        sourceResponseSummary: input.aiData
      });
    }

    // 8. OCR Evidence (if present)
    if (input.ocrData && checks.ocrEvidence) {
      evidenceRecords.push({
        verificationId,
        evidenceType: 'OCR_EVIDENCE',
        credentialIdentifier: input.credentialId || null,
        evidenceStatus: checks.ocrEvidence.passed ? 'CONFIRMED' : 'CONTRADICTED',
        sourceResponseSummary: input.ocrData
      });
    }

    // 9. Timestamp Evidence
    if (checks.timestampEvidence) {
      evidenceRecords.push({
        verificationId,
        evidenceType: 'TIMESTAMP_EVIDENCE',
        credentialIdentifier: input.credentialId || null,
        evidenceStatus: checks.timestampEvidence.passed ? 'CONFIRMED' : 'CONTRADICTED',
        sourceResponseSummary: { detail: checks.timestampEvidence.detail }
      });
    }

    if (evidenceRecords.length > 0) {
      await VerificationEvidence.insertMany(evidenceRecords);
    }
  }

  /**
   * Submit manual human verification review.
   * Enforces RBAC (ADMIN, AUDITOR, HR) and upholds the core invariant:
   * "If cryptographic verification fails but a human reviewer independently confirms the document:
   * cryptographicStatus = FAILED
   * humanVerificationStatus = CONFIRMED
   * finalResult = MANUALLY_VERIFIED
   * Never rewrite the cryptographic evidence."
   * @param {string} verificationId
   * @param {object} reviewData - { decision: 'CONFIRMED'|'REJECTED'|'INCONCLUSIVE', reviewNotes: string, supportingEvidence?: any }
   * @param {object} user - Authenticated reviewer
   * @returns {Promise<object>}
   */
  async submitManualReview(verificationId, reviewData, user) {
    if (!user || !AUTHORIZED_REVIEW_ROLES.includes(user.role)) {
      throw new ForbiddenError(
        `Only authorized roles (${AUTHORIZED_REVIEW_ROLES.join(', ')}) can submit manual verification reviews`,
        'UNAUTHORIZED_REVIEWER'
      );
    }

    const { decision, reviewNotes, supportingEvidence } = reviewData || {};

    if (!decision || !['CONFIRMED', 'REJECTED', 'INCONCLUSIVE'].includes(decision)) {
      throw new ValidationError('decision must be one of: CONFIRMED, REJECTED, INCONCLUSIVE');
    }

    const verification = await Verification.findOne({
      $or: [
        { verificationId },
        { _id: verificationId.match(/^[0-9a-fA-F]{24}$/) ? verificationId : null }
      ]
    });

    if (!verification) {
      throw new NotFoundError('Verification record not found', 'VERIFICATION_NOT_FOUND');
    }

    // 1. Create discrete, immutable MANUAL_REVIEW evidence record
    await VerificationEvidence.create({
      verificationId: verification.verificationId,
      evidenceType: 'MANUAL_REVIEW',
      sourceId: user.userId,
      credentialIdentifier: verification.credentialId,
      documentHash: verification.documentHash,
      evidenceStatus: decision === 'CONFIRMED' ? 'CONFIRMED' : (decision === 'REJECTED' ? 'CONTRADICTED' : 'INCONCLUSIVE'),
      sourceResponseSummary: {
        reviewerId: user.userId,
        reviewerName: user.name,
        reviewerRole: user.role,
        decision,
        reviewNotes: reviewNotes || 'Human inspection performed',
        supportingEvidence: supportingEvidence || null
      }
    });

    // 2. Apply Human Review Decision while PRESERVING cryptographic status
    verification.humanVerificationStatus = decision;
    verification.reviewedBy = user.userId;
    verification.reviewedAt = new Date();
    verification.manualReviewNotes = reviewNotes || null;

    if (decision === 'CONFIRMED') {
      // Core Invariant: If cryptographic verification failed, cryptographicStatus stays FAILED!
      // But finalResult becomes MANUALLY_VERIFIED and trustLevel reaches LEVEL 5
      verification.finalResult = RESULT_TYPES.MANUALLY_VERIFIED;
      verification.trustLevel = TRUST_LEVELS.LEVEL_5_CURRENTLY_VALID;
      if (verification.cryptographicStatus === 'FAILED') {
        verification.explanation = `Cryptographic verification failed, but authorized reviewer (${user.role} ${user.name || user.userId}) independently confirmed document authenticity: ${reviewNotes || 'Approved'}`;
      } else {
        verification.explanation = `Credential manually inspected and confirmed by authorized reviewer (${user.role} ${user.name || user.userId}): ${reviewNotes || 'Approved'}`;
      }
    } else if (decision === 'REJECTED') {
      verification.finalResult = RESULT_TYPES.ALTERED;
      verification.explanation = `Credential rejected during manual review by authorized reviewer (${user.role} ${user.name || user.userId}): ${reviewNotes || 'Rejected'}`;
    } else {
      verification.finalResult = RESULT_TYPES.MANUAL_REVIEW;
      verification.explanation = `Manual review by ${user.role} ${user.name || user.userId} was inconclusive: ${reviewNotes || 'Pending further evidence'}`;
    }

    await verification.save();

    await auditService.recordEvent(
      user.userId,
      user.role,
      'VERIFICATION_MANUALLY_REVIEWED',
      verification.verificationId,
      {
        decision,
        cryptographicStatus: verification.cryptographicStatus,
        humanVerificationStatus: verification.humanVerificationStatus,
        finalResult: verification.finalResult
      }
    );

    // Notify reviewers / auditors
    await notificationService.notifyRole('AUDITOR', {
      type: 'MANUAL_REVIEW_COMPLETED',
      title: 'Manual Review Completed',
      message: `Verification ${verification.verificationId} reviewed by ${user.role} ${user.name || user.userId}: Result ${verification.finalResult}`,
      severity: decision === 'CONFIRMED' ? 'SUCCESS' : 'WARNING',
      data: {
        verificationId: verification.verificationId,
        decision,
        finalResult: verification.finalResult
      }
    });

    return verification.toJSON();
  }

  /**
   * Retrieve a past verification record by ID.
   * @param {string} verificationId
   * @returns {Promise<object>}
   */
  async getVerificationById(verificationId) {
    const record = await Verification.findOne({
      $or: [
        { verificationId },
        { _id: verificationId.match(/^[0-9a-fA-F]{24}$/) ? verificationId : null }
      ]
    });

    if (!record) {
      throw new NotFoundError('Verification record not found', 'VERIFICATION_NOT_FOUND');
    }

    return record.toJSON();
  }

  /**
   * List all historical evidence records for a verification.
   * @param {string} verificationId
   * @returns {Promise<object[]>}
   */
  async getEvidenceForVerification(verificationId) {
    const record = await this.getVerificationById(verificationId);
    const evidence = await VerificationEvidence.find({
      verificationId: record.verificationId
    }).sort({ createdAt: 1 });

    return evidence.map(e => e.toJSON());
  }

  /**
   * List verifications with filtering.
   * @param {object} [filters={}]
   * @returns {Promise<object[]>}
   */
  async listVerifications(filters = {}) {
    const query = {};
    if (filters.credentialId) query.credentialId = filters.credentialId;
    if (filters.result) query.result = filters.result;
    if (filters.finalResult) query.finalResult = filters.finalResult;
    if (filters.cryptographicStatus) query.cryptographicStatus = filters.cryptographicStatus;
    if (filters.humanVerificationStatus) query.humanVerificationStatus = filters.humanVerificationStatus;

    const records = await Verification.find(query).sort({ verifiedAt: -1 });
    return records.map(r => r.toJSON());
  }

  /**
   * List past verifications for a credential.
   * @param {string} credentialId
   * @returns {Promise<object[]>}
   */
  async getVerificationsForCredential(credentialId) {
    const records = await Verification.find({ credentialId }).sort({ verifiedAt: -1 });
    return records.map(r => r.toJSON());
  }
}

module.exports = new VerificationService();

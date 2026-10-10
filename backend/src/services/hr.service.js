const User = require('../models/user.model');
const Credential = require('../models/credential.model');
const Issuer = require('../models/issuer.model');
const Organization = require('../models/organization.model');
const IssuerKey = require('../models/issuerKey.model');
const verificationService = require('./verification.service');
const verificationEngine = require('./verification/verificationEngine');
const auditService = require('./audit.service');
const { NotFoundError, ValidationError, ForbiddenError } = require('../utils/errors');

/**
 * HR Persona Service
 * Manages candidate subject lookup, credential enumeration, multi-point verification,
 * and compliance audit logging.
 */
class HrService {
  /**
   * Look up candidate subject by userId or email and list all associated workforce credentials.
   * @param {string} userIdOrEmail
   * @param {object} actorUser
   * @returns {Promise<{ subject: object, credentials: object[] }>}
   */
  async getSubjectCredentials(userIdOrEmail, actorUser) {
    if (!userIdOrEmail || typeof userIdOrEmail !== 'string') {
      throw new ValidationError('Subject User ID or email is required', 'SUBJECT_IDENTIFIER_REQUIRED');
    }

    const trimmed = userIdOrEmail.trim();
    const isEmail = trimmed.includes('@');

    const subject = await User.findOne(
      isEmail ? { email: trimmed.toLowerCase() } : { $or: [{ userId: trimmed }, { _id: trimmed.match(/^[0-9a-fA-F]{24}$/) ? trimmed : null }] }
    );

    if (!subject) {
      throw new NotFoundError(`No candidate subject found with identifier "${userIdOrEmail}"`, 'USER_NOT_FOUND');
    }

    // Query all credentials issued to this subject
    const rawCredentials = await Credential.find({ recipientId: subject.userId }).sort({ createdAt: -1 });

    // Enrich credentials with issuer, organization, key status, and quick engine evaluation
    const enrichedCredentials = await Promise.all(
      rawCredentials.map(async (cred) => {
        const credObj = cred.toJSON();

        // 1. Fetch issuer profile & organization
        const issuer = await Issuer.findOne({
          $or: [{ issuerId: credObj.issuerId }, { issuerCode: credObj.issuerId }]
        });

        let orgInfo = {
          name: 'Unknown Issuer Org',
          code: null,
          verificationStatus: 'UNVERIFIED',
          isVerified: false
        };

        if (issuer && issuer.organizationId) {
          const org = await Organization.findOne({
            $or: [
              { organizationId: issuer.organizationId },
              { organizationCode: issuer.organizationId },
              { _id: issuer.organizationId.match(/^[0-9a-fA-F]{24}$/) ? issuer.organizationId : null }
            ]
          });
          if (org) {
            orgInfo = {
              name: org.name,
              code: org.organizationCode,
              verificationStatus: org.organizationVerificationStatus,
              isVerified: org.organizationVerificationStatus === 'VERIFIED'
            };
          }
        }

        // 2. Fetch key status
        let keyStatus = 'UNKNOWN';
        if (credObj.issuerKeyId) {
          const key = await IssuerKey.findOne({ keyId: credObj.issuerKeyId });
          if (key) {
            keyStatus = key.status;
          }
        }

        // 3. Quick verification check
        let engineEvaluation = null;
        try {
          engineEvaluation = await verificationEngine.evaluateVerification({ credentialId: credObj.credentialId });
        } catch {
          // Non-blocking for summary list
        }

        return {
          credentialId: credObj.credentialId,
          title: credObj.title || `${credObj.credentialType} Credential`,
          credentialType: credObj.credentialType,
          status: credObj.status,
          issuedAt: credObj.createdAt,
          expiresAt: credObj.expiresAt || null,
          documentId: credObj.documentId,
          issuer: {
            issuerId: credObj.issuerId,
            issuerName: issuer ? issuer.name : 'Unknown',
            status: issuer ? issuer.status : 'UNKNOWN'
          },
          organization: orgInfo,
          keyStatus,
          signatureValid: engineEvaluation?.checks?.digitalSignature?.passed ?? (credObj.signature ? true : false),
          isRevoked: credObj.status === 'REVOKED' || engineEvaluation?.checks?.revocationStatus?.isRevoked || false,
          trustLevel: engineEvaluation?.trustLevel || (credObj.status === 'ACTIVE' ? 'LEVEL 5 CURRENTLY_VALID' : 'LEVEL 0 INVALID'),
          result: engineEvaluation?.result || (credObj.status === 'ACTIVE' ? 'VERIFIED' : 'FAILED'),
          checks: engineEvaluation?.checks || {}
        };
      })
    );

    // Audit log HR lookup event
    await auditService.recordEvent(
      actorUser.userId,
      actorUser.role,
      'HR_CANDIDATE_LOOKUP',
      subject.userId,
      {
        subjectUserId: subject.userId,
        subjectEmail: subject.email,
        credentialsCount: enrichedCredentials.length,
        credentialIds: enrichedCredentials.map((c) => c.credentialId),
        actorRole: actorUser.role
      }
    );

    return {
      subject: {
        userId: subject.userId,
        name: subject.name,
        email: subject.email,
        status: subject.status,
        createdAt: subject.createdAt
      },
      credentials: enrichedCredentials
    };
  }

  /**
   * Run formal HR verification evaluation for a specific credential.
   * @param {object} params
   * @param {string} params.credentialId
   * @param {string} [params.subjectIdOrEmail]
   * @param {object} actorUser
   * @returns {Promise<object>} Full verification evaluation result
   */
  async verifyCandidateCredential({ credentialId, subjectIdOrEmail }, actorUser) {
    if (!credentialId) {
      throw new ValidationError('Credential ID is required for verification', 'CREDENTIAL_ID_REQUIRED');
    }

    const credential = await Credential.findOne({
      $or: [{ credentialId }, { _id: credentialId.match(/^[0-9a-fA-F]{24}$/) ? credentialId : null }]
    });

    if (!credential) {
      throw new NotFoundError(`Credential "${credentialId}" not found`, 'CREDENTIAL_NOT_FOUND');
    }

    let subjectUser = null;
    if (subjectIdOrEmail) {
      const trimmed = subjectIdOrEmail.trim();
      const isEmail = trimmed.includes('@');
      subjectUser = await User.findOne(
        isEmail ? { email: trimmed.toLowerCase() } : { $or: [{ userId: trimmed }, { _id: trimmed.match(/^[0-9a-fA-F]{24}$/) ? trimmed : null }] }
      );

      if (subjectUser && credential.recipientId !== subjectUser.userId) {
        throw new ValidationError(
          `Credential "${credentialId}" does not belong to subject "${subjectUser.email || subjectUser.userId}"`,
          'CREDENTIAL_NOT_OWNED_BY_SUBJECT'
        );
      }
    }

    // Run verification through verification service pipeline
    const verificationResult = await verificationService.evaluateCredentialVerification(
      { credentialId: credential.credentialId },
      actorUser
    );

    // Audit log HR verification action
    await auditService.recordEvent(
      actorUser.userId,
      actorUser.role,
      'HR_CREDENTIAL_VERIFIED',
      credential.credentialId,
      {
        subjectUserId: subjectUser ? subjectUser.userId : credential.recipientId,
        subjectEmail: subjectUser ? subjectUser.email : null,
        result: verificationResult.result,
        trustLevel: verificationResult.trustLevel,
        actorRole: actorUser.role
      }
    );

    return verificationResult;
  }
}

module.exports = new HrService();

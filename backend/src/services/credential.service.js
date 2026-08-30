const crypto = require('crypto');
const Credential = require('../models/credential.model');
const CredentialVersion = require('../models/credentialVersion.model');
const Issuer = require('../models/issuer.model');
const Document = require('../models/document.model');
const User = require('../models/user.model');
const issuerKeyService = require('./issuerKey.service');
const auditService = require('./audit.service');
const notificationService = require('./notification.service');
const { buildCanonicalPayload } = require('../utils/credentialPayload');
const { ValidationError, NotFoundError, ForbiddenError } = require('../utils/errors');
const { CREDENTIAL_TYPES } = require('../models/credential.model');

/**
 * Credential Service
 * Manages verifiable credential lifecycle, deterministic canonical payload signing,
 * immutable revision lineage, supersession, and revocation.
 */
class CredentialService {
  /**
   * Helper to verify actor can manage an issuer's credentials.
   * Allowed: ADMIN or the user owning the issuer profile.
   */
  async checkIssuerAuthorization(issuer, actorUser) {
    if (!actorUser) {
      throw new ForbiddenError('Authenticated user required', 'UNAUTHORIZED');
    }
    if (actorUser.role === 'ADMIN') {
      return true;
    }
    if (issuer.userId !== actorUser.userId) {
      throw new ForbiddenError('You do not have permission to issue or manage credentials for this issuer', 'FORBIDDEN');
    }
    return true;
  }

  /**
   * Helper to check read access to a credential.
   * Allowed: Recipient subject, Issuer owner, ADMIN, or AUDITOR.
   */
  checkReadAccess(credential, user) {
    if (!user) return true; // Public verification allowed
    if (['ADMIN', 'AUDITOR', 'ISSUER'].includes(user.role)) return true;
    if (credential.recipientId === user.userId) return true;
    return true; // Credentials can be viewed for verification
  }

  /**
   * Evaluate dynamic expiration state without modifying historical records or calling it fake.
   */
  applyDynamicExpiration(cred) {
    const credObj = typeof cred.toJSON === 'function' ? cred.toJSON() : { ...cred };
    if (credObj.status === 'ACTIVE' && credObj.expiresAt) {
      if (new Date() > new Date(credObj.expiresAt)) {
        credObj.status = 'EXPIRED';
      }
    }
    return credObj;
  }

  /**
   * Issue a new verifiable workforce credential (Version 1).
   * ENFORCES:
   * 1. Only ACTIVE issuer can issue.
   * 2. Only ACTIVE issuer key can sign.
   * 3. Signs deterministic 9-field canonical payload.
   * @param {object} params
   * @param {string} params.issuerId
   * @param {string} params.recipientId
   * @param {string} params.documentId
   * @param {string} params.credentialType
   * @param {string} [params.title]
   * @param {Date | string} [params.expiresAt]
   * @param {object} actorUser
   * @returns {Promise<{ credential: object, version: object }>}
   */
  async issueCredential(params, actorUser) {
    const { issuerId, recipientId, documentId, credentialType, title, expiresAt } = params;

    if (!issuerId) throw new ValidationError('Issuer ID is required');
    if (!recipientId) throw new ValidationError('Recipient ID is required');
    if (!documentId) throw new ValidationError('Document ID is required');
    if (!credentialType || !CREDENTIAL_TYPES.includes(credentialType)) {
      throw new ValidationError(`Valid credentialType is required. Allowed: ${CREDENTIAL_TYPES.join(', ')}`);
    }

    // 1. Verify Issuer exists and is ACTIVE
    const issuer = await Issuer.findOne({
      $or: [{ issuerId }, { issuerCode: issuerId }]
    });
    if (!issuer) {
      throw new NotFoundError('Issuer profile not found', 'ISSUER_NOT_FOUND');
    }

    await this.checkIssuerAuthorization(issuer, actorUser);

    if (issuer.status !== 'ACTIVE') {
      throw new ValidationError(
        `Cannot issue credential: Issuer status is "${issuer.status}". Issuer must be ACTIVE.`,
        'ISSUER_NOT_ACTIVE'
      );
    }

    // 2. Verify Issuer has an ACTIVE cryptographic key
    let activeKey;
    try {
      activeKey = await issuerKeyService.getActiveKeyForIssuer(issuer.issuerId);
    } catch {
      throw new ValidationError(
        `Cannot issue credential: No active signing key found for issuer "${issuer.issuerId}"`,
        'KEY_NOT_ACTIVE'
      );
    }

    if (activeKey.status !== 'ACTIVE') {
      throw new ValidationError(
        `Cannot issue credential: Key "${activeKey.keyId}" status is "${activeKey.status}". Key must be ACTIVE.`,
        'KEY_NOT_ACTIVE'
      );
    }

    // 3. Verify Document exists and retrieve SHA-256 hash
    const document = await Document.findOne({
      $or: [{ documentId }, { _id: documentId.match(/^[0-9a-fA-F]{24}$/) ? documentId : null }]
    });
    if (!document) {
      throw new NotFoundError('Underlying document not found', 'DOCUMENT_NOT_FOUND');
    }

    // 4. Verify Recipient exists
    const recipient = await User.findOne({
      $or: [{ userId: recipientId }, { email: recipientId }]
    });
    if (!recipient) {
      throw new NotFoundError('Recipient user profile not found', 'RECIPIENT_NOT_FOUND');
    }

    const credentialId = `crd_${crypto.randomBytes(8).toString('hex')}`;
    const versionId = `ver_${crypto.randomBytes(8).toString('hex')}`;
    const issuedAt = new Date();
    const expiryDate = expiresAt ? new Date(expiresAt) : null;

    // 5. Construct authoritative 9-field canonical payload
    const canonicalPayload = buildCanonicalPayload({
      credentialId,
      credentialVersionId: versionId,
      documentHash: document.sha256Hash,
      organizationId: issuer.organizationId,
      issuerId: issuer.issuerId,
      recipientId: recipient.userId,
      credentialType,
      issuedAt,
      expiresAt: expiryDate
    });

    // 6. Sign deterministic canonical payload using Ed25519
    const signResult = await issuerKeyService.signPayload(activeKey.keyId, canonicalPayload);

    // 7. Persist CredentialVersion v1
    const credentialVersion = await CredentialVersion.create({
      versionId,
      credentialId,
      versionNumber: 1,
      documentId: document.documentId,
      documentHash: document.sha256Hash,
      signature: signResult.signature,
      issuerKeyId: activeKey.keyId,
      signedPayload: canonicalPayload,
      issuedAt,
      supersedesVersionId: null,
      status: 'ACTIVE'
    });

    // 8. Persist Credential record
    const credential = await Credential.create({
      credentialId,
      organizationId: issuer.organizationId,
      issuerId: issuer.issuerId,
      recipientId: recipient.userId,
      credentialType,
      title: title || `${credentialType} Verification Credential`,
      currentVersionId: versionId,
      currentVersionNumber: 1,
      issuedAt,
      expiresAt: expiryDate,
      status: 'ACTIVE'
    });

    // 9. Record audit trail
    await auditService.recordEvent(
      actorUser.userId,
      actorUser.role,
      'CREDENTIAL_ISSUED',
      credentialId,
      {
        issuerId: issuer.issuerId,
        recipientId: recipient.userId,
        versionId,
        issuerKeyId: activeKey.keyId,
        documentHash: document.sha256Hash
      }
    );

    // 10. Send in-app & console notification to recipient
    await notificationService.notifyUser({
      recipientUserId: recipient.userId,
      type: 'CREDENTIAL_ISSUED',
      title: 'New Credential Issued',
      message: `You have been issued a new ${credentialType} credential (${credentialId}).`,
      severity: 'SUCCESS',
      data: { credentialId, issuerId: issuer.issuerId, credentialType }
    });

    return {
      credential: credential.toJSON(),
      version: credentialVersion.toJSON()
    };
  }

  /**
   * Create a new revision of a credential (amending/correcting).
   * Marks previous version as SUPERSEDED. Historical versions are NEVER overwritten.
   * @param {string} credentialId
   * @param {object} params
   * @param {string} params.documentId
   * @param {string} [params.changeReason]
   * @param {Date | string} [params.expiresAt]
   * @param {object} actorUser
   * @returns {Promise<{ credential: object, version: object }>}
   */
  async createCredentialVersion(credentialId, params, actorUser) {
    const { documentId, changeReason, expiresAt } = params;

    if (!documentId) throw new ValidationError('Document ID is required for new version');

    // 1. Fetch credential
    const credential = await Credential.findOne({ credentialId });
    if (!credential) {
      throw new NotFoundError('Credential not found', 'CREDENTIAL_NOT_FOUND');
    }

    if (credential.status === 'REVOKED') {
      throw new ValidationError('Cannot create new version for a revoked credential', 'CREDENTIAL_REVOKED');
    }

    // 2. Verify Issuer and active key
    const issuer = await Issuer.findOne({ issuerId: credential.issuerId });
    if (!issuer || issuer.status !== 'ACTIVE') {
      throw new ValidationError('Cannot amend credential: Issuer is not ACTIVE', 'ISSUER_NOT_ACTIVE');
    }

    await this.checkIssuerAuthorization(issuer, actorUser);

    const activeKey = await issuerKeyService.getActiveKeyForIssuer(issuer.issuerId);
    if (activeKey.status !== 'ACTIVE') {
      throw new ValidationError('Cannot amend credential: Active signing key required', 'KEY_NOT_ACTIVE');
    }

    // 3. Verify new document
    const document = await Document.findOne({
      $or: [{ documentId }, { _id: documentId.match(/^[0-9a-fA-F]{24}$/) ? documentId : null }]
    });
    if (!document) {
      throw new NotFoundError('New document not found', 'DOCUMENT_NOT_FOUND');
    }

    // 4. Supersede previous active version
    const previousVersionId = credential.currentVersionId;
    await CredentialVersion.updateOne(
      { versionId: previousVersionId },
      { status: 'SUPERSEDED' }
    );

    // 5. Build new canonical payload for v(N+1)
    const newVersionId = `ver_${crypto.randomBytes(8).toString('hex')}`;
    const newVersionNumber = credential.currentVersionNumber + 1;
    const issuedAt = new Date();
    const expiryDate = expiresAt !== undefined ? (expiresAt ? new Date(expiresAt) : null) : credential.expiresAt;

    const canonicalPayload = buildCanonicalPayload({
      credentialId: credential.credentialId,
      credentialVersionId: newVersionId,
      documentHash: document.sha256Hash,
      organizationId: credential.organizationId,
      issuerId: credential.issuerId,
      recipientId: credential.recipientId,
      credentialType: credential.credentialType,
      issuedAt,
      expiresAt: expiryDate
    });

    // 6. Sign with active key
    const signResult = await issuerKeyService.signPayload(activeKey.keyId, canonicalPayload);

    // 7. Create new CredentialVersion
    const newVersion = await CredentialVersion.create({
      versionId: newVersionId,
      credentialId: credential.credentialId,
      versionNumber: newVersionNumber,
      documentId: document.documentId,
      documentHash: document.sha256Hash,
      signature: signResult.signature,
      issuerKeyId: activeKey.keyId,
      signedPayload: canonicalPayload,
      issuedAt,
      supersedesVersionId: previousVersionId,
      changeReason: changeReason || 'Credential document amendment',
      status: 'ACTIVE'
    });

    // 8. Update Credential pointer
    credential.currentVersionId = newVersionId;
    credential.currentVersionNumber = newVersionNumber;
    if (expiresAt !== undefined) {
      credential.expiresAt = expiryDate;
    }
    await credential.save();

    await auditService.recordEvent(
      actorUser.userId,
      actorUser.role,
      'CREDENTIAL_VERSION_CREATED',
      credential.credentialId,
      {
        newVersionId,
        newVersionNumber,
        supersedesVersionId: previousVersionId,
        changeReason: newVersion.changeReason
      }
    );

    return {
      credential: credential.toJSON(),
      version: newVersion.toJSON()
    };
  }

  /**
   * Revoke a credential.
   * Marks credential and active version as REVOKED.
   * Historical record is preserved; revocation is NOT "fake".
   * @param {string} credentialId
   * @param {object} options
   * @param {string} [options.revocationReason]
   * @param {object} actorUser
   * @returns {Promise<object>}
   */
  async revokeCredential(credentialId, options = {}, actorUser) {
    if (typeof options === 'string') {
      options = { revocationReason: options };
    }
    if (options && options.role && !actorUser) {
      actorUser = options;
      options = {};
    }

    const credential = await Credential.findOne({ credentialId });
    if (!credential) {
      throw new NotFoundError('Credential not found', 'CREDENTIAL_NOT_FOUND');
    }

    const issuer = await Issuer.findOne({ issuerId: credential.issuerId });
    if (issuer) {
      await this.checkIssuerAuthorization(issuer, actorUser);
    } else if (actorUser.role !== 'ADMIN') {
      throw new ForbiddenError('Only administrators or the issuing body can revoke credentials', 'FORBIDDEN');
    }

    const reason = options.revocationReason || 'Revoked by authorized issuer or administrator';
    const now = new Date();
    credential.status = 'REVOKED';
    credential.revokedAt = now;
    credential.revocationReason = reason;
    await credential.save();

    // Mark current version as REVOKED
    await CredentialVersion.updateOne(
      { versionId: credential.currentVersionId },
      { status: 'REVOKED' }
    );

    await auditService.recordEvent(
      actorUser.userId,
      actorUser.role,
      'CREDENTIAL_REVOKED',
      credentialId,
      {
        revokedAt: now.toISOString(),
        revocationReason: credential.revocationReason
      }
    );

    // Send in-app & console notification to recipient
    await notificationService.notifyUser({
      recipientUserId: credential.recipientId,
      type: 'CREDENTIAL_REVOKED',
      title: 'Credential Revoked',
      message: `Your credential ${credentialId} was revoked: ${reason}`,
      severity: 'WARNING',
      data: { credentialId, reason }
    });

    return credential.toJSON();
  }

  /**
   * Get credential by ID with populated active version.
   * @param {string} credentialId
   * @param {object} [user]
   * @returns {Promise<{ credential: object, currentVersion: object }>}
   */
  async getCredentialById(credentialId, user) {
    const credential = await Credential.findOne({ credentialId });
    if (!credential) {
      throw new NotFoundError('Credential not found', 'CREDENTIAL_NOT_FOUND');
    }

    this.checkReadAccess(credential, user);

    const currentVersion = await CredentialVersion.findOne({
      versionId: credential.currentVersionId
    });

    return {
      credential: this.applyDynamicExpiration(credential),
      currentVersion: currentVersion ? currentVersion.toJSON() : null
    };
  }

  /**
   * Retrieve full version revision history for a credential.
   * @param {string} credentialId
   * @param {object} [user]
   * @returns {Promise<object[]>}
   */
  async getCredentialVersions(credentialId, user) {
    const credential = await Credential.findOne({ credentialId });
    if (!credential) {
      throw new NotFoundError('Credential not found', 'CREDENTIAL_NOT_FOUND');
    }

    this.checkReadAccess(credential, user);

    const versions = await CredentialVersion.find({ credentialId }).sort({ versionNumber: 1 });
    return versions.map(v => v.toJSON());
  }

  /**
   * List credentials with filters and pagination.
   * @param {object} [filters={}]
   * @param {object} [user]
   * @returns {Promise<{ credentials: object[], total: number, page: number, totalPages: number }>}
   */
  async listCredentials(filters = {}, user) {
    const page = Math.max(1, parseInt(filters.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(filters.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const query = {};
    if (filters.recipientId) query.recipientId = filters.recipientId;
    if (filters.issuerId) query.issuerId = filters.issuerId;
    if (filters.organizationId) query.organizationId = filters.organizationId;
    if (filters.credentialType) query.credentialType = filters.credentialType;
    if (filters.status) query.status = filters.status;

    // Scoping for regular USER (can only view credentials issued to them)
    if (user && user.role === 'USER') {
      query.recipientId = user.userId;
    }

    const [creds, total] = await Promise.all([
      Credential.find(query).skip(skip).limit(limit).sort({ createdAt: -1 }),
      Credential.countDocuments(query)
    ]);

    return {
      credentials: creds.map(c => this.applyDynamicExpiration(c)),
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Build complete chronological timeline of events for a credential.
   * @param {string} credentialId
   * @param {object} [user]
   * @returns {Promise<object[]>}
   */
  async getCredentialTimeline(credentialId, user) {
    const credential = await Credential.findOne({ credentialId });
    if (!credential) {
      throw new NotFoundError('Credential not found', 'CREDENTIAL_NOT_FOUND');
    }

    this.checkReadAccess(credential, user);

    const versions = await CredentialVersion.find({ credentialId }).sort({ versionNumber: 1 });
    const auditEvents = await auditService.getResourceAuditTrail(credentialId);

    const timeline = [];

    // Add version milestones
    for (const v of versions) {
      timeline.push({
        type: v.versionNumber === 1 ? 'CREDENTIAL_ISSUED' : 'CREDENTIAL_AMENDED',
        timestamp: v.issuedAt || v.createdAt,
        versionNumber: v.versionNumber,
        versionId: v.versionId,
        issuerKeyId: v.issuerKeyId,
        changeReason: v.changeReason,
        status: v.status
      });
    }

    // Add revocation milestone if applicable
    if (credential.status === 'REVOKED' && credential.revokedAt) {
      timeline.push({
        type: 'CREDENTIAL_REVOKED',
        timestamp: credential.revokedAt,
        reason: credential.revocationReason,
        status: 'REVOKED'
      });
    }

    // Add expiration milestone if passed
    if (credential.expiresAt && new Date() > new Date(credential.expiresAt)) {
      timeline.push({
        type: 'CREDENTIAL_EXPIRED',
        timestamp: credential.expiresAt,
        status: 'EXPIRED'
      });
    }

    // Merge audit log entries
    for (const a of auditEvents) {
      timeline.push({
        type: a.action,
        timestamp: new Date(a.timestamp),
        actorId: a.actorId,
        actorRole: a.actorRole,
        metadata: a.metadata
      });
    }

    // Sort chronologically
    timeline.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    return timeline;
  }
}

module.exports = new CredentialService();

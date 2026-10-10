const crypto = require('crypto');
const Issuer = require('../models/issuer.model');
const Organization = require('../models/organization.model');
const User = require('../models/user.model');
const auditService = require('./audit.service');
const notificationService = require('./notification.service');
const { ValidationError, ConflictError, NotFoundError, ForbiddenError } = require('../utils/errors');

/**
 * Issuer Service
 * Manages issuer profile registration, accreditation approval, and trust state lifecycle.
 */
class IssuerService {
  /**
   * Request issuer authorization for an organization.
   * SECURITY RULE:
   * 1. Public / user requests always start in PENDING status.
   * 2. Exactly one issuer profile per user.
   * 3. Target organization MUST be VERIFIED.
   * @param {object} params
   * @param {string} params.organizationId
   * @param {string} [params.issuerCode]
   * @param {object} [params.authorizationEvidence]
   * @param {object} user - Authenticated user
   * @returns {Promise<object>}
   */
  async registerIssuer({ organizationId, issuerCode, authorizationEvidence }, user) {
    if (!user || !user.userId) {
      throw new ForbiddenError('Authenticated user required', 'UNAUTHORIZED');
    }

    if (!organizationId) {
      throw new ValidationError('Organization ID or code is required');
    }

    // Constraint: One user may have at most ONE issuer profile
    const existingIssuer = await Issuer.findOne({ userId: user.userId });
    if (existingIssuer) {
      throw new ConflictError(
        'User already has an issuer profile registered. Only one issuer profile per user is permitted.',
        'DUPLICATE_ISSUER_PROFILE'
      );
    }

    // Constraint: Organization must exist and be VERIFIED
    let org = await Organization.findOne({
      $or: [
        { organizationId },
        { organizationCode: organizationId.toUpperCase() }
      ]
    });
    if (!org && organizationId.match(/^[0-9a-fA-F]{24}$/)) {
      org = await Organization.findById(organizationId);
    }

    if (!org) {
      throw new NotFoundError('Target organization not found', 'ORGANIZATION_NOT_FOUND');
    }

    if (org.organizationVerificationStatus !== 'VERIFIED' || org.status !== 'ACTIVE') {
      throw new ValidationError(
        `Cannot register an issuer for organization "${org.name}" because its status is ${org.organizationVerificationStatus}. Organization must be VERIFIED.`,
        'ORGANIZATION_NOT_VERIFIED'
      );
    }

    // Determine or generate unique issuer code
    let code = issuerCode;
    if (code && typeof code === 'string' && code.trim().length > 0) {
      code = code.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
      const duplicateCode = await Issuer.findOne({ issuerCode: code });
      if (duplicateCode) {
        throw new ConflictError(`Issuer code "${code}" is already in use`, 'DUPLICATE_ISSUER_CODE');
      }
    } else {
      code = `ISS_${org.organizationCode}_${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    }

    // Enforce initial PENDING status (Users can never make themselves ACTIVE)
    const issuer = await Issuer.create({
      issuerCode: code,
      userId: user.userId,
      organizationId: org.organizationId,
      authorizationEvidence: authorizationEvidence || {},
      status: 'PENDING'
    });

    await auditService.recordEvent(
      user.userId,
      user.role,
      'ISSUER_REGISTERED',
      issuer.issuerId,
      {
        issuerCode: code,
        organizationId: org.organizationId,
        status: 'PENDING'
      }
    );

    return issuer.toJSON();
  }

  /**
   * Find issuer by issuerId, issuerCode, or _id.
   * @param {string} identifier
   * @returns {Promise<object>}
   */
  async getIssuerById(identifier) {
    if (!identifier) {
      throw new ValidationError('Issuer identifier is required');
    }

    let issuer = await Issuer.findOne({
      $or: [{ issuerId: identifier }, { issuerCode: identifier.toUpperCase() }]
    });

    if (!issuer && identifier.match(/^[0-9a-fA-F]{24}$/)) {
      issuer = await Issuer.findById(identifier);
    }

    if (!issuer) {
      throw new NotFoundError('Issuer profile not found', 'ISSUER_NOT_FOUND');
    }

    return issuer.toJSON();
  }

  /**
   * Find issuer profile belonging to a user.
   * @param {string} userId
   * @returns {Promise<object>}
   */
  async getIssuerByUserId(userId) {
    const issuer = await Issuer.findOne({ userId });
    if (!issuer) {
      throw new NotFoundError('No issuer profile found for this user', 'ISSUER_NOT_FOUND');
    }

    return issuer.toJSON();
  }

  /**
   * List issuers with filtering and pagination.
   * @param {object} [filters={}]
   * @returns {Promise<{ issuers: object[], total: number, page: number, totalPages: number }>}
   */
  async listIssuers(filters = {}) {
    const page = Math.max(1, parseInt(filters.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(filters.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const query = {};
    if (filters.status) query.status = filters.status;
    if (filters.organizationId) query.organizationId = filters.organizationId;

    const [issuers, total] = await Promise.all([
      Issuer.find(query).skip(skip).limit(limit).sort({ createdAt: -1 }),
      Issuer.countDocuments(query)
    ]);

    return {
      issuers: issuers.map(i => i.toJSON()),
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Approve issuer authorization (ADMIN only).
   * Transitions status to ACTIVE and promotes user role to ISSUER.
   * @param {string} identifier
   * @param {object} [options={}]
   * @param {object} adminUser
   * @returns {Promise<object>}
   */
  async approveIssuer(identifier, options = {}, adminUser) {
    if (options && options.role && !adminUser) {
      adminUser = options;
      options = {};
    }

    if (!adminUser || adminUser.role !== 'ADMIN') {
      throw new ForbiddenError('Only administrators can approve issuers', 'FORBIDDEN');
    }

    let issuer = await Issuer.findOne({
      $or: [{ issuerId: identifier }, { issuerCode: identifier.toUpperCase() }]
    });
    if (!issuer && identifier.match(/^[0-9a-fA-F]{24}$/)) {
      issuer = await Issuer.findById(identifier);
    }

    if (!issuer) {
      throw new NotFoundError('Issuer profile not found', 'ISSUER_NOT_FOUND');
    }

    if (issuer.status === 'ACTIVE') {
      throw new ValidationError('Issuer is already approved');
    }

    const org = await Organization.findOne({
      $or: [{ organizationId: issuer.organizationId }, { organizationCode: issuer.organizationId }]
    });

    if (!org || org.organizationVerificationStatus !== 'VERIFIED') {
      throw new ValidationError('Cannot approve issuer: Organization is not verified');
    }

    issuer.status = 'ACTIVE';
    issuer.approvedBy = adminUser.userId;
    issuer.approvedAt = new Date();
    await issuer.save();

    // Promote user role to ISSUER and link organizationId
    await User.updateOne(
      { userId: issuer.userId },
      { role: 'ISSUER', organizationId: org._id }
    );

    await auditService.recordEvent(
      adminUser.userId,
      adminUser.role,
      'ISSUER_APPROVED',
      issuer.issuerId,
      {
        approvedBy: adminUser.userId,
        targetUserId: issuer.userId,
        organizationId: issuer.organizationId
      }
    );

    if (issuer.userId) {
      await notificationService.notifyUser({
        recipientUserId: issuer.userId,
        type: 'ISSUER_APPROVED',
        title: 'Issuer Accreditation Approved',
        message: `Your issuer profile for "${issuer.name}" has been approved.`,
        severity: 'SUCCESS',
        data: { issuerId: issuer.issuerId, organizationId: issuer.organizationId }
      });
    }

    return issuer.toJSON();
  }

  /**
   * Suspend an issuer (ADMIN only).
   * @param {string} identifier
   * @param {object} [options={}]
   * @param {object} adminUser
   * @returns {Promise<object>}
   */
  async suspendIssuer(identifier, options = {}, adminUser) {
    if (options && options.role && !adminUser) {
      adminUser = options;
      options = {};
    }

    if (!adminUser || adminUser.role !== 'ADMIN') {
      throw new ForbiddenError('Only administrators can suspend issuers', 'FORBIDDEN');
    }

    let issuer = await Issuer.findOne({
      $or: [{ issuerId: identifier }, { issuerCode: identifier.toUpperCase() }]
    });
    if (!issuer && identifier.match(/^[0-9a-fA-F]{24}$/)) {
      issuer = await Issuer.findById(identifier);
    }

    if (!issuer) {
      throw new NotFoundError('Issuer profile not found', 'ISSUER_NOT_FOUND');
    }

    issuer.status = 'SUSPENDED';
    await issuer.save();

    await auditService.recordEvent(
      adminUser.userId,
      adminUser.role,
      'ISSUER_SUSPENDED',
      issuer.issuerId,
      { reason: options.reason || 'Administrative suspension' }
    );

    if (issuer.userId) {
      await notificationService.notifyUser({
        recipientUserId: issuer.userId,
        type: 'ISSUER_SUSPENDED',
        title: 'Issuer Accreditation Suspended',
        message: `Your issuer profile for "${issuer.name}" was suspended: ${options.reason || 'Administrative suspension'}`,
        severity: 'WARNING',
        data: { issuerId: issuer.issuerId }
      });
    }

    return issuer.toJSON();
  }

  /**
   * Revoke an issuer (ADMIN only).
   * Demotes user role from ISSUER back to USER.
   * @param {string} identifier
   * @param {object} [options={}]
   * @param {object} adminUser
   * @returns {Promise<object>}
   */
  async revokeIssuer(identifier, options = {}, adminUser) {
    if (options && options.role && !adminUser) {
      adminUser = options;
      options = {};
    }

    if (!adminUser || adminUser.role !== 'ADMIN') {
      throw new ForbiddenError('Only administrators can revoke issuers', 'FORBIDDEN');
    }

    let issuer = await Issuer.findOne({
      $or: [{ issuerId: identifier }, { issuerCode: identifier.toUpperCase() }]
    });
    if (!issuer && identifier.match(/^[0-9a-fA-F]{24}$/)) {
      issuer = await Issuer.findById(identifier);
    }

    if (!issuer) {
      throw new NotFoundError('Issuer profile not found', 'ISSUER_NOT_FOUND');
    }

    issuer.status = 'REVOKED';
    await issuer.save();

    // Revert user role back to USER if currently ISSUER
    await User.updateOne(
      { userId: issuer.userId, role: 'ISSUER' },
      { role: 'USER' }
    );

    await auditService.recordEvent(
      adminUser.userId,
      adminUser.role,
      'ISSUER_REVOKED',
      issuer.issuerId,
      { reason: options.reason || 'Accreditation revoked' }
    );

    if (issuer.userId) {
      await notificationService.notifyUser({
        recipientUserId: issuer.userId,
        type: 'ISSUER_REVOKED',
        title: 'Issuer Accreditation Revoked',
        message: `Your issuer profile for "${issuer.name}" was revoked: ${options.reason || 'Accreditation revoked'}`,
        severity: 'CRITICAL',
        data: { issuerId: issuer.issuerId }
      });
    }

    return issuer.toJSON();
  }

  /**
   * Lookup candidate recipient by email and return their uploaded document metadata (no raw binary content).
   * Restricted to ISSUER and ADMIN roles. Writes an audit log entry on lookup.
   * @param {string} email
   * @param {object} actorUser
   * @returns {Promise<{ found: boolean, recipient: object|null, documents: object[] }>}
   */
  async lookupRecipientByEmail(email, actorUser) {
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      throw new ValidationError('A valid recipient email address is required', 'INVALID_EMAIL');
    }

    const User = require('../models/user.model');
    const Document = require('../models/document.model');

    const recipient = await User.findOne({ email: email.toLowerCase().trim() });
    if (!recipient) {
      return {
        found: false,
        recipient: null,
        documents: []
      };
    }

    // Retrieve document metadata only (no file binary content)
    const documents = await Document.find(
      { uploadedBy: recipient.userId },
      { originalFilename: 1, mimeType: 1, fileSize: 1, sha256Hash: 1, representationType: 1, createdAt: 1, documentId: 1 }
    ).sort({ createdAt: -1 });

    // Privacy audit log entry whenever issuer queries recipient uploads
    await auditService.recordEvent(
      actorUser.userId,
      actorUser.role,
      'RECIPIENT_UPLOADS_VIEWED',
      recipient.userId,
      {
        recipientUserId: recipient.userId,
        recipientEmail: recipient.email,
        documentsCount: documents.length,
        actorRole: actorUser.role
      }
    );

    return {
      found: true,
      recipient: {
        userId: recipient.userId,
        name: recipient.name,
        email: recipient.email,
        status: recipient.status
      },
      documents: documents.map((d) => d.toJSON())
    };
  }
}

module.exports = new IssuerService();


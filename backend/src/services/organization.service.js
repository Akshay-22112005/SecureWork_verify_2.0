const crypto = require('crypto');
const Organization = require('../models/organization.model');
const Issuer = require('../models/issuer.model');
const { ORGANIZATION_TYPES, VERIFICATION_STATUSES } = require('../models/organization.model');
const auditService = require('./audit.service');
const notificationService = require('./notification.service');
const { ValidationError, ConflictError, NotFoundError, ForbiddenError } = require('../utils/errors');

/**
 * Organization Service
 * Manages institutional registration, trust verification, suspension, and revocation.
 */
class OrganizationService {
  /**
   * Helper to normalize domains (strips protocol, port, path, www).
   */
  normalizeDomain(domain) {
    if (!domain || typeof domain !== 'string') return '';
    let clean = domain.trim().toLowerCase();
    clean = clean.replace(/^(https?:\/\/)?(www\.)?/, '');
    clean = clean.split('/')[0].split(':')[0];
    return clean;
  }

  /**
   * Register a new organization.
   * SECURITY RULE: All organizations are created in "PENDING" trust state.
   * Domains are NEVER automatically trusted without explicit administrative verification.
   * @param {object} data
   * @param {object} creatorUser
   * @returns {Promise<object>}
   */
  async createOrganization(data, creatorUser) {
    const { name, type, officialDomain, verificationEvidence, contactEmail } = data;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      throw new ValidationError('Organization name is required');
    }

    if (!type || !ORGANIZATION_TYPES.includes(type)) {
      throw new ValidationError(`Valid organization type required. Allowed types: ${ORGANIZATION_TYPES.join(', ')}`);
    }

    const cleanDomain = this.normalizeDomain(officialDomain);
    if (!cleanDomain || !cleanDomain.includes('.')) {
      throw new ValidationError('A valid official domain is required (e.g. university.edu)');
    }

    // Generate or format uppercase code
    let code = data.organizationCode || data.code;
    if (code && typeof code === 'string' && code.trim().length > 0) {
      code = code.trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    } else {
      const prefix = cleanDomain.split('.')[0].toUpperCase().slice(0, 8);
      code = `ORG_${prefix}_${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    }

    // Check code uniqueness
    const existingCode = await Organization.findOne({
      $or: [{ organizationCode: code }, { code }]
    });
    if (existingCode) {
      throw new ConflictError(`Organization code "${code}" is already in use`, 'DUPLICATE_ORG_CODE');
    }

    // Check domain uniqueness
    const existingDomain = await Organization.findOne({ officialDomain: cleanDomain });
    if (existingDomain) {
      throw new ConflictError(`Official domain "${cleanDomain}" is already registered`, 'DUPLICATE_DOMAIN');
    }

    // Enforce initial PENDING trust state
    const organization = await Organization.create({
      organizationCode: code,
      name: name.trim(),
      type,
      officialDomain: cleanDomain,
      organizationVerificationStatus: 'PENDING',
      verificationMethods: ['ADMIN_REVIEW'],
      verificationEvidence: verificationEvidence || {},
      status: 'PENDING',
      contactEmail: contactEmail ? contactEmail.toLowerCase().trim() : undefined,
      createdBy: creatorUser ? creatorUser.userId : null
    });

    // Record audit trail event
    await auditService.recordEvent(
      creatorUser ? creatorUser.userId : 'SYSTEM',
      creatorUser ? creatorUser.role : 'USER',
      'ORGANIZATION_CREATED',
      organization.organizationId,
      { organizationCode: code, officialDomain: cleanDomain, type }
    );

    return organization.toJSON();
  }

  /**
   * Find an organization by organizationId, organizationCode, or _id.
   * @param {string} identifier
   * @returns {Promise<object>}
   */
  async getOrganization(identifier) {
    if (!identifier) {
      throw new ValidationError('Organization identifier is required');
    }

    let org = await Organization.findOne({
      $or: [
        { organizationId: identifier },
        { organizationCode: identifier.toUpperCase() }
      ]
    });

    if (!org && identifier.match(/^[0-9a-fA-F]{24}$/)) {
      org = await Organization.findById(identifier);
    }

    if (!org) {
      throw new NotFoundError('Organization not found', 'ORGANIZATION_NOT_FOUND');
    }

    return org.toJSON();
  }

  /**
   * List organizations with filtering and pagination.
   * @param {object} [filters={}]
   * @returns {Promise<{ organizations: object[], total: number, page: number, totalPages: number }>}
   */
  async listOrganizations(filters = {}) {
    const page = Math.max(1, parseInt(filters.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(filters.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const query = {};
    if (filters.status) query.status = filters.status;
    if (filters.organizationVerificationStatus) {
      query.organizationVerificationStatus = filters.organizationVerificationStatus;
    }
    if (filters.type) query.type = filters.type;

    const [orgs, total] = await Promise.all([
      Organization.find(query).skip(skip).limit(limit).sort({ createdAt: -1 }),
      Organization.countDocuments(query)
    ]);

    return {
      organizations: orgs.map(o => o.toJSON()),
      total,
      page,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * Verify an organization (ADMIN only).
   * Transitions trust state to VERIFIED and status to ACTIVE.
   * @param {string} identifier
   * @param {object} [options={}]
   * @param {object} adminUser
   * @returns {Promise<object>}
   */
  async verifyOrganization(identifier, options = {}, adminUser) {
    if (!adminUser || adminUser.role !== 'ADMIN') {
      throw new ForbiddenError('Only administrators can verify organizations', 'FORBIDDEN');
    }

    let org = await Organization.findOne({
      $or: [{ organizationId: identifier }, { organizationCode: identifier.toUpperCase() }]
    });
    if (!org && identifier.match(/^[0-9a-fA-F]{24}$/)) {
      org = await Organization.findById(identifier);
    }

    if (!org) {
      throw new NotFoundError('Organization not found', 'ORGANIZATION_NOT_FOUND');
    }

    org.organizationVerificationStatus = 'VERIFIED';
    org.status = 'ACTIVE';
    org.verifiedBy = adminUser.userId;
    org.verifiedAt = new Date();
    org.verificationMethods = ['ADMIN_REVIEW'];

    if (options.verificationEvidence) {
      org.verificationEvidence = {
        ...org.verificationEvidence,
        ...options.verificationEvidence
      };
    }

    await org.save();

    await auditService.recordEvent(
      adminUser.userId,
      adminUser.role,
      'ORGANIZATION_VERIFIED',
      org.organizationId,
      {
        verifiedBy: adminUser.userId,
        verificationMethod: 'ADMIN_REVIEW'
      }
    );

    const creatorId = org.createdBy || org.createdById;
    if (creatorId) {
      await notificationService.notifyUser({
        recipientUserId: creatorId,
        type: 'ORGANIZATION_VERIFIED',
        title: 'Organization Verified',
        message: `Your organization "${org.name}" has been verified.`,
        severity: 'SUCCESS',
        data: { organizationId: org.organizationId }
      });
    }

    return org.toJSON();
  }

  /**
   * Suspend an organization (ADMIN only).
   * Cascades suspension to all member issuers.
   * @param {string} identifier
   * @param {object} [options={}]
   * @param {object} adminUser
   * @returns {Promise<object>}
   */
  async suspendOrganization(identifier, options = {}, adminUser) {
    if (!adminUser || adminUser.role !== 'ADMIN') {
      throw new ForbiddenError('Only administrators can suspend organizations', 'FORBIDDEN');
    }

    let org = await Organization.findOne({
      $or: [{ organizationId: identifier }, { organizationCode: identifier.toUpperCase() }]
    });
    if (!org && identifier.match(/^[0-9a-fA-F]{24}$/)) {
      org = await Organization.findById(identifier);
    }

    if (!org) {
      throw new NotFoundError('Organization not found', 'ORGANIZATION_NOT_FOUND');
    }

    org.organizationVerificationStatus = 'SUSPENDED';
    org.status = 'SUSPENDED';
    await org.save();

    // Cascade suspension to all member issuers
    await Issuer.updateMany(
      { organizationId: { $in: [org.organizationId, org.organizationCode] } },
      { status: 'SUSPENDED' }
    );

    await auditService.recordEvent(
      adminUser.userId,
      adminUser.role,
      'ORGANIZATION_SUSPENDED',
      org.organizationId,
      { reason: options.reason || 'Administrative action' }
    );

    const creatorId = org.createdBy || org.createdById;
    if (creatorId) {
      await notificationService.notifyUser({
        recipientUserId: creatorId,
        type: 'ORGANIZATION_SUSPENDED',
        title: 'Organization Suspended',
        message: `Your organization "${org.name}" was suspended: ${options.reason || 'Administrative action'}`,
        severity: 'WARNING',
        data: { organizationId: org.organizationId }
      });
    }

    return org.toJSON();
  }

  /**
   * Revoke an organization (ADMIN only).
   * Cascades revocation to all member issuers.
   * @param {string} identifier
   * @param {object} [options={}]
   * @param {object} adminUser
   * @returns {Promise<object>}
   */
  async revokeOrganization(identifier, options = {}, adminUser) {
    if (!adminUser || adminUser.role !== 'ADMIN') {
      throw new ForbiddenError('Only administrators can revoke organizations', 'FORBIDDEN');
    }

    let org = await Organization.findOne({
      $or: [{ organizationId: identifier }, { organizationCode: identifier.toUpperCase() }]
    });
    if (!org && identifier.match(/^[0-9a-fA-F]{24}$/)) {
      org = await Organization.findById(identifier);
    }

    if (!org) {
      throw new NotFoundError('Organization not found', 'ORGANIZATION_NOT_FOUND');
    }

    org.organizationVerificationStatus = 'REVOKED';
    org.status = 'REVOKED';
    await org.save();

    // Cascade revocation to all member issuers
    await Issuer.updateMany(
      { organizationId: { $in: [org.organizationId, org.organizationCode] } },
      { status: 'REVOKED' }
    );

    await auditService.recordEvent(
      adminUser.userId,
      adminUser.role,
      'ORGANIZATION_REVOKED',
      org.organizationId,
      { reason: options.reason || 'Revocation of accreditation' }
    );

    const revokeCreatorId = org.createdBy || org.createdById;
    if (revokeCreatorId) {
      await notificationService.notifyUser({
        recipientUserId: revokeCreatorId,
        type: 'ORGANIZATION_REVOKED',
        title: 'Organization Revoked',
        message: `Your organization "${org.name}" was revoked: ${options.reason || 'Revocation of accreditation'}`,
        severity: 'CRITICAL',
        data: { organizationId: org.organizationId }
      });
    }

    return org.toJSON();
  }
}

module.exports = new OrganizationService();

const TrustedSource = require('../models/trustedSource.model');
const Organization = require('../models/organization.model');
const auditService = require('./audit.service');
const { getSourceAdapter } = require('./sources');
const { validateUrlForSsrf } = require('../utils/ssrfProtection');
const { ValidationError, NotFoundError, ForbiddenError } = require('../utils/errors');

/**
 * Trusted Source Service
 * Governs official registry integrations, SSRF-protected domain validation,
 * and authoritative source verification queries.
 */
class TrustedSourceService {
  /**
   * Register a new official trusted source.
   * Starts in PENDING state; cannot be used until ADMIN approves.
   * @param {object} data
   * @param {object} user
   * @returns {Promise<object>}
   */
  async createTrustedSource(data, user) {
    if (!user) {
      throw new ForbiddenError('Authentication required to register trusted source', 'UNAUTHORIZED');
    }

    const { sourceCode, organizationId, name, sourceType, baseUrl, verificationEndpoint } = data;

    if (!sourceCode) throw new ValidationError('sourceCode is required');
    if (!organizationId) throw new ValidationError('organizationId is required');
    if (!name) throw new ValidationError('name is required');
    if (!baseUrl) throw new ValidationError('baseUrl is required');

    // 1. Verify parent Organization exists
    const organization = await Organization.findOne({
      $or: [{ organizationId }, { organizationCode: organizationId }]
    });
    if (!organization) {
      throw new NotFoundError('Associated organization not found', 'ORGANIZATION_NOT_FOUND');
    }

    // 2. Validate URL structure
    let parsedUrl;
    try {
      parsedUrl = new URL(baseUrl);
    } catch {
      throw new ValidationError('Invalid baseUrl format provided', 'INVALID_URL');
    }

    const cleanDomain = parsedUrl.hostname.toLowerCase();

    // 3. Prevent duplicate sourceCode
    const existing = await TrustedSource.findOne({ sourceCode: sourceCode.toUpperCase() });
    if (existing) {
      throw new ValidationError(`TrustedSource with code "${sourceCode.toUpperCase()}" already exists`, 'DUPLICATE_SOURCE');
    }

    // 4. Create in PENDING state
    const source = await TrustedSource.create({
      sourceCode: sourceCode.toUpperCase(),
      organizationId: organization.organizationId,
      name,
      sourceType: sourceType || 'OFFICIAL_WEBSITE',
      baseUrl: parsedUrl.toString(),
      verificationEndpoint: verificationEndpoint || '/verify',
      domain: cleanDomain,
      verificationMethod: 'ADMIN_REVIEW',
      verificationStatus: 'PENDING',
      status: 'PENDING'
    });

    await auditService.recordEvent(
      user.userId,
      user.role,
      'TRUSTED_SOURCE_REGISTERED',
      source.sourceCode,
      {
        name,
        domain: cleanDomain,
        organizationId: organization.organizationId
      }
    );

    return source.toJSON();
  }

  /**
   * Approve a trusted source (Admin only).
   * @param {string} idOrCode
   * @param {object} user
   * @returns {Promise<object>}
   */
  async approveTrustedSource(idOrCode, user) {
    if (!user || user.role !== 'ADMIN') {
      throw new ForbiddenError('Only administrators can approve official trusted sources', 'FORBIDDEN');
    }

    const source = await this.getSourceByIdOrCode(idOrCode);

    source.status = 'ACTIVE';
    source.verificationStatus = 'VERIFIED';
    source.verifiedBy = user.userId;
    source.verifiedAt = new Date();
    await source.save();

    await auditService.recordEvent(
      user.userId,
      user.role,
      'TRUSTED_SOURCE_APPROVED',
      source.sourceCode,
      {
        status: source.status,
        verificationStatus: source.verificationStatus
      }
    );

    return source.toJSON();
  }

  /**
   * Suspend a trusted source.
   * @param {string} idOrCode
   * @param {string} reason
   * @param {object} user
   * @returns {Promise<object>}
   */
  async suspendTrustedSource(idOrCode, reason, user) {
    if (!user || user.role !== 'ADMIN') {
      throw new ForbiddenError('Only administrators can suspend trusted sources', 'FORBIDDEN');
    }

    const source = await this.getSourceByIdOrCode(idOrCode);
    source.status = 'SUSPENDED';
    await source.save();

    await auditService.recordEvent(
      user.userId,
      user.role,
      'TRUSTED_SOURCE_SUSPENDED',
      source.sourceCode,
      { reason: reason || 'Administrative suspension' }
    );

    return source.toJSON();
  }

  /**
   * Revoke a trusted source.
   * @param {string} idOrCode
   * @param {string} reason
   * @param {object} user
   * @returns {Promise<object>}
   */
  async revokeTrustedSource(idOrCode, reason, user) {
    if (!user || user.role !== 'ADMIN') {
      throw new ForbiddenError('Only administrators can revoke trusted sources', 'FORBIDDEN');
    }

    const source = await this.getSourceByIdOrCode(idOrCode);
    source.status = 'REVOKED';
    source.verificationStatus = 'FAILED';
    await source.save();

    await auditService.recordEvent(
      user.userId,
      user.role,
      'TRUSTED_SOURCE_REVOKED',
      source.sourceCode,
      { reason: reason || 'Administrative revocation' }
    );

    return source.toJSON();
  }

  /**
   * Verify domain and SSL reachability via SSRF protection.
   * @param {string} idOrCode
   * @param {object} user
   * @returns {Promise<object>}
   */
  async verifyDomain(idOrCode, user) {
    const source = await this.getSourceByIdOrCode(idOrCode);

    // Validate using SSRF utility
    await validateUrlForSsrf(source.baseUrl, source.domain);

    source.lastCheckedAt = new Date();
    await source.save();

    return {
      sourceCode: source.sourceCode,
      domain: source.domain,
      verified: true,
      lastCheckedAt: source.lastCheckedAt
    };
  }

  /**
   * Query an official source for credential verification.
   * Strictly enforces: Only registered, active, verified TrustedSource records can be used.
   * Never trusts arbitrary user-supplied URLs.
   * @param {string} sourceCode
   * @param {object} queryParams
   * @param {object} [user]
   * @returns {Promise<object>}
   */
  async querySourceVerification(sourceCode, queryParams, user = null) {
    if (!sourceCode) {
      throw new ValidationError('sourceCode is required to query an official source');
    }

    const source = await TrustedSource.findOne({ sourceCode: sourceCode.toUpperCase() });
    if (!source) {
      throw new NotFoundError(
        `Official source "${sourceCode}" is not registered in the trusted sources catalog`,
        'UNSUPPORTED_SOURCE'
      );
    }

    if (source.status !== 'ACTIVE' || source.verificationStatus !== 'VERIFIED') {
      throw new ValidationError(
        `Source "${source.name}" is not active or verified (Status: ${source.status}, Verification: ${source.verificationStatus})`,
        'UNTRUSTED_ORIGIN'
      );
    }

    const adapter = getSourceAdapter();
    const result = await adapter.verifyRecord(source, queryParams || {});

    await auditService.recordEvent(
      user ? user.userId : 'PUBLIC_VERIFIER',
      user ? user.role : 'USER',
      'SOURCE_VERIFICATION_PERFORMED',
      source.sourceCode,
      {
        sourceState: result.sourceState,
        verified: result.verified,
        responseHash: result.responseHash
      }
    );

    return {
      sourceCode: source.sourceCode,
      sourceName: source.name,
      domain: source.domain,
      sourceType: source.sourceType,
      ...result
    };
  }

  /**
   * Lookup trusted source by ID or sourceCode.
   * @param {string} idOrCode
   * @returns {Promise<object>}
   */
  async getSourceByIdOrCode(idOrCode) {
    if (!idOrCode) throw new ValidationError('Source identifier is required');

    const source = await TrustedSource.findOne({
      $or: [
        { sourceCode: idOrCode.toUpperCase() },
        { _id: idOrCode.match(/^[0-9a-fA-F]{24}$/) ? idOrCode : null }
      ]
    });

    if (!source) {
      throw new NotFoundError('Trusted source record not found', 'SOURCE_NOT_FOUND');
    }

    return source;
  }

  /**
   * List trusted sources with filters.
   * @param {object} filters
   * @returns {Promise<object[]>}
   */
  async listTrustedSources(filters = {}) {
    const query = {};
    if (filters.status) query.status = filters.status;
    if (filters.organizationId) query.organizationId = filters.organizationId;
    if (filters.sourceType) query.sourceType = filters.sourceType;

    const sources = await TrustedSource.find(query).sort({ createdAt: -1 });
    return sources.map(s => s.toJSON());
  }
}

module.exports = new TrustedSourceService();

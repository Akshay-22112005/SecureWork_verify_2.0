const crypto = require('crypto');
const organizationService = require('../services/organization.service');
const Organization = require('../models/organization.model');
const User = require('../models/user.model');
const TrustedSource = require('../models/trustedSource.model');
const emailService = require('../services/email.service');
const auditService = require('../services/audit.service');
const { successResponse } = require('../utils/response');
const { NotFoundError, ValidationError } = require('../utils/errors');
const { isValidEmail } = require('../utils/validation');

async function findOrganization(identifier) {
  const clauses = [{ organizationId: identifier }, { organizationCode: identifier.toUpperCase() }];
  if (/^[0-9a-fA-F]{24}$/.test(identifier)) clauses.push({ _id: identifier });
  const organization = await Organization.findOne({ $or: clauses });
  if (!organization) throw new NotFoundError('Organization not found', 'ORGANIZATION_NOT_FOUND');
  return organization;
}

async function findUser(identifier) {
  let user = await User.findOne({ userId: identifier });
  if (!user && /^[0-9a-fA-F]{24}$/.test(identifier)) user = await User.findById(identifier);
  if (!user) throw new NotFoundError('User not found', 'USER_NOT_FOUND');
  return user;
}

function parseCsv(text) {
  const records = [];
  let row = [];
  let value = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const character = text[i];
    if (character === '"') {
      if (quoted && text[i + 1] === '"') {
        value += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === ',' && !quoted) {
      row.push(value);
      value = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && text[i + 1] === '\n') i += 1;
      row.push(value);
      if (row.some((cell) => cell.trim())) records.push(row);
      row = [];
      value = '';
    } else {
      value += character;
    }
  }
  if (quoted) throw new ValidationError('CSV contains an unterminated quoted field');
  row.push(value);
  if (row.some((cell) => cell.trim())) records.push(row);
  if (records.length < 2) return [];

  const headers = records[0].map((header, index) => (index === 0 ? header.replace(/^\uFEFF/, '') : header).trim().toLowerCase());
  const nameIndex = headers.indexOf('name');
  const emailIndex = headers.indexOf('email');
  const roleIndex = headers.indexOf('role');
  if (nameIndex < 0 || emailIndex < 0) throw new ValidationError('CSV headers must include name and email');
  return records.slice(1).map((cells) => ({
    name: cells[nameIndex] || '',
    email: cells[emailIndex] || '',
    role: roleIndex >= 0 ? cells[roleIndex] : undefined
  }));
}

function getBulkRows(req) {
  let rows = Array.isArray(req.body) ? req.body : req.body?.rows;
  if (typeof rows === 'string') {
    try { rows = JSON.parse(rows); } catch { rows = null; }
  }
  if (Array.isArray(rows)) return rows;
  const csvText = req.file?.buffer?.toString('utf8') || req.body?.csv || req.body?.text;
  if (typeof csvText === 'string') return parseCsv(csvText);
  throw new ValidationError('Provide user rows as JSON or upload/paste CSV data');
}

const INVITATION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

async function sendInvitationForUser(user, organization, inviteToken) {
  user.invitationToken = inviteToken;
  user.invitationExpiresAt = new Date(Date.now() + INVITATION_TTL_MS);
  await user.save();
  await emailService.sendOrganizationInvitation({
    email: user.email,
    name: user.name,
    organizationName: organization.name,
    inviteToken,
    role: user.role
  });
}

/** List users assigned to an organization (GET /api/admin/organizations/:id/users). */
async function getOrganizationUsers(req, res, next) {
  try {
    const organization = await findOrganization(req.params.id);
    const users = await User.find({ organizationId: organization._id })
      .select('_id userId name email role status createdAt')
      .sort({ createdAt: -1 });
    return successResponse(res, { users }, 200);
  } catch (err) {
    next(err);
  }
}

/** Search an exact email while distinguishing unregistered and already-scoped accounts. */
async function searchOrganizationUser(req, res, next) {
  try {
    const email = String(req.query.email || '').trim().toLowerCase();
    if (!isValidEmail(email)) throw new ValidationError('A valid email address is required');
    const organization = await findOrganization(req.params.id);
    const user = await User.findOne({ email }).select('_id userId name email role status organizationId');
    if (!user) return successResponse(res, { found: false, available: false, user: null }, 200);
    const available = !user.organizationId || String(user.organizationId) === String(organization._id);
    return successResponse(res, {
      found: true,
      available,
      user: available ? user.toJSON() : { name: user.name, email: user.email },
      message: available ? null : 'This account is already assigned to another organization.'
    }, 200);
  } catch (err) {
    next(err);
  }
}

/** Assign or update an organization's user role (POST /api/admin/organizations/:id/users). */
async function assignUserToOrganization(req, res, next) {
  try {
    const { userId, role = 'ISSUER' } = req.body;
    if (!userId) throw new ValidationError('userId is required');
    if (!['ISSUER', 'MEMBER'].includes(role)) throw new ValidationError('role must be ISSUER or MEMBER');
    const [organization, user] = await Promise.all([
      findOrganization(req.params.id),
      findUser(userId)
    ]);
    user.organizationId = organization._id;
    user.role = role;
    await user.save();
    return successResponse(res, { user: user.toJSON() }, 200);
  } catch (err) {
    next(err);
  }
}

/** Revoke a user's organization access (DELETE /api/admin/organizations/:id/users/:userId). */
async function removeUserFromOrganization(req, res, next) {
  try {
    const organization = await findOrganization(req.params.id);
    const user = await findUser(req.params.userId);
    if (String(user.organizationId) !== String(organization._id)) {
      throw new NotFoundError('User is not assigned to this organization', 'USER_NOT_FOUND');
    }
    user.organizationId = null;
    user.role = 'USER';
    user.invitationToken = null;
    user.invitationExpiresAt = null;
    await user.save();
    return successResponse(res, { user: user.toJSON() }, 200);
  } catch (err) {
    next(err);
  }
}

/** Bulk import existing organization users and invite new accounts from JSON or CSV. */
async function bulkUploadOrganizationUsers(req, res, next) {
  try {
    const organization = await findOrganization(req.params.id);
    const rows = getBulkRows(req);
    const summary = { successCount: 0, invitedCount: 0, existingUpdatedCount: 0, errors: [] };
    const seenEmails = new Set();

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index] || {};
      const email = String(row.email || '').trim().toLowerCase();
      const name = String(row.name || '').trim();
      const role = String(row.role || 'ISSUER').trim().toUpperCase();
      try {
        if (!name) throw new ValidationError('Name is required');
        if (!isValidEmail(email)) throw new ValidationError('A valid email address is required');
        if (!['ISSUER', 'MEMBER'].includes(role)) throw new ValidationError('Role must be ISSUER or MEMBER');
        if (seenEmails.has(email)) throw new ValidationError('Email is duplicated in this CSV');
        seenEmails.add(email);

        let user = await User.findOne({ email });
        if (user) {
          user.organizationId = organization._id;
          user.role = role;
          if (user.status === 'PENDING_INVITE') {
            // Reimports should recover invitations whose previous email dispatch stalled or failed.
            const inviteToken = crypto.randomBytes(32).toString('hex');
            await sendInvitationForUser(user, organization, inviteToken);
            summary.invitedCount += 1;
          } else {
            user.status = 'ACTIVE';
            user.invitationToken = null;
            user.invitationExpiresAt = null;
            await user.save();
          }
          summary.existingUpdatedCount += 1;
        } else {
          const inviteToken = crypto.randomBytes(32).toString('hex');
          user = await User.create({
            name,
            email,
            organizationId: organization._id,
            role,
            status: 'PENDING_INVITE',
            passwordHash: null,
            invitationToken: inviteToken,
            invitationExpiresAt: new Date(Date.now() + INVITATION_TTL_MS)
          });
          await emailService.sendOrganizationInvitation({
            email,
            name,
            organizationName: organization.name,
            inviteToken,
            role
          });
          summary.invitedCount += 1;
        }
        summary.successCount += 1;
      } catch (err) {
        summary.errors.push({ row: index + 2, email: email || null, message: err.message || 'Unable to process row' });
      }
    }

    await auditService.recordEvent(
      req.user?.userId || req.user?.id,
      req.user?.role || 'ADMIN',
      'ORG_USER_BULK_INVITED',
      organization.organizationId,
      { ...summary, organizationId: organization.organizationId }
    );
    return successResponse(res, summary, 200);
  } catch (err) {
    next(err);
  }
}

/** Regenerate and resend a pending user's organization invitation. */
async function resendUserInvitation(req, res, next) {
  try {
    const organization = await findOrganization(req.params.id);
    const user = await findUser(req.params.userId);
    if (String(user.organizationId) !== String(organization._id) || user.status !== 'PENDING_INVITE') {
      throw new NotFoundError('Pending organization invitation not found', 'INVITATION_NOT_FOUND');
    }
    const inviteToken = crypto.randomBytes(32).toString('hex');
    await sendInvitationForUser(user, organization, inviteToken);
    return successResponse(res, { message: 'Invitation resent successfully' }, 200);
  } catch (err) {
    next(err);
  }
}

/** Create a trust source scoped to the organization in the route. */
async function createOrganizationTrustedSource(req, res, next) {
  try {
    const organization = await findOrganization(req.params.id);
    const name = String(req.body?.name || '').trim();
    const sourceType = String(req.body?.sourceType || '').trim().toUpperCase();
    const baseUrl = String(req.body?.baseUrl || req.body?.endpointUrl || '').trim();
    if (!name) throw new ValidationError('Source name is required');
    if (!TrustedSource.SOURCE_TYPES.includes(sourceType)) throw new ValidationError('A valid source type is required');
    let parsedUrl;
    try { parsedUrl = new URL(baseUrl); } catch { throw new ValidationError('A valid endpoint URL is required'); }
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) throw new ValidationError('Endpoint URL must use HTTP or HTTPS');

    const source = await TrustedSource.create({
      sourceCode: `SRC_${crypto.randomBytes(8).toString('hex').toUpperCase()}`,
      organizationId: organization.organizationId,
      name,
      sourceType,
      baseUrl,
      domain: parsedUrl.hostname.toLowerCase(),
      status: 'ACTIVE',
      verificationStatus: 'VERIFIED'
    });
    await auditService.recordEvent(
      req.user?.userId || req.user?.id,
      req.user?.role || 'ADMIN',
      'TRUST_SOURCE_REGISTERED',
      source.sourceCode,
      { organizationId: organization.organizationId, sourceCode: source.sourceCode, name, sourceType, baseUrl }
    );
    return successResponse(res, { source }, 201);
  } catch (err) {
    next(err);
  }
}

/** Verify and activate a trusted source owned by the organization in the route. */
async function verifyOrganizationTrustedSource(req, res, next) {
  try {
    const organization = await findOrganization(req.params.id);
    const sourceLookup = /^[0-9a-fA-F]{24}$/.test(req.params.sourceId)
      ? { $or: [{ _id: req.params.sourceId }, { sourceCode: req.params.sourceId }] }
      : { sourceCode: req.params.sourceId };
    const source = await TrustedSource.findOne({
      ...sourceLookup,
      organizationId: organization.organizationId
    });
    if (!source) throw new NotFoundError('Trusted source not found for this organization', 'TRUSTED_SOURCE_NOT_FOUND');

    source.status = 'ACTIVE';
    source.verificationStatus = 'VERIFIED';
    source.verifiedBy = req.user?.userId || req.user?.id || null;
    source.verifiedAt = new Date();
    await source.save();
    await auditService.recordEvent(
      req.user?.userId || req.user?.id,
      req.user?.role || 'ADMIN',
      'TRUST_SOURCE_VERIFIED',
      source.sourceCode,
      { organizationId: organization.organizationId, sourceCode: source.sourceCode }
    );
    return successResponse(res, { source }, 200);
  } catch (err) {
    next(err);
  }
}

/** Invite a single unregistered email and pre-bind it to the organization. */
async function inviteUserToOrganization(req, res, next) {
  try {
    const organization = await findOrganization(req.params.id);
    const email = String(req.body?.email || '').trim().toLowerCase();
    const role = String(req.body?.role || 'ISSUER').trim().toUpperCase();
    if (!isValidEmail(email)) throw new ValidationError('A valid email address is required');
    if (!['ISSUER', 'MEMBER'].includes(role)) throw new ValidationError('Role must be ISSUER or MEMBER');

    let user = await User.findOne({ email });
    let invitationSent = false;
    if (user?.status === 'PENDING_INVITE') {
      user.organizationId = organization._id;
      user.role = role;
      const inviteToken = crypto.randomBytes(32).toString('hex');
      await sendInvitationForUser(user, organization, inviteToken);
      invitationSent = true;
    } else if (user) {
      user.organizationId = organization._id;
      user.role = role;
      user.status = 'ACTIVE';
      user.invitationToken = null;
      user.invitationExpiresAt = null;
      await user.save();
    } else {
      const inviteToken = crypto.randomBytes(32).toString('hex');
      const name = String(req.body?.name || email.split('@')[0]).trim();
      user = await User.create({
        name,
        email,
        organizationId: organization._id,
        role,
        status: 'PENDING_INVITE',
        passwordHash: null,
        invitationToken: inviteToken,
        invitationExpiresAt: new Date(Date.now() + INVITATION_TTL_MS)
      });
      await emailService.sendOrganizationInvitation({
        email,
        name,
        organizationName: organization.name,
        inviteToken,
        role
      });
      invitationSent = true;
    }

    await auditService.recordEvent(
      req.user?.userId || req.user?.id,
      req.user?.role || 'ADMIN',
      'ORG_USER_INVITED',
      organization.organizationId,
      { userId: user.userId, email, role, status: user.status, invitationSent }
    );
    return successResponse(res, {
      message: invitationSent ? 'Invitation sent successfully' : 'Existing user added to organization successfully',
      user: user.toJSON()
    }, 200);
  } catch (err) {
    next(err);
  }
}

/**
 * Create a new organization (POST /api/organizations).
 * Starts in PENDING trust state.
 */
async function createOrganization(req, res, next) {
  try {
    const org = await organizationService.createOrganization(req.body, req.user);
    return successResponse(res, { organization: org }, 201);
  } catch (err) {
    next(err);
  }
}

/**
 * List organizations (GET /api/organizations).
 */
async function listOrganizations(req, res, next) {
  try {
    const result = await organizationService.listOrganizations(req.query);
    return successResponse(res, result, 200);
  } catch (err) {
    next(err);
  }
}

/**
 * Get organization by id or code (GET /api/organizations/:id).
 */
async function getOrganization(req, res, next) {
  try {
    const org = await organizationService.getOrganization(req.params.id);
    return successResponse(res, { organization: org }, 200);
  } catch (err) {
    next(err);
  }
}

/**
 * Verify an organization (POST /api/organizations/:id/verify).
 * ADMIN only.
 */
async function verifyOrganization(req, res, next) {
  try {
    const org = await organizationService.verifyOrganization(req.params.id, req.body, req.user);
    return successResponse(res, { organization: org }, 200);
  } catch (err) {
    next(err);
  }
}

/**
 * Suspend an organization (PATCH /api/organizations/:id/suspend).
 * ADMIN only.
 */
async function suspendOrganization(req, res, next) {
  try {
    const org = await organizationService.suspendOrganization(req.params.id, req.body, req.user);
    return successResponse(res, { organization: org }, 200);
  } catch (err) {
    next(err);
  }
}

/**
 * Revoke an organization (PATCH /api/organizations/:id/revoke).
 * ADMIN only.
 */
async function revokeOrganization(req, res, next) {
  try {
    const org = await organizationService.revokeOrganization(req.params.id, req.body, req.user);
    return successResponse(res, { organization: org }, 200);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createOrganization,
  listOrganizations,
  getOrganization,
  verifyOrganization,
  suspendOrganization,
  revokeOrganization,
  getOrganizationUsers,
  searchOrganizationUser,
  assignUserToOrganization,
  removeUserFromOrganization,
  bulkUploadOrganizationUsers,
  resendUserInvitation,
  createOrganizationTrustedSource,
  verifyOrganizationTrustedSource,
  inviteUserToOrganization
};

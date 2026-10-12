const organizationService = require('../services/organization.service');
const Organization = require('../models/organization.model');
const User = require('../models/user.model');
const { successResponse } = require('../utils/response');
const { NotFoundError, ValidationError } = require('../utils/errors');

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
    await user.save();
    return successResponse(res, { user: user.toJSON() }, 200);
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
  assignUserToOrganization,
  removeUserFromOrganization
};

const organizationService = require('../services/organization.service');
const { successResponse } = require('../utils/response');

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
  revokeOrganization
};

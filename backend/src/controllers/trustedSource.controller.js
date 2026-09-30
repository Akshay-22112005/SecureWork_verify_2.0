const trustedSourceService = require('../services/trustedSource.service');
const { successResponse } = require('../utils/response');

/**
 * Register a new trusted source (POST /api/trusted-sources).
 */
async function createTrustedSource(req, res, next) {
  try {
    const source = await trustedSourceService.createTrustedSource(req.body, req.user);
    return successResponse(res, { trustedSource: source }, 201);
  } catch (err) {
    next(err);
  }
}

/**
 * List trusted sources (GET /api/trusted-sources).
 */
async function listTrustedSources(req, res, next) {
  try {
    const sources = await trustedSourceService.listTrustedSources(req.query);
    return successResponse(res, { trustedSources: sources, sources }, 200);
  } catch (err) {
    next(err);
  }
}

/**
 * Get trusted source details (GET /api/trusted-sources/:id).
 */
async function getTrustedSource(req, res, next) {
  try {
    const source = await trustedSourceService.getSourceByIdOrCode(req.params.id);
    return successResponse(res, { trustedSource: source.toJSON() }, 200);
  } catch (err) {
    next(err);
  }
}

/**
 * Approve trusted source (PATCH /api/trusted-sources/:id/approve).
 */
async function approveTrustedSource(req, res, next) {
  try {
    const source = await trustedSourceService.approveTrustedSource(req.params.id, req.user);
    return successResponse(res, { trustedSource: source }, 200);
  } catch (err) {
    next(err);
  }
}

/**
 * Suspend trusted source (PATCH /api/trusted-sources/:id/suspend).
 */
async function suspendTrustedSource(req, res, next) {
  try {
    const source = await trustedSourceService.suspendTrustedSource(req.params.id, req.body.reason, req.user);
    return successResponse(res, { trustedSource: source }, 200);
  } catch (err) {
    next(err);
  }
}

/**
 * Revoke trusted source (PATCH /api/trusted-sources/:id/revoke).
 */
async function revokeTrustedSource(req, res, next) {
  try {
    const source = await trustedSourceService.revokeTrustedSource(req.params.id, req.body.reason, req.user);
    return successResponse(res, { trustedSource: source }, 200);
  } catch (err) {
    next(err);
  }
}

/**
 * Run SSRF-protected domain validation (POST /api/trusted-sources/:id/verify-domain).
 */
async function verifyDomain(req, res, next) {
  try {
    const result = await trustedSourceService.verifyDomain(req.params.id, req.user);
    return successResponse(res, result, 200);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createTrustedSource,
  listTrustedSources,
  getTrustedSource,
  approveTrustedSource,
  suspendTrustedSource,
  revokeTrustedSource,
  verifyDomain
};

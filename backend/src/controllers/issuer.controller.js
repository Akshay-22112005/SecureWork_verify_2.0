const issuerService = require('../services/issuer.service');
const { successResponse } = require('../utils/response');

/**
 * Register as an issuer for an organization (POST /api/issuers/register).
 * Creates issuer in PENDING status.
 */
async function registerIssuer(req, res, next) {
  try {
    const issuer = await issuerService.registerIssuer(req.body, req.user);
    return successResponse(res, { issuer }, 201);
  } catch (err) {
    next(err);
  }
}

/**
 * List issuers (GET /api/issuers).
 */
async function listIssuers(req, res, next) {
  try {
    const result = await issuerService.listIssuers(req.query);
    return successResponse(res, result, 200);
  } catch (err) {
    next(err);
  }
}

/**
 * Get own issuer profile (GET /api/issuers/me).
 */
async function getMyIssuerProfile(req, res, next) {
  try {
    const issuer = await issuerService.getIssuerByUserId(req.user.userId);
    return successResponse(res, { issuer }, 200);
  } catch (err) {
    next(err);
  }
}

/**
 * Get issuer by identifier (GET /api/issuers/:id).
 */
async function getIssuerById(req, res, next) {
  try {
    const issuer = await issuerService.getIssuerById(req.params.id);
    return successResponse(res, { issuer }, 200);
  } catch (err) {
    next(err);
  }
}

/**
 * Approve issuer authorization (PATCH /api/issuers/:id/approve).
 * ADMIN only.
 */
async function approveIssuer(req, res, next) {
  try {
    const issuer = await issuerService.approveIssuer(req.params.id, req.body, req.user);
    return successResponse(res, { issuer }, 200);
  } catch (err) {
    next(err);
  }
}

/**
 * Suspend issuer (PATCH /api/issuers/:id/suspend).
 * ADMIN only.
 */
async function suspendIssuer(req, res, next) {
  try {
    const issuer = await issuerService.suspendIssuer(req.params.id, req.body, req.user);
    return successResponse(res, { issuer }, 200);
  } catch (err) {
    next(err);
  }
}

/**
 * Revoke issuer (PATCH /api/issuers/:id/revoke).
 * ADMIN only.
 */
async function revokeIssuer(req, res, next) {
  try {
    const issuer = await issuerService.revokeIssuer(req.params.id, req.body, req.user);
    return successResponse(res, { issuer }, 200);
  } catch (err) {
    next(err);
  }
}

/**
 * Lookup recipient user and uploaded documents (GET /api/issuers/recipients/lookup?email=...).
 * Restricted to ISSUER and ADMIN roles.
 */
async function lookupRecipient(req, res, next) {
  try {
    const result = await issuerService.lookupRecipientByEmail(req.query.email, req.user);
    return successResponse(res, result, 200);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  registerIssuer,
  listIssuers,
  getMyIssuerProfile,
  getIssuerById,
  approveIssuer,
  suspendIssuer,
  revokeIssuer,
  lookupRecipient
};


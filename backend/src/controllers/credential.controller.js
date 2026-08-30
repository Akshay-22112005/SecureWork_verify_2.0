const credentialService = require('../services/credential.service');
const { successResponse } = require('../utils/response');

/**
 * Issue a new credential (POST /api/credentials/issue).
 */
async function issueCredential(req, res, next) {
  try {
    const result = await credentialService.issueCredential(req.body, req.user);
    return successResponse(res, result, 201);
  } catch (err) {
    next(err);
  }
}

/**
 * List credentials (GET /api/credentials).
 */
async function listCredentials(req, res, next) {
  try {
    const result = await credentialService.listCredentials(req.query, req.user);
    return successResponse(res, result, 200);
  } catch (err) {
    next(err);
  }
}

/**
 * Get credential details and active version (GET /api/credentials/:id).
 */
async function getCredential(req, res, next) {
  try {
    const result = await credentialService.getCredentialById(req.params.id, req.user);
    return successResponse(res, result, 200);
  } catch (err) {
    next(err);
  }
}

/**
 * Get credential version history (GET /api/credentials/:id/versions).
 */
async function getCredentialVersions(req, res, next) {
  try {
    const versions = await credentialService.getCredentialVersions(req.params.id, req.user);
    return successResponse(res, { versions }, 200);
  } catch (err) {
    next(err);
  }
}

/**
 * Create a new version/amendment for a credential (POST /api/credentials/:id/versions).
 */
async function createCredentialVersion(req, res, next) {
  try {
    const result = await credentialService.createCredentialVersion(req.params.id, req.body, req.user);
    return successResponse(res, result, 201);
  } catch (err) {
    next(err);
  }
}

/**
 * Revoke a credential (PATCH /api/credentials/:id/revoke).
 */
async function revokeCredential(req, res, next) {
  try {
    const credential = await credentialService.revokeCredential(req.params.id, req.body, req.user);
    return successResponse(res, { credential }, 200);
  } catch (err) {
    next(err);
  }
}

/**
 * Get credential timeline (GET /api/credentials/:id/timeline).
 */
async function getCredentialTimeline(req, res, next) {
  try {
    const timeline = await credentialService.getCredentialTimeline(req.params.id, req.user);
    return successResponse(res, { timeline }, 200);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  issueCredential,
  listCredentials,
  getCredential,
  getCredentialVersions,
  createCredentialVersion,
  revokeCredential,
  getCredentialTimeline
};

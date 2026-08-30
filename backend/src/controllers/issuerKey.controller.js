const issuerKeyService = require('../services/issuerKey.service');
const { successResponse } = require('../utils/response');

/**
 * List public issuer keys (GET /api/issuer-keys).
 */
async function listKeys(req, res, next) {
  try {
    const result = await issuerKeyService.listKeys(req.query);
    return successResponse(res, result, 200);
  } catch (err) {
    next(err);
  }
}

/**
 * Get public key metadata by keyId (GET /api/issuer-keys/:id).
 */
async function getKeyById(req, res, next) {
  try {
    const key = await issuerKeyService.getKeyById(req.params.id);
    return successResponse(res, { key }, 200);
  } catch (err) {
    next(err);
  }
}

/**
 * Rotate an issuer's key (POST /api/issuers/:id/rotate-key).
 */
async function rotateIssuerKey(req, res, next) {
  try {
    const key = await issuerKeyService.rotateIssuerKey(req.params.id, req.user);
    return successResponse(res, { key }, 200);
  } catch (err) {
    next(err);
  }
}

/**
 * Generate initial key for an issuer (POST /api/issuers/:id/keys).
 */
async function generateKey(req, res, next) {
  try {
    const key = await issuerKeyService.generateKeyForIssuer(req.params.id, req.user);
    return successResponse(res, { key }, 201);
  } catch (err) {
    next(err);
  }
}

/**
 * Mark key as compromised (PATCH /api/issuer-keys/:id/compromise).
 */
async function compromiseKey(req, res, next) {
  try {
    const key = await issuerKeyService.compromiseKey(req.params.id, req.body, req.user);
    return successResponse(res, { key }, 200);
  } catch (err) {
    next(err);
  }
}

/**
 * Revoke key (PATCH /api/issuer-keys/:id/revoke).
 */
async function revokeKey(req, res, next) {
  try {
    const key = await issuerKeyService.revokeKey(req.params.id, req.body, req.user);
    return successResponse(res, { key }, 200);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listKeys,
  getKeyById,
  rotateIssuerKey,
  generateKey,
  compromiseKey,
  revokeKey
};

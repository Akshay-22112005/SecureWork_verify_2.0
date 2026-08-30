const verificationService = require('../services/verification.service');
const trustedSourceService = require('../services/trustedSource.service');
const { successResponse } = require('../utils/response');

/**
 * List verifications (GET /api/verifications).
 */
async function listVerifications(req, res, next) {
  try {
    const verifications = await verificationService.listVerifications(req.query);
    return successResponse(res, { verifications }, 200);
  } catch (err) {
    next(err);
  }
}

/**
 * Run verification evaluation on a credential (POST /api/verifications/evaluate).
 */
async function evaluateVerification(req, res, next) {
  try {
    const result = await verificationService.evaluateCredentialVerification(req.body, req.user);
    return successResponse(res, result, 200);
  } catch (err) {
    next(err);
  }
}

/**
 * Query an official trusted source for verification evidence (POST /api/verifications/verify-source).
 */
async function verifySource(req, res, next) {
  try {
    const { sourceCode, queryParams } = req.body;
    const result = await trustedSourceService.querySourceVerification(sourceCode, queryParams, req.user);
    return successResponse(res, result, 200);
  } catch (err) {
    next(err);
  }
}

/**
 * Get past verification details (GET /api/verifications/:id).
 */
async function getVerification(req, res, next) {
  try {
    const verification = await verificationService.getVerificationById(req.params.id);
    return successResponse(res, { verification }, 200);
  } catch (err) {
    next(err);
  }
}

/**
 * Get discrete historical evidence records for a verification (GET /api/verifications/:id/evidence).
 */
async function getVerificationEvidence(req, res, next) {
  try {
    const evidence = await verificationService.getEvidenceForVerification(req.params.id);
    return successResponse(res, { evidence }, 200);
  } catch (err) {
    next(err);
  }
}

/**
 * Submit manual human verification review (POST /api/verifications/:id/manual-review).
 */
async function submitManualReview(req, res, next) {
  try {
    const verification = await verificationService.submitManualReview(req.params.id, req.body, req.user);
    return successResponse(res, { verification }, 200);
  } catch (err) {
    next(err);
  }
}

/**
 * Get all verifications performed on a credential (GET /api/verifications/credential/:credentialId).
 */
async function getCredentialVerifications(req, res, next) {
  try {
    const verifications = await verificationService.getVerificationsForCredential(req.params.credentialId);
    return successResponse(res, { verifications }, 200);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listVerifications,
  evaluateVerification,
  verifySource,
  getVerification,
  getVerificationEvidence,
  submitManualReview,
  getCredentialVerifications
};

const hrService = require('../services/hr.service');
const { successResponse } = require('../utils/response');

/**
 * Get subject user and their associated credentials (GET /api/hr/subjects/:userIdOrEmail/credentials).
 * RBAC: ADMIN, HR.
 */
async function getSubjectCredentials(req, res, next) {
  try {
    const result = await hrService.getSubjectCredentials(req.params.userIdOrEmail, req.user);
    return successResponse(res, result, 200);
  } catch (err) {
    next(err);
  }
}

/**
 * Execute verification on a candidate credential (POST /api/hr/verify).
 * RBAC: ADMIN, HR.
 */
async function verifyCandidateCredential(req, res, next) {
  try {
    const result = await hrService.verifyCandidateCredential(req.body, req.user);
    return successResponse(res, result, 200);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getSubjectCredentials,
  verifyCandidateCredential
};

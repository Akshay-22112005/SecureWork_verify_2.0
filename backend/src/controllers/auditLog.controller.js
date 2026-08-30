const auditService = require('../services/audit.service');
const { successResponse } = require('../utils/response');

/**
 * List paginated audit logs (GET /api/audit-logs).
 * RBAC: ADMIN, AUDITOR.
 */
async function listAuditLogs(req, res, next) {
  try {
    const result = await auditService.listLogs(req.query);
    return successResponse(res, result, 200);
  } catch (err) {
    next(err);
  }
}

/**
 * Run cryptographic hash chain validation (GET /api/audit-logs/validate).
 * Detects: modified records, deleted records, reordered records, broken previousHash, sequence gaps.
 * RBAC: ADMIN, AUDITOR.
 */
async function validateAuditChain(req, res, next) {
  try {
    const report = await auditService.validateChain();
    return successResponse(res, { validation: report }, 200);
  } catch (err) {
    next(err);
  }
}

/**
 * Create an internal audit checkpoint (POST /api/audit-logs/checkpoint).
 * RBAC: ADMIN, AUDITOR.
 */
async function createAuditCheckpoint(req, res, next) {
  try {
    const checkpoint = await auditService.createCheckpoint(req.body || {}, req.user);
    return successResponse(res, { checkpoint }, 201);
  } catch (err) {
    next(err);
  }
}

/**
 * List audit checkpoints (GET /api/audit-logs/checkpoints).
 * RBAC: ADMIN, AUDITOR.
 */
async function listAuditCheckpoints(req, res, next) {
  try {
    const checkpoints = await auditService.listCheckpoints();
    return successResponse(res, { checkpoints }, 200);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listAuditLogs,
  validateAuditChain,
  createAuditCheckpoint,
  listAuditCheckpoints
};

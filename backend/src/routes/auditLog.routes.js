const express = require('express');
const auditLogController = require('../controllers/auditLog.controller');
const { authenticateUser, requireRole } = require('../middleware/auth');

const router = express.Router();

// Strict RBAC: Audit trails and chain validation are restricted to ADMIN and AUDITOR
router.use(authenticateUser);
router.use(requireRole('ADMIN', 'AUDITOR'));

// Validate hash chain integrity (detects modifications, deletions, reorderings, broken hashes)
router.get('/validate', auditLogController.validateAuditChain);

// Create an internal audit checkpoint
router.post('/checkpoint', auditLogController.createAuditCheckpoint);

// List checkpoints
router.get('/checkpoints', auditLogController.listAuditCheckpoints);

// List paginated audit records (NOTE: NO UPDATE OR DELETE ROUTES EXIST)
router.get('/', auditLogController.listAuditLogs);

module.exports = router;

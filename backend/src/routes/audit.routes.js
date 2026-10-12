const express = require('express');
const auditController = require('../controllers/audit.controller');
const { authenticateUser, requireRole } = require('../middleware/auth');

const router = express.Router();

router.patch(
  '/evidence/:id/approve',
  authenticateUser,
  requireRole('ADMIN', 'AUDITOR'),
  auditController.approveEvidence
);

module.exports = router;

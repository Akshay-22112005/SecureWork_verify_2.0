const express = require('express');
const trustedSourceController = require('../controllers/trustedSource.controller');
const { authenticateUser, requireRole } = require('../middleware/auth');

const router = express.Router();

// List trusted sources
router.get('/', trustedSourceController.listTrustedSources);

// Get single trusted source by id or code
router.get('/:id', trustedSourceController.getTrustedSource);

// Register a new trusted source (authenticated)
router.post('/', authenticateUser, trustedSourceController.createTrustedSource);

// Governance lifecycle actions (Admin only)
router.patch('/:id/approve', authenticateUser, requireRole('ADMIN'), trustedSourceController.approveTrustedSource);
router.patch('/:id/suspend', authenticateUser, requireRole('ADMIN'), trustedSourceController.suspendTrustedSource);
router.patch('/:id/revoke', authenticateUser, requireRole('ADMIN'), trustedSourceController.revokeTrustedSource);
router.post('/:id/verify-domain', authenticateUser, requireRole('ADMIN'), trustedSourceController.verifyDomain);

module.exports = router;

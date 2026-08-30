const express = require('express');
const organizationController = require('../controllers/organization.controller');
const { authenticateUser, requireRole } = require('../middleware/auth');

const router = express.Router();

// Public / Authenticated read routes
router.get('/', organizationController.listOrganizations);
router.get('/:id', organizationController.getOrganization);

// Protected routes (creation requires active user)
router.post('/', authenticateUser, organizationController.createOrganization);

// Admin-only Trust Lifecycle Management
router.post('/:id/verify', authenticateUser, requireRole('ADMIN'), organizationController.verifyOrganization);
router.patch('/:id/suspend', authenticateUser, requireRole('ADMIN'), organizationController.suspendOrganization);
router.patch('/:id/revoke', authenticateUser, requireRole('ADMIN'), organizationController.revokeOrganization);

module.exports = router;

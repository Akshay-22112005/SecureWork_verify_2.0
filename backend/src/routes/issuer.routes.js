const express = require('express');
const issuerController = require('../controllers/issuer.controller');
const issuerKeyController = require('../controllers/issuerKey.controller');
const { authenticateUser, requireRole } = require('../middleware/auth');

const router = express.Router();

// All issuer endpoints require authentication
router.use(authenticateUser);

// User requests issuer authorization
router.post('/register', issuerController.registerIssuer);

// Issuer views own profile
router.get('/me', issuerController.getMyIssuerProfile);

// Individual profile query
router.get('/:id', issuerController.getIssuerById);

// Issuer listing (authenticated)
router.get('/', issuerController.listIssuers);

// Admin-only Approval and Trust Lifecycle Management
router.patch('/:id/approve', requireRole('ADMIN'), issuerController.approveIssuer);
router.patch('/:id/suspend', requireRole('ADMIN'), issuerController.suspendIssuer);
router.patch('/:id/revoke', requireRole('ADMIN'), issuerController.revokeIssuer);

// Key Management endpoints
router.post('/:id/keys', issuerKeyController.generateKey);
router.post('/:id/rotate-key', issuerKeyController.rotateIssuerKey);

module.exports = router;

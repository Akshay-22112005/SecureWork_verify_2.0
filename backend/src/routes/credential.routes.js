const express = require('express');
const credentialController = require('../controllers/credential.controller');
const { authenticateUser, requireRole } = require('../middleware/auth');

const router = express.Router();

// All credential endpoints require authentication
router.use(authenticateUser);

// Issue new credential (Version 1) - ADMIN or ISSUER
router.post('/issue', requireRole('ADMIN', 'ISSUER'), credentialController.issueCredential);

// Bulk issue credentials via CSV - ADMIN or ISSUER
router.post('/bulk-issue', requireRole('ADMIN', 'ISSUER'), credentialController.bulkIssue);

// Simulate tampering test for live demo - ADMIN or ISSUER
router.post('/:id/simulate-tamper', requireRole('ADMIN', 'ISSUER'), credentialController.simulateTamper);

// List credentials (subject to role/user scoping)
router.get('/', credentialController.listCredentials);

// Inspect credential timeline
router.get('/:id/timeline', credentialController.getCredentialTimeline);

// Version management
router.get('/:id/versions', credentialController.getCredentialVersions);
router.post('/:id/versions', requireRole('ADMIN', 'ISSUER'), credentialController.createCredentialVersion);

// Revoke credential - ADMIN or ISSUER
router.patch('/:id/revoke', requireRole('ADMIN', 'ISSUER'), credentialController.revokeCredential);

// View credential details and current version
router.get('/:id', credentialController.getCredential);

module.exports = router;


const express = require('express');
const credentialController = require('../controllers/credential.controller');
const { authenticateUser } = require('../middleware/auth');

const router = express.Router();

// All credential endpoints require authentication
router.use(authenticateUser);

// Issue new credential (Version 1)
router.post('/issue', credentialController.issueCredential);

// List credentials (subject to role/user scoping)
router.get('/', credentialController.listCredentials);

// Inspect credential timeline
router.get('/:id/timeline', credentialController.getCredentialTimeline);

// Version management
router.get('/:id/versions', credentialController.getCredentialVersions);
router.post('/:id/versions', credentialController.createCredentialVersion);

// Revoke credential
router.patch('/:id/revoke', credentialController.revokeCredential);

// View credential details and current version
router.get('/:id', credentialController.getCredential);

module.exports = router;

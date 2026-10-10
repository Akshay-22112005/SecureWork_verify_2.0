const express = require('express');
const issuerKeyController = require('../controllers/issuerKey.controller');
const { authenticateUser, requireRole } = require('../middleware/auth');

const router = express.Router();

// Public / Verifier key lookups (never exposes private keys)
router.get('/', issuerKeyController.listKeys);
router.get('/:id', issuerKeyController.getKeyById);

// Protected key status management (ADMIN or owning ISSUER)
router.patch('/:id/compromise', authenticateUser, requireRole('ADMIN', 'ISSUER'), issuerKeyController.compromiseKey);
router.patch('/:id/revoke', authenticateUser, requireRole('ADMIN', 'ISSUER'), issuerKeyController.revokeKey);

module.exports = router;

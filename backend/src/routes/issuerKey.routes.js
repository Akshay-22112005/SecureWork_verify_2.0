const express = require('express');
const issuerKeyController = require('../controllers/issuerKey.controller');
const { authenticateUser } = require('../middleware/auth');

const router = express.Router();

// Public / Verifier key lookups (never exposes private keys)
router.get('/', issuerKeyController.listKeys);
router.get('/:id', issuerKeyController.getKeyById);

// Protected key status management (ADMIN or owning ISSUER)
router.patch('/:id/compromise', authenticateUser, issuerKeyController.compromiseKey);
router.patch('/:id/revoke', authenticateUser, issuerKeyController.revokeKey);

module.exports = router;

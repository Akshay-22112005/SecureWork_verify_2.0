const express = require('express');
const issuerKeyController = require('../controllers/issuerKey.controller');
const { authenticateUser, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateUser, requireRole('ADMIN', 'ISSUER'));
router.post('/generate', issuerKeyController.generateKey);
router.post('/rotate', issuerKeyController.rotateIssuerKey);

module.exports = router;

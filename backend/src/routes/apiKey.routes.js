const express = require('express');
const router = express.Router();
const apiKeyController = require('../controllers/apiKey.controller');
const { authenticateUser } = require('../middleware/auth');

router.post('/', authenticateUser, (req, res, next) => apiKeyController.createKey(req, res, next));
router.get('/', authenticateUser, (req, res, next) => apiKeyController.listKeys(req, res, next));
router.delete('/:id', authenticateUser, (req, res, next) => apiKeyController.revokeKey(req, res, next));

module.exports = router;

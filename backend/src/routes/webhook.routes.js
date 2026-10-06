const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhook.controller');
const { authenticateUser } = require('../middleware/auth');

router.post('/', authenticateUser, (req, res, next) => webhookController.register(req, res, next));
router.get('/', authenticateUser, (req, res, next) => webhookController.list(req, res, next));
router.delete('/:id', authenticateUser, (req, res, next) => webhookController.delete(req, res, next));

module.exports = router;

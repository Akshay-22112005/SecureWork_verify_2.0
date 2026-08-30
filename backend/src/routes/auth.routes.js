const express = require('express');
const authController = require('../controllers/auth.controller');
const { authenticateUser } = require('../middleware/auth');

const router = express.Router();

// Public auth endpoints
router.post('/register', authController.register);
router.post('/login', authController.login);

// Protected auth profile endpoint
router.get('/me', authenticateUser, authController.getMe);

module.exports = router;

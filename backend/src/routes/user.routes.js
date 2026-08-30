const express = require('express');
const userController = require('../controllers/user.controller');
const { authenticateUser, requireRole } = require('../middleware/auth');

const router = express.Router();

// All user endpoints require authentication
router.use(authenticateUser);

// Self profile endpoints
router.get('/me', userController.getMe);
router.patch('/me', userController.updateMe);

// Admin-only role assignment
router.patch('/:id/role', requireRole('ADMIN'), userController.updateUserRole);

// Individual user profile (self or ADMIN or AUDITOR)
router.get('/:id', userController.getUserById);

// Admin / Auditor user directory listing
router.get('/', requireRole('ADMIN', 'AUDITOR'), userController.listUsers);

module.exports = router;

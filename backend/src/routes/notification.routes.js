const express = require('express');
const notificationController = require('../controllers/notification.controller');
const { authenticateUser } = require('../middleware/auth');

const router = express.Router();

// All notification endpoints require authenticated user
router.use(authenticateUser);

// Retrieve in-app notifications (supports ?unreadOnly=true, pagination)
router.get('/', notificationController.getMyNotifications);

// Mark all notifications as read
router.patch('/read-all', notificationController.markAllAsRead);

// Mark single notification as read
router.patch('/:id/read', notificationController.markAsRead);

module.exports = router;

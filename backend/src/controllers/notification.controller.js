const notificationService = require('../services/notification.service');
const { successResponse } = require('../utils/response');

/**
 * Retrieve notifications for current authenticated user (GET /api/notifications).
 */
async function getMyNotifications(req, res, next) {
  try {
    const result = await notificationService.getUserNotifications(req.user.userId, req.query);
    return successResponse(res, result, 200);
  } catch (err) {
    next(err);
  }
}

/**
 * Mark a specific notification as read (PATCH /api/notifications/:id/read).
 */
async function markAsRead(req, res, next) {
  try {
    const notification = await notificationService.markAsRead(req.params.id, req.user.userId);
    return successResponse(res, { notification }, 200);
  } catch (err) {
    next(err);
  }
}

/**
 * Mark all notifications as read for the authenticated user (PATCH /api/notifications/read-all).
 */
async function markAllAsRead(req, res, next) {
  try {
    const result = await notificationService.markAllAsRead(req.user.userId);
    return successResponse(res, result, 200);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getMyNotifications,
  markAsRead,
  markAllAsRead
};

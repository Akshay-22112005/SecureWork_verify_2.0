const Notification = require('../models/notification.model');
const User = require('../models/user.model');
const { getNotificationAdapter } = require('./notification');
const { NotFoundError, ForbiddenError, ValidationError } = require('../utils/errors');
const logger = require('../utils/logger');

/**
 * Notification Service
 * Coordinates in-app and console notification delivery across platform events.
 */
class NotificationService {
  /**
   * Send notification to an individual user.
   * @param {object} params - { recipientUserId, type, title, message, severity, data }
   * @returns {Promise<object>}
   */
  async notifyUser({ recipientUserId, type, title, message, severity = 'INFO', data = {} }) {
    if (!recipientUserId) return null;
    const adapter = getNotificationAdapter();
    return adapter.send({
      recipientUserId,
      type,
      title,
      message,
      severity,
      data
    });
  }

  /**
   * Broadcast notification to all active users with a specified role (e.g. ADMIN, AUDITOR).
   * @param {string} role
   * @param {object} params
   * @returns {Promise<object[]>}
   */
  async notifyRole(role, { type, title, message, severity = 'INFO', data = {} }) {
    try {
      const users = await User.find({ role, status: 'ACTIVE' });
      if (!users || users.length === 0) return [];

      const promises = users.map(u =>
        this.notifyUser({
          recipientUserId: u.userId,
          type,
          title,
          message,
          severity,
          data
        })
      );
      return Promise.all(promises);
    } catch (err) {
      logger.warn(`Failed to notify role "${role}"`, { error: err.message });
      return [];
    }
  }

  /**
   * Retrieve paginated notifications for a user.
   * @param {string} userId
   * @param {object} [query]
   * @returns {Promise<object>}
   */
  async getUserNotifications(userId, { unreadOnly = false, page = 1, limit = 20 } = {}) {
    if (!userId) throw new ValidationError('userId is required');

    const filter = { recipientUserId: userId };
    if (String(unreadOnly) === 'true' || unreadOnly === true) {
      filter.read = false;
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const skip = (pageNum - 1) * limitNum;

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limitNum),
      Notification.countDocuments(filter),
      Notification.countDocuments({ recipientUserId: userId, read: false })
    ]);

    return {
      notifications: notifications.map(n => n.toJSON()),
      unreadCount,
      pagination: {
        total,
        page: pageNum,
        limit: limitNum,
        pages: Math.ceil(total / limitNum)
      }
    };
  }

  /**
   * Mark a specific notification as read.
   * Enforces privacy: users can only mark their own notifications as read.
   * @param {string} notificationId
   * @param {string} userId
   * @returns {Promise<object>}
   */
  async markAsRead(notificationId, userId) {
    if (!notificationId) throw new ValidationError('notificationId is required');

    const notif = await Notification.findOne({ notificationId });
    if (!notif) {
      throw new NotFoundError(`Notification "${notificationId}" not found`, 'NOTIFICATION_NOT_FOUND');
    }

    if (notif.recipientUserId !== userId) {
      throw new ForbiddenError('You do not have permission to access this notification', 'FORBIDDEN');
    }

    notif.read = true;
    notif.readAt = new Date();
    await notif.save();

    return notif.toJSON();
  }

  /**
   * Mark all unread notifications for a user as read.
   * @param {string} userId
   * @returns {Promise<{ updatedCount: number }>}
   */
  async markAllAsRead(userId) {
    if (!userId) throw new ValidationError('userId is required');

    const now = new Date();
    const result = await Notification.updateMany(
      { recipientUserId: userId, read: false },
      { $set: { read: true, readAt: now } }
    );

    return { updatedCount: result.modifiedCount || 0 };
  }
}

module.exports = new NotificationService();

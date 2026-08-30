const NotificationAdapter = require('./notification.adapter');
const Notification = require('../../models/notification.model');
const logger = require('../../utils/logger');
const { ValidationError } = require('../../utils/errors');

/**
 * Local Notification Adapter.
 * Dispatches notifications via in-app persistence and development console output.
 * Does not require any external paid notification providers.
 */
class LocalNotificationAdapter extends NotificationAdapter {
  constructor() {
    super();
    this.channel = 'IN_APP';
  }

  getChannel() {
    return this.channel;
  }

  /**
   * Dispatch notification: saves to MongoDB for in-app inbox and logs to development console.
   * @param {object} payload - { recipientUserId, type, title, message, severity, data }
   * @returns {Promise<object>}
   */
  async send(payload) {
    if (!payload || !payload.recipientUserId || !payload.title || !payload.message) {
      throw new ValidationError('recipientUserId, title, and message are required for notification delivery');
    }

    const {
      recipientUserId,
      type = 'GENERAL',
      title,
      message,
      severity = 'INFO',
      data = {}
    } = payload;

    // 1. In-App: Persist notification in database
    const notification = await Notification.create({
      recipientUserId,
      type,
      title,
      message,
      severity,
      data,
      channel: this.channel,
      read: false,
      createdAt: new Date()
    });

    // 2. Development Console: Log formatted notification banner
    logger.info(`[In-App Notification Alert] To: ${recipientUserId} | [${severity}] ${title}: ${message}`, {
      notificationId: notification.notificationId,
      type,
      recipientUserId,
      severity,
      data
    });

    return notification.toJSON();
  }
}

module.exports = LocalNotificationAdapter;

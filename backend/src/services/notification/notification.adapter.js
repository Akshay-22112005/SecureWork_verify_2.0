/**
 * Notification Adapter Interface
 * Abstract contract for dispatching notifications across delivery channels.
 *
 * Supported local modes:
 * - IN_APP: Persists notification records in database for user in-app notification center.
 * - CONSOLE: Formats and outputs structured notifications in development server console.
 *
 * Optional future external adapters (documented interface):
 * - EmailNotificationAdapter: SMTP / AWS SES / Postmark
 * - SmsNotificationAdapter: Twilio / AWS SNS
 * - PushNotificationAdapter: Apple APNs / Firebase Cloud Messaging (FCM)
 */
class NotificationAdapter {
  /**
   * Send notification to a recipient.
   * @param {object} payload - { recipientUserId, type, title, message, severity, data }
   * @returns {Promise<object>} Stored or dispatched notification metadata
   */
  async send(payload) {
    throw new Error('send must be implemented by adapter');
  }

  /**
   * Get primary delivery channel for this adapter ('IN_APP', 'EMAIL', 'SMS', 'PUSH', 'CONSOLE').
   * @returns {string}
   */
  getChannel() {
    throw new Error('getChannel must be implemented by adapter');
  }
}

module.exports = NotificationAdapter;

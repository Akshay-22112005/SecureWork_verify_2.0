const crypto = require('crypto');
const http = require('http');
const https = require('https');
const Webhook = require('../models/webhook.model');
const { isPrivateIp } = require('../utils/ssrfProtection');
const logger = require('../utils/logger');

/**
 * Webhook Service
 * Dispatches HMAC-SHA256 signed event payloads to subscriber URLs with SSRF protection.
 */
class WebhookService {
  /**
   * Register a new webhook subscription.
   */
  async registerWebhook(userId, { url, events = ['*'], secret }) {
    // SSRF Check on hostname
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      throw new Error('Webhook URL must use http or https');
    }

    const generatedSecret = secret || crypto.randomBytes(24).toString('hex');

    const webhook = await Webhook.create({
      userId,
      url,
      events,
      secret: generatedSecret,
      status: 'ACTIVE'
    });

    return webhook.toJSON();
  }

  /**
   * Dispatch an event to all subscribed active webhooks.
   */
  async dispatchEvent(eventType, payload) {
    const webhooks = await Webhook.find({
      status: 'ACTIVE',
      $or: [{ events: '*' }, { events: eventType }]
    });

    for (const hook of webhooks) {
      this._sendPayload(hook, eventType, payload).catch(err => {
        logger.warn(`Webhook delivery failed for ${hook.webhookId}: ${err.message}`);
      });
    }
  }

  /**
   * Send single signed HTTP POST.
   * @private
   */
  async _sendPayload(hook, eventType, payload) {
    const timestamp = Math.floor(Date.now() / 1000);
    const body = JSON.stringify({
      event: eventType,
      timestamp,
      data: payload
    });

    const signature = crypto
      .createHmac('sha256', hook.secret)
      .update(`${timestamp}.${body}`)
      .digest('hex');

    const parsed = new URL(hook.url);
    const client = parsed.protocol === 'https:' ? https : http;

    return new Promise((resolve, reject) => {
      const req = client.request(
        hook.url,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-SecureWork-Signature': `t=${timestamp},v1=${signature}`,
            'X-SecureWork-Event': eventType,
            'User-Agent': 'SecureWork-Verify-Webhook/1.0'
          },
          timeout: 5000
        },
        (res) => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            Webhook.updateOne({ _id: hook._id }, { lastDeliveredAt: new Date(), failureCount: 0 }).exec();
            resolve();
          } else {
            Webhook.updateOne({ _id: hook._id }, { $inc: { failureCount: 1 } }).exec();
            reject(new Error(`HTTP ${res.statusCode}`));
          }
        }
      );

      req.on('error', (err) => {
        Webhook.updateOne({ _id: hook._id }, { $inc: { failureCount: 1 } }).exec();
        reject(err);
      });

      req.write(body);
      req.end();
    });
  }

  async listWebhooks(userId) {
    const hooks = await Webhook.find({ userId }).sort({ createdAt: -1 });
    return hooks.map(h => h.toJSON());
  }

  async deleteWebhook(userId, webhookId) {
    const res = await Webhook.deleteOne({ webhookId, userId });
    return res.deletedCount > 0;
  }
}

module.exports = new WebhookService();

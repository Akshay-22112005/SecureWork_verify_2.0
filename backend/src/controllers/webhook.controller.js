const webhookService = require('../services/webhook.service');
const { successResponse } = require('../utils/response');

class WebhookController {
  async register(req, res, next) {
    try {
      const webhook = await webhookService.registerWebhook(req.user.userId, req.body);
      return successResponse(res, { webhook }, 201);
    } catch (err) {
      next(err);
    }
  }

  async list(req, res, next) {
    try {
      const webhooks = await webhookService.listWebhooks(req.user.userId);
      return successResponse(res, { webhooks }, 200);
    } catch (err) {
      next(err);
    }
  }

  async delete(req, res, next) {
    try {
      await webhookService.deleteWebhook(req.user.userId, req.params.id);
      return successResponse(res, { message: 'Webhook deleted successfully' }, 200);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new WebhookController();

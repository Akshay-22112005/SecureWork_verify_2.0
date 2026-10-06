const apiKeyService = require('../services/apiKey.service');
const { successResponse } = require('../utils/response');

class ApiKeyController {
  async createKey(req, res, next) {
    try {
      const result = await apiKeyService.createApiKey(req.user.userId, req.body);
      return successResponse(res, result, 201);
    } catch (err) {
      next(err);
    }
  }

  async listKeys(req, res, next) {
    try {
      const keys = await apiKeyService.listUserApiKeys(req.user.userId);
      return successResponse(res, { keys }, 200);
    } catch (err) {
      next(err);
    }
  }

  async revokeKey(req, res, next) {
    try {
      const key = await apiKeyService.revokeApiKey(req.user.userId, req.params.id);
      return successResponse(res, { key }, 200);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ApiKeyController();

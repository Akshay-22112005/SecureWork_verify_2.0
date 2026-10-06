const crypto = require('crypto');
const ApiKey = require('../models/apiKey.model');
const { sha256 } = require('../utils/crypto');
const { ValidationError, NotFoundError, ForbiddenError } = require('../utils/errors');

class ApiKeyService {
  /**
   * Generate a new secure API Key for employer ATS integration.
   * Returns raw key ONCE upon creation.
   */
  async createApiKey(userId, { name, organizationId = null, rateLimitPerMin = 60 }) {
    if (!name || name.trim() === '') {
      throw new ValidationError('Key name is required');
    }

    const rawSecret = `sk_live_${crypto.randomBytes(24).toString('hex')}`;
    const keyPrefix = rawSecret.slice(0, 12);
    const keyHash = sha256(rawSecret);

    const apiKey = await ApiKey.create({
      userId,
      organizationId,
      name: name.trim(),
      keyPrefix,
      keyHash,
      rateLimitPerMin: Math.min(Math.max(rateLimitPerMin, 10), 500),
      status: 'ACTIVE'
    });

    return {
      apiKey: apiKey.toJSON(),
      rawKey: rawSecret // Only returned on creation
    };
  }

  /**
   * Validate raw API key header and record usage telemetry.
   */
  async validateApiKey(rawSecret) {
    if (!rawSecret || !rawSecret.startsWith('sk_live_')) {
      return null;
    }

    const keyHash = sha256(rawSecret);
    const apiKey = await ApiKey.findOne({ keyHash, status: 'ACTIVE' });
    if (!apiKey) return null;

    if (apiKey.expiresAt && new Date() > new Date(apiKey.expiresAt)) {
      return null;
    }

    // Increment usage asynchronously
    ApiKey.updateOne({ _id: apiKey._id }, { $inc: { totalUses: 1 }, $set: { lastUsedAt: new Date() } }).exec();

    return apiKey;
  }

  async listUserApiKeys(userId) {
    const keys = await ApiKey.find({ userId }).sort({ createdAt: -1 });
    return keys.map(k => k.toJSON());
  }

  async revokeApiKey(userId, keyId) {
    const key = await ApiKey.findOne({ keyId, userId });
    if (!key) {
      throw new NotFoundError('API Key not found');
    }
    key.status = 'REVOKED';
    await key.save();
    return key.toJSON();
  }
}

module.exports = new ApiKeyService();

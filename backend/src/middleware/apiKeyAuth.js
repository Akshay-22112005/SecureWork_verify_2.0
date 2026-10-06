const apiKeyService = require('../services/apiKey.service');
const { UnauthorizedError } = require('../utils/errors');

/**
 * Middleware to authenticate requests via x-api-key header.
 */
async function authenticateApiKey(req, res, next) {
  const rawKey = req.headers['x-api-key'] || req.headers['authorization']?.replace(/^Bearer\s+/i, '');

  if (!rawKey) {
    return next(new UnauthorizedError('x-api-key header required', 'API_KEY_REQUIRED'));
  }

  try {
    const apiKey = await apiKeyService.validateApiKey(rawKey);
    if (!apiKey) {
      return next(new UnauthorizedError('Invalid or revoked API key', 'INVALID_API_KEY'));
    }

    req.apiKey = apiKey;
    req.user = {
      userId: apiKey.userId,
      organizationId: apiKey.organizationId,
      role: 'VERIFIER',
      isApiKey: true
    };
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  authenticateApiKey
};

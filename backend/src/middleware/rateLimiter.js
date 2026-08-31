const { TooManyRequestsError } = require('../utils/errors');
const env = require('../config/env');

/**
 * In-memory sliding window rate-limiter middleware.
 * Zero-cost, native Node.js implementation without external dependencies.
 *
 * @param {object} options
 * @param {number} [options.windowMs=60000] - Window duration in milliseconds (default: 1 min)
 * @param {number} [options.max=60] - Maximum requests allowed per IP in the window
 * @param {string} [options.message='Too many requests, please try again later.'] - Error message
 * @param {boolean} [options.skipSuccessfulRequests=false] - If true, only failed requests count towards limit
 * @returns {import('express').RequestHandler}
 */
function createRateLimiter(options = {}) {
  const windowMs = options.windowMs || 60 * 1000;
  const max = options.max || 60;
  const message = options.message || 'Too many requests, please try again later.';

  // Map of client IP -> Array of request timestamps
  const hits = new Map();

  // Periodic cleanup interval to prevent memory growth
  const cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const [ip, timestamps] of hits.entries()) {
      const validTimestamps = timestamps.filter(t => now - t < windowMs);
      if (validTimestamps.length === 0) {
        hits.delete(ip);
      } else {
        hits.set(ip, validTimestamps);
      }
    }
  }, Math.max(windowMs, 30000));

  cleanupInterval.unref();

  return function rateLimiterMiddleware(req, res, next) {
    // In test environment, allow disabling or bypassing rate limits unless specifically testing rate limiter
    if (env.NODE_ENV === 'test' && !req.headers['x-test-rate-limit']) {
      return next();
    }

    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();

    const clientHits = hits.get(ip) || [];
    const validHits = clientHits.filter(t => now - t < windowMs);

    const remaining = Math.max(0, max - validHits.length - 1);
    const oldestHit = validHits[0] || now;
    const resetTime = Math.ceil((oldestHit + windowMs - now) / 1000);

    res.setHeader('RateLimit-Limit', max);
    res.setHeader('RateLimit-Remaining', remaining);
    res.setHeader('RateLimit-Reset', resetTime);

    if (validHits.length >= max) {
      res.setHeader('Retry-After', resetTime);
      return next(new TooManyRequestsError(message, 'RATE_LIMIT_EXCEEDED'));
    }

    validHits.push(now);
    hits.set(ip, validHits);

    next();
  };
}

module.exports = {
  createRateLimiter
};

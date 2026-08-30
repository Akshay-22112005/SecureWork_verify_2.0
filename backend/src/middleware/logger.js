const logger = require('../utils/logger');

/**
 * Express middleware for structured HTTP request and response logging.
 * Includes request ID, method, URL, status code, response time, and sanitized metadata.
 */
function requestLogger(req, res, next) {
  const startTime = Date.now();

  res.on('finish', () => {
    const durationMs = Date.now() - startTime;
    const statusCode = res.statusCode;

    const logContext = {
      requestId: req.id,
      method: req.method,
      url: req.originalUrl || req.url,
      statusCode,
      durationMs,
      ip: req.ip || req.socket.remoteAddress
    };

    if (statusCode >= 500) {
      logger.error(`HTTP Request Failed: ${req.method} ${req.originalUrl}`, logContext);
    } else if (statusCode >= 400) {
      logger.warn(`HTTP Client Warning: ${req.method} ${req.originalUrl}`, logContext);
    } else {
      logger.info(`HTTP Request Completed: ${req.method} ${req.originalUrl}`, logContext);
    }
  });

  next();
}

module.exports = requestLogger;

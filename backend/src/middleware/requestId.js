const { generateRequestId } = require('../utils/requestId');

/**
 * Middleware that assigns a unique request ID to each incoming request.
 * Sets the ID on req.id and returns it in the X-Request-Id response header.
 */
function requestIdMiddleware(req, res, next) {
  const existingId = req.headers['x-request-id'];
  const requestId = typeof existingId === 'string' && existingId.trim() ? existingId.trim() : generateRequestId();

  req.id = requestId;
  res.setHeader('X-Request-Id', requestId);
  next();
}

module.exports = requestIdMiddleware;

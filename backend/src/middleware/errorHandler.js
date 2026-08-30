const { errorResponse } = require('../utils/response');
const { AppError } = require('../utils/errors');
const logger = require('../utils/logger');

/**
 * Centralized application error handling middleware.
 * Guarantees that:
 * 1. Output format is strictly: { "success": false, "error": { "code": "...", "message": "..." } }
 * 2. Stack traces are NEVER exposed to clients under any circumstances.
 * 3. Request ID and error telemetry are logged server-side for investigation.
 */
function errorHandler(err, req, res, next) {
  let statusCode = 500;
  let errorCode = 'INTERNAL_ERROR';
  let message = 'An unexpected internal error occurred';

  // Handle custom AppError instances
  if (err instanceof AppError) {
    statusCode = err.statusCode;
    errorCode = err.code;
    message = err.message;
  }
  // Handle Express JSON body parsing errors
  else if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    statusCode = 400;
    errorCode = 'INVALID_JSON';
    message = 'Malformed JSON request body';
  }
  // Handle Mongoose validation errors
  else if (err.name === 'ValidationError') {
    statusCode = 400;
    errorCode = 'VALIDATION_ERROR';
    const firstErr = Object.values(err.errors || {})[0];
    message = firstErr ? firstErr.message : 'Database validation failed';
  }
  // Handle Mongoose bad ObjectId / Cast errors
  else if (err.name === 'CastError') {
    statusCode = 400;
    errorCode = 'INVALID_IDENTIFIER';
    message = `Invalid format for resource identifier: ${err.value}`;
  }
  // Handle MongoDB duplicate key errors (code 11000)
  else if (err.code === 11000) {
    statusCode = 409;
    errorCode = 'DUPLICATE_KEY';
    const fields = Object.keys(err.keyValue || {});
    message = `Resource already exists with conflicting field(s): ${fields.join(', ')}`;
  }

  // Structured internal logging for server diagnostics
  logger.error(`Error processed [${errorCode}]: ${err.message}`, {
    requestId: req.id,
    code: errorCode,
    statusCode,
    path: req.originalUrl || req.url,
    method: req.method,
    stack: err.stack
  });

  // Client response: strictly code and human-readable message, no stack traces
  return errorResponse(res, errorCode, message, statusCode);
}

/**
 * 404 Not Found handler for undefined routes.
 */
function notFoundHandler(req, res) {
  return errorResponse(
    res,
    'NOT_FOUND',
    `Resource not found: ${req.method} ${req.originalUrl || req.url}`,
    404
  );
}

module.exports = {
  errorHandler,
  notFoundHandler
};

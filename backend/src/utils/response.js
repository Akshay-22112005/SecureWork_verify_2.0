/**
 * Standardized API response formatters for SecureWork Verify.
 */

/**
 * Send a standardized success response.
 * @param {import('express').Response} res
 * @param {any} data - Payload to return
 * @param {number} [statusCode=200] - HTTP status code
 * @param {object} [meta={}] - Optional metadata (pagination, audit info, etc.)
 */
function successResponse(res, data = null, statusCode = 200, meta = {}) {
  const responsePayload = {
    success: true,
    data
  };

  if (meta && Object.keys(meta).length > 0) {
    responsePayload.meta = {
      timestamp: new Date().toISOString(),
      ...meta
    };
  }

  return res.status(statusCode).json(responsePayload);
}

/**
 * Send a standardized error response conforming strictly to:
 * {
 *   "success": false,
 *   "error": {
 *     "code": "ERROR_CODE",
 *     "message": "Human-readable message"
 *   }
 * }
 * Never exposes stack traces or internal implementation details.
 * @param {import('express').Response} res
 * @param {string} code - Machine-readable error code
 * @param {string} message - Human-readable error message
 * @param {number} [statusCode=500] - HTTP status code
 */
function errorResponse(res, code = 'INTERNAL_ERROR', message = 'Internal Server Error', statusCode = 500) {
  return res.status(statusCode).json({
    success: false,
    error: {
      code,
      message
    }
  });
}

module.exports = {
  successResponse,
  errorResponse
};

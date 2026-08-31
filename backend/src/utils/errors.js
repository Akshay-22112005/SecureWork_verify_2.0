/**
 * Custom application error classes for SecureWork Verify.
 * Standardizes error codes and HTTP status codes across the entire application.
 */

class AppError extends Error {
  /**
   * @param {string} code - Machine-readable error code (e.g. "NOT_FOUND", "VALIDATION_ERROR")
   * @param {string} message - Human-readable error message
   * @param {number} statusCode - HTTP status code
   */
  constructor(code, message, statusCode = 500) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = statusCode;
    this.isOperational = true; // Operational error vs programmer bug
    Error.captureStackTrace(this, this.constructor);
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found', code = 'NOT_FOUND') {
    super(code, message, 404);
  }
}

class ValidationError extends AppError {
  constructor(message = 'Validation failed', code = 'VALIDATION_ERROR') {
    super(code, message, 400);
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required', code = 'UNAUTHORIZED') {
    super(code, message, 401);
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Access denied', code = 'FORBIDDEN') {
    super(code, message, 403);
  }
}

class ConflictError extends AppError {
  constructor(message = 'Resource conflict', code = 'CONFLICT') {
    super(code, message, 409);
  }
}

class DatabaseError extends AppError {
  constructor(message = 'Database operation failed', code = 'DATABASE_ERROR') {
    super(code, message, 500);
  }
}

class TooManyRequestsError extends AppError {
  constructor(message = 'Too many requests, please try again later', code = 'RATE_LIMIT_EXCEEDED') {
    super(code, message, 429);
  }
}

module.exports = {
  AppError,
  NotFoundError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  ConflictError,
  DatabaseError,
  TooManyRequestsError
};

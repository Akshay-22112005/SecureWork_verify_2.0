const { verifyToken } = require('../utils/jwt');
const User = require('../models/user.model');
const { UnauthorizedError, ForbiddenError } = require('../utils/errors');

/**
 * Authentication Middleware.
 * Verifies the Bearer JWT token in the Authorization header and attaches the active user to req.user.
 */
async function authenticateUser(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Authentication token required', 'TOKEN_REQUIRED');
    }

    const token = authHeader.split(' ')[1];
    if (!token || token.trim() === '') {
      throw new UnauthorizedError('Authentication token required', 'TOKEN_REQUIRED');
    }

    let decoded;
    try {
      decoded = verifyToken(token);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        throw new UnauthorizedError('Authentication token has expired', 'TOKEN_EXPIRED');
      }
      throw new UnauthorizedError('Invalid authentication token', 'INVALID_TOKEN');
    }

    const userId = decoded.userId || decoded.sub;
    if (!userId) {
      throw new UnauthorizedError('Token contains invalid claims', 'INVALID_TOKEN');
    }

    const user = await User.findOne({ userId });
    if (!user) {
      throw new UnauthorizedError('User account not found', 'USER_NOT_FOUND');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedError('User account is suspended or inactive', 'ACCOUNT_INACTIVE');
    }

    req.user = user.toJSON();
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Reusable RBAC Middleware.
 * Restricts endpoint access to specific roles.
 * @param {...string} allowedRoles - Roles permitted to access the route (e.g. 'ADMIN', 'HR')
 */
function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new UnauthorizedError('Authentication required before role validation', 'UNAUTHORIZED'));
    }

    if (!allowedRoles.includes(req.user.role)) {
      return next(
        new ForbiddenError(
          `Insufficient permissions: Role "${req.user.role}" cannot access this resource`,
          'FORBIDDEN'
        )
      );
    }

    next();
  };
}

/**
 * Optional Authentication Middleware.
 * If token is present, verifies and populates req.user. If absent, continues as anonymous guest.
 */
async function optionalAuthenticateUser(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  try {
    const token = authHeader.split(' ')[1];
    if (!token) {
      req.user = null;
      return next();
    }

    const decoded = verifyToken(token);
    const userId = decoded.userId || decoded.sub;
    if (userId) {
      const user = await User.findOne({ userId });
      if (user && user.status === 'ACTIVE') {
        req.user = user.toJSON();
      }
    }
  } catch {
    // Non-blocking for optional auth
    req.user = null;
  }

  next();
}

module.exports = {
  authenticateUser,
  optionalAuthenticateUser,
  requireRole,
  authorize: requireRole
};

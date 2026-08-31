const jwt = require('jsonwebtoken');
const env = require('../config/env');

/**
 * Generates a signed JWT with minimum required claims.
 * Claims: sub (userId), userId, role, email.
 * @param {object} user - User document or minimal user object
 * @param {object} [options={}] - Optional jwt sign options (e.g. expiresIn override)
 * @returns {string} Signed JWT string
 */
function generateToken(user, options = {}) {
  const payload = {
    sub: user.userId,
    userId: user.userId,
    role: user.role,
    email: user.email
  };

  return jwt.sign(payload, env.JWT_SECRET, {
    algorithm: 'HS256',
    expiresIn: options.expiresIn || env.JWT_EXPIRES_IN
  });
}

/**
 * Verifies and decodes a JWT using the application secret.
 * Explicitly enforces HMAC-SHA256 algorithm to prevent algorithm confusion attacks.
 * @param {string} token - Raw JWT string
 * @returns {object} Decoded token payload
 * @throws {jwt.JsonWebTokenError | jwt.TokenExpiredError}
 */
function verifyToken(token) {
  return jwt.verify(token, env.JWT_SECRET, {
    algorithms: ['HS256']
  });
}

module.exports = {
  generateToken,
  verifyToken
};

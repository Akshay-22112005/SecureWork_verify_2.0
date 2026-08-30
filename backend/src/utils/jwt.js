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
    expiresIn: options.expiresIn || env.JWT_EXPIRES_IN
  });
}

/**
 * Verifies and decodes a JWT using the application secret.
 * @param {string} token - Raw JWT string
 * @returns {object} Decoded token payload
 * @throws {jwt.JsonWebTokenError | jwt.TokenExpiredError}
 */
function verifyToken(token) {
  return jwt.verify(token, env.JWT_SECRET);
}

module.exports = {
  generateToken,
  verifyToken
};

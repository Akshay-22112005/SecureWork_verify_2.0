const crypto = require('crypto');

/**
 * Generate a unique request ID (UUID v4).
 * @returns {string} UUID v4 string
 */
function generateRequestId() {
  return crypto.randomUUID();
}

module.exports = {
  generateRequestId
};

const { ValidationError } = require('./errors');

/**
 * Reusable validation helpers for input schemas and payloads.
 */

/**
 * Asserts that required fields exist on an object.
 * @param {object} obj - Target object
 * @param {string[]} requiredFields - List of property names that must be present and non-empty
 * @throws {ValidationError} If any required field is missing
 */
function validateRequired(obj, requiredFields) {
  if (!obj || typeof obj !== 'object') {
    throw new ValidationError('Payload must be an object');
  }

  const missing = [];
  for (const field of requiredFields) {
    if (obj[field] === undefined || obj[field] === null || obj[field] === '') {
      missing.push(field);
    }
  }

  if (missing.length > 0) {
    throw new ValidationError(`Missing required field(s): ${missing.join(', ')}`);
  }
}

/**
 * Validates that an email string is well-formed.
 * @param {string} email
 * @returns {boolean}
 */
function isValidEmail(email) {
  if (typeof email !== 'string') return false;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Validates that a value is one of allowed enum values.
 * @param {any} value
 * @param {any[]} allowedValues
 * @param {string} fieldName
 * @throws {ValidationError}
 */
function validateEnum(value, allowedValues, fieldName = 'Field') {
  if (!allowedValues.includes(value)) {
    throw new ValidationError(`${fieldName} must be one of: ${allowedValues.join(', ')}. Received: "${value}"`);
  }
}

module.exports = {
  validateRequired,
  isValidEmail,
  validateEnum
};

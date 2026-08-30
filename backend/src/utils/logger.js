/**
 * Structured application logger with automatic security redaction.
 * Ensures passwords, private keys, secrets, and auth tokens are NEVER logged.
 */

const levels = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

const SENSITIVE_KEY_PATTERNS = [
  /password/i,
  /secret/i,
  /token/i,
  /authorization/i,
  /privatekey/i,
  /private_key/i,
  /apikey/i,
  /api_key/i,
  /passphrase/i,
  /cookie/i,
  /session/i
];

/**
 * Deeply sanitizes an object, masking all sensitive keys.
 * @param {any} data
 * @param {WeakSet} [visited] - Prevents circular reference loops
 * @returns {any} Sanitized clone of the data
 */
function sanitizeData(data, visited = new WeakSet()) {
  if (data === null || data === undefined) return data;
  if (typeof data !== 'object') return data;

  if (visited.has(data)) {
    return '[Circular]';
  }
  visited.add(data);

  if (Array.isArray(data)) {
    return data.map(item => sanitizeData(item, visited));
  }

  const sanitized = {};
  for (const [key, value] of Object.entries(data)) {
    const isSensitive = SENSITIVE_KEY_PATTERNS.some(pattern => pattern.test(key));
    if (isSensitive) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeData(value, visited);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}

const currentLevel = process.env.LOG_LEVEL || 'info';

function formatLog(level, message, context = {}) {
  const timestamp = new Date().toISOString();
  const sanitizedContext = sanitizeData(context);
  const logEntry = {
    timestamp,
    level: level.toUpperCase(),
    message,
    ...(sanitizedContext && Object.keys(sanitizedContext).length > 0 ? { context: sanitizedContext } : {})
  };

  return JSON.stringify(logEntry);
}

const logger = {
  debug(message, context = {}) {
    if (levels[currentLevel] <= levels.debug) {
      console.debug(formatLog('debug', message, context));
    }
  },
  info(message, context = {}) {
    if (levels[currentLevel] <= levels.info) {
      console.info(formatLog('info', message, context));
    }
  },
  warn(message, context = {}) {
    if (levels[currentLevel] <= levels.warn) {
      console.warn(formatLog('warn', message, context));
    }
  },
  error(message, context = {}) {
    if (levels[currentLevel] <= levels.error) {
      console.error(formatLog('error', message, context));
    }
  },
  sanitizeData
};

module.exports = logger;
module.exports.sanitizeData = sanitizeData;

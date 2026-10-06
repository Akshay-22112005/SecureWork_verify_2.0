const path = require('path');
const dotenv = require('dotenv');

// Load environment variables from backend/.env if available
const backendRoot = path.resolve(__dirname, '../../');
dotenv.config({ path: path.join(backendRoot, '.env') });

/**
 * Validates and normalizes environment variables.
 * @param {Record<string, string | undefined>} envSource
 * @returns {object} Validated environment configuration
 */
function validateEnv(envSource = process.env) {
  const errors = [];

  const NODE_ENV = envSource.NODE_ENV || 'development';
  if (!['development', 'test', 'production'].includes(NODE_ENV)) {
    errors.push(`NODE_ENV must be one of: development, test, production. Received: "${NODE_ENV}"`);
  }

  const rawPort = envSource.PORT || '5000';
  const PORT = parseInt(rawPort, 10);
  if (isNaN(PORT) || PORT < 1 || PORT > 65535) {
    errors.push(`PORT must be a valid port number (1-65535). Received: "${rawPort}"`);
  }

  const MONGODB_URI = envSource.MONGODB_URI || 'mongodb://127.0.0.1:27017/securework_verify';
  if (!MONGODB_URI.startsWith('mongodb://') && !MONGODB_URI.startsWith('mongodb+srv://')) {
    errors.push(`MONGODB_URI must start with "mongodb://" or "mongodb+srv://". Received: "${MONGODB_URI}"`);
  }

  const JWT_SECRET = envSource.JWT_SECRET || 'CHANGE_ME';
  if (!JWT_SECRET || typeof JWT_SECRET !== 'string' || JWT_SECRET.trim() === '') {
    errors.push('JWT_SECRET must be a non-empty string.');
  } else if (NODE_ENV === 'production') {
    if (JWT_SECRET === 'CHANGE_ME' || JWT_SECRET.length < 32) {
      errors.push('JWT_SECRET must be at least 32 characters and cannot be "CHANGE_ME" in production.');
    }
  }

  const JWT_EXPIRES_IN = envSource.JWT_EXPIRES_IN || '24h';
  if (!JWT_EXPIRES_IN || typeof JWT_EXPIRES_IN !== 'string') {
    errors.push('JWT_EXPIRES_IN must be a valid duration string (e.g. "24h", "7d").');
  }

  const rawKeyStorage = envSource.KEY_STORAGE_PATH || './keys';
  const KEY_STORAGE_PATH = path.isAbsolute(rawKeyStorage)
    ? rawKeyStorage
    : path.resolve(backendRoot, rawKeyStorage);

  const rawStorage = envSource.STORAGE_PATH || './storage/documents';
  const STORAGE_PATH = path.isAbsolute(rawStorage)
    ? rawStorage
    : path.resolve(backendRoot, rawStorage);

  const rawTempStorage = envSource.TEMP_STORAGE_PATH || './storage/temp';
  const TEMP_STORAGE_PATH = path.isAbsolute(rawTempStorage)
    ? rawTempStorage
    : path.resolve(backendRoot, rawTempStorage);

  const rawMaxSize = envSource.MAX_FILE_SIZE_MB || '10';
  const MAX_FILE_SIZE_MB = parseFloat(rawMaxSize);
  if (isNaN(MAX_FILE_SIZE_MB) || MAX_FILE_SIZE_MB <= 0) {
    errors.push(`MAX_FILE_SIZE_MB must be a positive number. Received: "${rawMaxSize}"`);
  }

  const FRONTEND_URL = envSource.FRONTEND_URL || 'http://localhost:5173';
  try {
    new URL(FRONTEND_URL);
  } catch {
    errors.push(`FRONTEND_URL must be a valid URL string. Received: "${FRONTEND_URL}"`);
  }

  function parseBool(val, defaultValue = true) {
    if (val === undefined || val === null || val === '') return defaultValue;
    if (typeof val === 'boolean') return val;
    const lower = String(val).trim().toLowerCase();
    if (lower === 'true' || lower === '1') return true;
    if (lower === 'false' || lower === '0') return false;
    return null;
  }

  const ocrVal = parseBool(envSource.OCR_ENABLED, true);
  if (ocrVal === null) {
    errors.push(`OCR_ENABLED must be a boolean (true/false). Received: "${envSource.OCR_ENABLED}"`);
  }

  const aiVal = parseBool(envSource.AI_ENABLED, true);
  if (aiVal === null) {
    errors.push(`AI_ENABLED must be a boolean (true/false). Received: "${envSource.AI_ENABLED}"`);
  }

  const OCR_ENGINE = envSource.OCR_ENGINE || 'local';
  const AI_ENGINE = envSource.AI_ENGINE || 'local';
  const STORAGE_DRIVER = (envSource.STORAGE_DRIVER || 'local').toLowerCase();
  const CLOUDINARY_CLOUD_NAME = envSource.CLOUDINARY_CLOUD_NAME || '';
  const CLOUDINARY_API_KEY = envSource.CLOUDINARY_API_KEY || '';
  const CLOUDINARY_API_SECRET = envSource.CLOUDINARY_API_SECRET || '';
  const CLOUDINARY_FOLDER = envSource.CLOUDINARY_FOLDER || 'securework-verify';

  if (errors.length > 0) {
    const errorMsg = `Environment Configuration Validation Failed:\n  - ${errors.join('\n  - ')}`;
    throw new Error(errorMsg);
  }

  return {
    NODE_ENV,
    PORT,
    MONGODB_URI,
    JWT_SECRET,
    JWT_EXPIRES_IN,
    KEY_STORAGE_PATH,
    STORAGE_PATH,
    TEMP_STORAGE_PATH,
    MAX_FILE_SIZE_MB,
    FRONTEND_URL,
    OCR_ENABLED: ocrVal,
    AI_ENABLED: aiVal,
    OCR_ENGINE,
    AI_ENGINE,
    STORAGE_DRIVER,
    CLOUDINARY_CLOUD_NAME,
    CLOUDINARY_API_KEY,
    CLOUDINARY_API_SECRET,
    CLOUDINARY_FOLDER,
    IS_PRODUCTION: NODE_ENV === 'production',
    IS_TEST: NODE_ENV === 'test',
    IS_DEVELOPMENT: NODE_ENV === 'development'
  };
}

// Perform initial validation
const env = validateEnv(process.env);

module.exports = env;
module.exports.validateEnv = validateEnv;

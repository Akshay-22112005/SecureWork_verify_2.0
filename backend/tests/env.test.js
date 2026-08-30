const { test, describe } = require('node:test');
const assert = require('node:assert');
const { validateEnv } = require('../src/config/env');

describe('Environment Configuration & Validation Tests', () => {
  const validBaseEnv = {
    NODE_ENV: 'development',
    PORT: '5000',
    MONGODB_URI: 'mongodb://127.0.0.1:27017/securework_verify',
    JWT_SECRET: 'CHANGE_ME',
    JWT_EXPIRES_IN: '24h',
    KEY_STORAGE_PATH: './keys',
    STORAGE_PATH: './storage/documents',
    TEMP_STORAGE_PATH: './storage/temp',
    MAX_FILE_SIZE_MB: '10',
    FRONTEND_URL: 'http://localhost:5173',
    OCR_ENABLED: 'true',
    AI_ENABLED: 'true',
    OCR_ENGINE: 'local',
    AI_ENGINE: 'local'
  };

  test('validates and parses valid environment variables successfully', () => {
    const config = validateEnv(validBaseEnv);
    assert.strictEqual(config.PORT, 5000);
    assert.strictEqual(config.NODE_ENV, 'development');
    assert.strictEqual(config.MAX_FILE_SIZE_MB, 10);
    assert.strictEqual(config.OCR_ENABLED, true);
    assert.strictEqual(config.AI_ENABLED, true);
    assert.strictEqual(config.OCR_ENGINE, 'local');
    assert.strictEqual(config.AI_ENGINE, 'local');
    assert.ok(config.KEY_STORAGE_PATH.length > 0);
    assert.ok(config.STORAGE_PATH.length > 0);
  });

  test('coerces boolean strings correctly', () => {
    const customEnv = {
      ...validBaseEnv,
      OCR_ENABLED: 'false',
      AI_ENABLED: '0'
    };
    const config = validateEnv(customEnv);
    assert.strictEqual(config.OCR_ENABLED, false);
    assert.strictEqual(config.AI_ENABLED, false);
  });

  test('throws validation error on invalid port', () => {
    assert.throws(
      () => validateEnv({ ...validBaseEnv, PORT: '999999' }),
      /PORT must be a valid port number/
    );
    assert.throws(
      () => validateEnv({ ...validBaseEnv, PORT: 'invalid_port' }),
      /PORT must be a valid port number/
    );
  });

  test('throws validation error on invalid MongoDB URI', () => {
    assert.throws(
      () => validateEnv({ ...validBaseEnv, MONGODB_URI: 'postgresql://localhost:5432/mydb' }),
      /MONGODB_URI must start with "mongodb:\/\/".*or "mongodb\+srv:\/\/"/
    );
  });

  test('throws validation error on invalid frontend URL', () => {
    assert.throws(
      () => validateEnv({ ...validBaseEnv, FRONTEND_URL: 'not-a-valid-url' }),
      /FRONTEND_URL must be a valid URL string/
    );
  });

  test('enforces strong JWT secret in production mode', () => {
    assert.throws(
      () => validateEnv({
        ...validBaseEnv,
        NODE_ENV: 'production',
        JWT_SECRET: 'CHANGE_ME'
      }),
      /JWT_SECRET must be at least 32 characters and cannot be "CHANGE_ME" in production/
    );

    // Short secret in production should also fail
    assert.throws(
      () => validateEnv({
        ...validBaseEnv,
        NODE_ENV: 'production',
        JWT_SECRET: 'too_short'
      }),
      /JWT_SECRET must be at least 32 characters and cannot be "CHANGE_ME" in production/
    );

    // Sufficient length secret in production should pass
    const prodConfig = validateEnv({
      ...validBaseEnv,
      NODE_ENV: 'production',
      JWT_SECRET: 'a_very_secure_production_secret_key_exceeding_32_bytes'
    });
    assert.strictEqual(prodConfig.NODE_ENV, 'production');
  });
});

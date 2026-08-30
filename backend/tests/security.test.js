const { test, describe } = require('node:test');
const assert = require('node:assert');
const { sanitizeData } = require('../src/utils/logger');
const { User } = require('../src/models');

describe('Security & Sensitive Data Leak Prevention Tests', () => {
  test('logger sanitizeData redacts passwords, private keys, and secrets', () => {
    const sensitivePayload = {
      user: 'alice',
      password: 'plain_text_password_123',
      passwordHash: '$2a$10$abcdefg123456',
      secret: 'super_secret_jwt_key_value',
      privateKey: '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASC...\n-----END PRIVATE KEY-----',
      apiKey: 'sec_live_987654321',
      authorization: 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
      nested: {
        api_key: 'nested_key_abc',
        safeData: 'visible_string',
        innerDetails: {
          token: 'sensitive_jwt_token'
        }
      },
      list: [
        { password: 'another_password', normal: 'normal_val' }
      ]
    };

    const sanitized = sanitizeData(sensitivePayload);

    // Assert sensitive fields are redacted
    assert.strictEqual(sanitized.password, '[REDACTED]');
    assert.strictEqual(sanitized.passwordHash, '[REDACTED]');
    assert.strictEqual(sanitized.secret, '[REDACTED]');
    assert.strictEqual(sanitized.privateKey, '[REDACTED]');
    assert.strictEqual(sanitized.apiKey, '[REDACTED]');
    assert.strictEqual(sanitized.authorization, '[REDACTED]');

    // Assert nested sanitization
    assert.strictEqual(sanitized.nested.api_key, '[REDACTED]');
    assert.strictEqual(sanitized.nested.safeData, 'visible_string');
    assert.strictEqual(sanitized.nested.innerDetails.token, '[REDACTED]');
    assert.strictEqual(sanitized.list[0].password, '[REDACTED]');
    assert.strictEqual(sanitized.list[0].normal, 'normal_val');

    // Verify original string does not leak into serialized output
    const jsonStr = JSON.stringify(sanitized);
    assert.ok(!jsonStr.includes('plain_text_password_123'));
    assert.ok(!jsonStr.includes('BEGIN PRIVATE KEY'));
    assert.ok(!jsonStr.includes('super_secret_jwt_key_value'));
  });

  test('handles circular references gracefully without crashing', () => {
    const circularObj = { name: 'cyclic' };
    circularObj.self = circularObj;

    const sanitized = sanitizeData(circularObj);
    assert.strictEqual(sanitized.name, 'cyclic');
    assert.strictEqual(sanitized.self, '[Circular]');
  });

  test('User model toJSON transformation strips passwordHash and private keys', () => {
    const user = new User({
      email: 'security.test@securework.local',
      passwordHash: '$2a$12$e9gG8X98aBC123FakeHashForTestingOnly',
      name: 'Security Test User',
      role: 'USER'
    });

    const json = user.toJSON();

    assert.strictEqual(json.passwordHash, undefined, 'passwordHash must never be included in toJSON output');
    assert.strictEqual(json.privateKey, undefined, 'privateKey must never be included in toJSON output');
    assert.strictEqual(json._id, undefined, '_id must be transformed into id');
    assert.ok(json.id, 'id property must exist');
    assert.strictEqual(json.email, 'security.test@securework.local');
  });
});

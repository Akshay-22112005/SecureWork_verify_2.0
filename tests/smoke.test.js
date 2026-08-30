const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

describe('Monorepo Structure Smoke Tests', () => {
  test('Root configuration files exist', () => {
    assert.strictEqual(fs.existsSync(path.resolve(__dirname, '../package.json')), true);
    assert.strictEqual(fs.existsSync(path.resolve(__dirname, '../.gitignore')), true);
    assert.strictEqual(fs.existsSync(path.resolve(__dirname, '../PROJECT_RULES.md')), true);
    assert.strictEqual(fs.existsSync(path.resolve(__dirname, '../README.md')), true);
  });

  test('Backend modular service boundaries exist', () => {
    const services = [
      'auth.service.js',
      'user.service.js',
      'organization.service.js',
      'issuer.service.js',
      'issuerKey.service.js',
      'document.service.js',
      'storage.service.js',
      'credential.service.js',
      'verification.service.js',
      'trust.service.js',
      'trustedSource.service.js',
      'ocr.service.js',
      'ai.service.js',
      'evidence.service.js',
      'audit.service.js',
      'notification.service.js'
    ];

    for (const file of services) {
      const p = path.resolve(__dirname, '../backend/src/services', file);
      assert.strictEqual(fs.existsSync(p), true, `Service ${file} must exist`);
    }
  });

  test('Frontend app and entry points exist', () => {
    assert.strictEqual(fs.existsSync(path.resolve(__dirname, '../frontend/src/App.jsx')), true);
    assert.strictEqual(fs.existsSync(path.resolve(__dirname, '../frontend/src/index.css')), true);
    assert.strictEqual(fs.existsSync(path.resolve(__dirname, '../frontend/src/main.jsx')), true);
    assert.strictEqual(fs.existsSync(path.resolve(__dirname, '../frontend/index.html')), true);
  });
});

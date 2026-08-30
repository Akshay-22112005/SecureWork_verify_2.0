const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const app = require('../src/app');
const { sha256, canonicalizeJson, timingSafeCompare } = require('../src/utils/crypto');

describe('Backend Foundation & Health Endpoint Tests', () => {
  let server;
  let baseUrl;

  before(async () => {
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      if (typeof server.closeAllConnections === 'function') {
        server.closeAllConnections();
      }
      await new Promise((resolve) => server.close(resolve));
    }
  });

  test('GET /api/health returns 200 with service and database status', async () => {
    const res = await fetch(`${baseUrl}/api/health`);
    assert.strictEqual(res.status, 200);

    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.data, 'Health check must include data payload');
    assert.strictEqual(body.data.service, 'SecureWork Verify Backend');
    assert.ok(body.data.database, 'Must include database status object');
    assert.ok(typeof body.data.database.status === 'string');
    assert.ok(typeof body.data.database.isConnected === 'boolean');
    assert.ok(body.data.system, 'Must include system metrics');
    assert.strictEqual(typeof body.data.uptime, 'number');

    // Verify request ID header is returned
    const requestId = res.headers.get('x-request-id');
    assert.ok(requestId, 'Response must include X-Request-Id header');
  });

  test('GET / returns 200 with service metadata', async () => {
    const res = await fetch(`${baseUrl}/`);
    assert.strictEqual(res.status, 200);

    const body = await res.json();
    assert.strictEqual(body.service, 'SecureWork Verify API');
    assert.strictEqual(body.status, 'online');
  });

  test('Cryptographic utilities: SHA-256 and canonicalization produces deterministic output', () => {
    const objA = { z: 1, a: 2, m: { nested: 'val', arr: [1, 2, 3] } };
    const objB = { a: 2, m: { arr: [1, 2, 3], nested: 'val' }, z: 1 };

    const canonicalA = canonicalizeJson(objA);
    const canonicalB = canonicalizeJson(objB);

    assert.strictEqual(canonicalA, canonicalB, 'Canonical representations must match regardless of key order');

    const hashA = sha256(objA);
    const hashB = sha256(objB);

    assert.strictEqual(hashA, hashB, 'SHA-256 hashes must be identical for canonical structures');
  });

  test('Cryptographic utilities: timingSafeCompare works reliably for hashes', () => {
    const hashA = sha256('test-data');
    const hashB = sha256('test-data');
    const hashC = sha256('different-data');

    assert.strictEqual(timingSafeCompare(hashA, hashB), true);
    assert.strictEqual(timingSafeCompare(hashA, hashC), false);
  });
});

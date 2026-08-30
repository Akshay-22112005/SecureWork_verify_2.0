const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const express = require('express');
const { errorHandler, notFoundHandler } = require('../src/middleware/errorHandler');
const requestIdMiddleware = require('../src/middleware/requestId');
const { NotFoundError, ValidationError } = require('../src/utils/errors');

describe('Error Handling and Formatting Tests', () => {
  let server;
  let baseUrl;

  before(async () => {
    const testApp = express();
    testApp.use(requestIdMiddleware);
    testApp.use(express.json());

    // Test routes throwing various errors
    testApp.get('/test-validation', (req, res, next) => {
      next(new ValidationError('Field "email" is invalid'));
    });

    testApp.get('/test-not-found', (req, res, next) => {
      next(new NotFoundError('Document record not found'));
    });

    testApp.get('/test-internal-error', (req, res, next) => {
      // Internal error that contains sensitive crash information
      const secretError = new Error('Database connection failed at secret-internal-host:5432 with password=SuperSecretPassword');
      next(secretError);
    });

    // 404 handler
    testApp.use(notFoundHandler);

    // Centralized error handler
    testApp.use(errorHandler);

    await new Promise((resolve) => {
      server = testApp.listen(0, () => {
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

  test('404 handler returns standardized error structure with NOT_FOUND code', async () => {
    const res = await fetch(`${baseUrl}/undefined-endpoint`);
    assert.strictEqual(res.status, 404);

    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.ok(body.error, 'Payload must contain error property');
    assert.strictEqual(body.error.code, 'NOT_FOUND');
    assert.ok(body.error.message.includes('/undefined-endpoint'));

    // Security assertion: Never expose stack traces
    assert.strictEqual(body.error.stack, undefined);
    assert.strictEqual(body.stack, undefined);
    assert.strictEqual(body.details, undefined);
  });

  test('operational ValidationError returns 400 with VALIDATION_ERROR code', async () => {
    const res = await fetch(`${baseUrl}/test-validation`);
    assert.strictEqual(res.status, 400);

    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, 'VALIDATION_ERROR');
    assert.strictEqual(body.error.message, 'Field "email" is invalid');

    // Verify stack traces are never sent
    assert.strictEqual(body.error.stack, undefined);
    assert.strictEqual(body.stack, undefined);
  });

  test('operational NotFoundError returns 404 with NOT_FOUND code', async () => {
    const res = await fetch(`${baseUrl}/test-not-found`);
    assert.strictEqual(res.status, 404);

    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, 'NOT_FOUND');
    assert.strictEqual(body.error.message, 'Document record not found');
  });

  test('internal errors return 500 without leaking stack traces or internal secrets', async () => {
    const res = await fetch(`${baseUrl}/test-internal-error`);
    assert.strictEqual(res.status, 500);

    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, 'INTERNAL_ERROR');
    assert.strictEqual(body.error.message, 'An unexpected internal error occurred');

    // Strict security assertions: zero exposure of internal secret message or stack traces
    const rawJson = JSON.stringify(body);
    assert.ok(!rawJson.includes('SuperSecretPassword'), 'Response must not leak internal secrets');
    assert.ok(!rawJson.includes('secret-internal-host'), 'Response must not leak internal hosts');
    assert.strictEqual(body.error.stack, undefined);
    assert.strictEqual(body.stack, undefined);
  });

  test('X-Request-Id response header is returned on every response', async () => {
    const res = await fetch(`${baseUrl}/test-validation`);
    const headerId = res.headers.get('x-request-id');
    assert.ok(headerId, 'Response must include X-Request-Id header');
    assert.ok(headerId.length > 10, 'Request ID must be a non-empty UUID');
  });
});

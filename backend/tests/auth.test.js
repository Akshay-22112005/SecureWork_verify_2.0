const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const env = require('../src/config/env');
const { connectDB, disconnectDB } = require('../src/config/db');
const User = require('../src/models/user.model');

describe('Phase 2 Authentication & Security Tests', () => {
  let server;
  let baseUrl;

  before(async () => {
    await connectDB();
    await User.deleteMany({ email: /@authtest\.local$/ });

    await new Promise((resolve) => {
      server = app.listen(0, () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    try {
      await User.deleteMany({ email: /@authtest\.local$/ });
    } catch {
      // ignore cleanup errors
    }
    if (server) {
      if (typeof server.closeAllConnections === 'function') {
        server.closeAllConnections();
      }
      await new Promise((resolve) => server.close(resolve));
    }
    await disconnectDB();
  });

  test('successful registration creates USER role with hashed password and returns minimal JWT', async () => {
    const payload = {
      name: 'Alice Verifier',
      email: 'alice@authtest.local',
      password: 'StrongPassword123!'
    };

    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    assert.strictEqual(res.status, 201);
    const body = await res.json();

    assert.strictEqual(body.success, true);
    assert.ok(body.data.token, 'Must return JWT token');
    assert.ok(body.data.user, 'Must return user object');
    assert.strictEqual(body.data.user.role, 'USER');
    assert.ok(body.data.user.userId.startsWith('usr_'), 'userId must follow usr_ public identifier format');
    assert.strictEqual(body.data.user.email, 'alice@authtest.local');

    // Security assertion: passwordHash must NEVER be exposed in API response
    assert.strictEqual(body.data.user.passwordHash, undefined);
    assert.strictEqual(body.data.user.password, undefined);

    // Verify database record has secure bcrypt hash
    const dbUser = await User.findOne({ email: 'alice@authtest.local' }).select('+passwordHash');
    assert.ok(dbUser, 'User must exist in DB');
    assert.notStrictEqual(dbUser.passwordHash, payload.password, 'Password must not be stored in plaintext');
    assert.ok(
      dbUser.passwordHash.startsWith('$2a$') || dbUser.passwordHash.startsWith('$2b$'),
      'Password must be hashed with bcrypt'
    );

    // Verify JWT claims are minimal
    const decoded = jwt.verify(body.data.token, env.JWT_SECRET);
    assert.strictEqual(decoded.userId, dbUser.userId);
    assert.strictEqual(decoded.sub, dbUser.userId);
    assert.strictEqual(decoded.role, 'USER');
    assert.strictEqual(decoded.email, 'alice@authtest.local');
    assert.strictEqual(decoded.passwordHash, undefined);
  });

  test('duplicate email registration returns 409 DUPLICATE_EMAIL error', async () => {
    const payload = {
      name: 'Alice Duplicate',
      email: 'alice@authtest.local',
      password: 'AnotherPassword456!'
    };

    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    assert.strictEqual(res.status, 409);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, 'DUPLICATE_EMAIL');
    assert.ok(body.error.message.includes('already registered'));
  });

  test('public role injection attempt: specifying privileged role still creates USER', async () => {
    const payload = {
      name: 'Eve Malicious',
      email: 'eve@authtest.local',
      password: 'EvePassword123!',
      role: 'ADMIN', // Injection attempt
      status: 'SUSPENDED' // Status injection attempt
    };

    const res = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    assert.strictEqual(res.status, 201);
    const body = await res.json();

    // Security assertion: role must be forced to USER regardless of input
    assert.strictEqual(body.data.user.role, 'USER');
    assert.strictEqual(body.data.user.status, 'ACTIVE');

    const dbUser = await User.findOne({ email: 'eve@authtest.local' });
    assert.strictEqual(dbUser.role, 'USER', 'Database record role must be USER');
  });

  test('successful login returns 200 with token and user profile', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'alice@authtest.local',
        password: 'StrongPassword123!'
      })
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.data.token);
    assert.strictEqual(body.data.user.email, 'alice@authtest.local');
    assert.strictEqual(body.data.user.passwordHash, undefined);
  });

  test('invalid password returns 401 INVALID_CREDENTIALS', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'alice@authtest.local',
        password: 'WrongPassword999!'
      })
    });

    assert.strictEqual(res.status, 401);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, 'INVALID_CREDENTIALS');
  });

  test('non-existent email returns 401 INVALID_CREDENTIALS (prevents user enumeration)', async () => {
    const res = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'nobody@authtest.local',
        password: 'SomePassword123!'
      })
    });

    assert.strictEqual(res.status, 401);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, 'INVALID_CREDENTIALS');
  });

  test('GET /api/auth/me with valid JWT returns authenticated profile', async () => {
    // Login first to get token
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'alice@authtest.local',
        password: 'StrongPassword123!'
      })
    });
    const { data: { token } } = await loginRes.json();

    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    assert.strictEqual(meRes.status, 200);
    const meBody = await meRes.json();
    assert.strictEqual(meBody.success, true);
    assert.strictEqual(meBody.data.user.email, 'alice@authtest.local');
    assert.strictEqual(meBody.data.user.role, 'USER');
  });

  test('missing JWT returns 401 TOKEN_REQUIRED', async () => {
    const res = await fetch(`${baseUrl}/api/auth/me`);
    assert.strictEqual(res.status, 401);

    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, 'TOKEN_REQUIRED');
  });

  test('invalid / tampered JWT returns 401 INVALID_TOKEN', async () => {
    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: 'Bearer invalid.tampered.jwttokenhere' }
    });
    assert.strictEqual(res.status, 401);

    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, 'INVALID_TOKEN');
  });

  test('expired JWT returns 401 TOKEN_EXPIRED', async () => {
    // Generate an already-expired token (-10s)
    const expiredToken = jwt.sign(
      { sub: 'usr_expired123', userId: 'usr_expired123', role: 'USER', email: 'expired@authtest.local' },
      env.JWT_SECRET,
      { expiresIn: '-10s' }
    );

    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${expiredToken}` }
    });
    assert.strictEqual(res.status, 401);

    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, 'TOKEN_EXPIRED');
  });
});

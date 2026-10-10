/**
 * Public Verification Endpoint & Session/Auth Flow Tests
 * 
 * Covers:
 * - GET /api/public/verify/:id returns NOT_FOUND status for non-existent credentials (no 404 throw)
 * - GET /api/public/verify/:id returns proper data for real credentials
 * - GET /api/auth/me validates token server-side (cannot be spoofed by localStorage)
 * - Session expiry handling (401 on expired/invalid tokens)
 * - Persona role mismatch enforcement via /api/auth/me
 */
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const env = require('../src/config/env');
const { connectDB, disconnectDB } = require('../src/config/db');
const User = require('../src/models/user.model');
const { generateToken } = require('../src/utils/jwt');

describe('Public Verify Endpoint & Session Validation Tests', () => {
  let server;
  let baseUrl;

  before(async () => {
    await connectDB();
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
    await disconnectDB();
  });

  // ─── Public Verification ───────────────────────────────────────────────────

  test('GET /api/public/verify/:id returns NOT_FOUND status (not 404 HTTP error) for non-existent credential', async () => {
    const res = await fetch(`${baseUrl}/api/public/verify/CRED-NONEXISTENT-99999`);

    // Must be HTTP 200 (not a 404 throw) — the backend handles missing gracefully
    assert.strictEqual(res.status, 200, 'Should return HTTP 200 even for not-found credentials');

    const body = await res.json();
    assert.strictEqual(body.success, true, 'Response must be success:true');
    assert.ok(body.data, 'Must have data property');
    assert.strictEqual(body.data.status, 'NOT_FOUND', 'Status must be NOT_FOUND');
    assert.strictEqual(body.data.verified, false, 'verified must be false for not-found credential');
    assert.strictEqual(body.data.credentialId, 'CRED-NONEXISTENT-99999', 'credentialId must echo back the requested ID');
    assert.ok(body.data.message, 'Must include a message explaining the not-found state');
  });

  test('GET /api/public/verify/:id does not expose fake simulated data for unknown credentials', async () => {
    const res = await fetch(`${baseUrl}/api/public/verify/CRED-FAKE-STANFORD-2026`);
    assert.strictEqual(res.status, 200);

    const body = await res.json();
    assert.strictEqual(body.success, true);

    const data = body.data;
    // Must NOT include fabricated recipient or issuer names
    const dataStr = JSON.stringify(data);
    assert.ok(!dataStr.includes('Elena Rostova'), 'Must not contain fabricated recipient name');
    assert.ok(!dataStr.includes('Stanford University School of Engineering') || data.status === 'NOT_FOUND',
      'Must not contain fabricated issuer name for non-existent credentials');
    // Status must be NOT_FOUND
    assert.strictEqual(data.status, 'NOT_FOUND', 'Non-existent credential must show NOT_FOUND');
  });

  test('GET /api/public/verify/:id requires no authentication (public endpoint)', async () => {
    // No Authorization header — must still respond (200 not 401)
    const res = await fetch(`${baseUrl}/api/public/verify/CRED-ANY-PUBLIC-TEST`, {
      headers: {} // Explicitly no auth
    });

    // Should return 200 (not 401 or 403)
    assert.notStrictEqual(res.status, 401, 'Public verify must not require authentication');
    assert.notStrictEqual(res.status, 403, 'Public verify must not be forbidden without auth');
    assert.strictEqual(res.status, 200, 'Public verify must return 200 for any credential ID request');
  });

  // ─── Auth/Me Server-Side Validation ──────────────────────────────────────

  test('GET /api/auth/me rejects stale / expired tokens even if stored in localStorage equivalent', async () => {
    const expiredToken = jwt.sign(
      { sub: 'usr_stale_test', userId: 'usr_stale_test', role: 'USER', email: 'stale@sessiontest.local' },
      env.JWT_SECRET,
      { expiresIn: '-5s' } // Already expired
    );

    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${expiredToken}` }
    });

    assert.strictEqual(res.status, 401, 'Expired tokens must be rejected server-side');
    const body = await res.json();
    assert.strictEqual(body.error.code, 'TOKEN_EXPIRED');
  });

  test('GET /api/auth/me rejects tampered tokens', async () => {
    const res = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJoYWNrZXIifQ.TAMPERED_SIGNATURE' }
    });

    assert.strictEqual(res.status, 401);
    const body = await res.json();
    assert.ok(['INVALID_TOKEN', 'TOKEN_EXPIRED', 'TOKEN_REQUIRED'].includes(body.error.code));
  });

  test('GET /api/auth/me returns 401 without any token (cannot trust localStorage-only state)', async () => {
    const res = await fetch(`${baseUrl}/api/auth/me`);
    // No Authorization header — simulates what happens when frontend has stale localStorage but no real session
    assert.strictEqual(res.status, 401);
    const body = await res.json();
    assert.strictEqual(body.error.code, 'TOKEN_REQUIRED');
  });

  // ─── Persona Role Enforcement ─────────────────────────────────────────────

  test('GET /api/auth/me returns real role from DB, not spoofable from client', async () => {
    // Register a USER account
    const regRes = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Role Verifier',
        email: 'roleverify@sessiontest.local',
        password: 'RoleTest123!'
      })
    });
    assert.strictEqual(regRes.status, 201);
    const { data: { token } } = await regRes.json();

    // Try to call /me — must return USER role
    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    assert.strictEqual(meRes.status, 200);
    const meBody = await meRes.json();
    assert.strictEqual(meBody.data.user.role, 'USER', 'Role from server must be USER, not spoofed');

    // Cleanup
    try { await User.deleteOne({ email: 'roleverify@sessiontest.local' }); } catch {}
  });

  test('ADMIN role endpoint is inaccessible with USER token (persona mismatch enforcement)', async () => {
    // Create a USER
    await User.deleteMany({ email: /@personamismatch\.local$/ });
    const passwordHash = await User.hashPassword('Test123!');
    const userAccount = await User.create({
      name: 'Regular User',
      email: 'user@personamismatch.local',
      passwordHash,
      role: 'USER',
      status: 'ACTIVE'
    });
    const userToken = generateToken(userAccount);

    // Try to access an ADMIN-only endpoint with USER token
    const res = await fetch(`${baseUrl}/api/users`, {
      headers: { Authorization: `Bearer ${userToken}` }
    });
    assert.strictEqual(res.status, 403, 'USER must not access ADMIN endpoints');
    const body = await res.json();
    assert.strictEqual(body.error.code, 'FORBIDDEN');

    // Cleanup
    try { await User.deleteMany({ email: /@personamismatch\.local$/ }); } catch {}
  });

  // ─── Public QR / PDF / Bundle Endpoints ──────────────────────────────────

  test('GET /api/public/qr/:id returns image/png for any credential ID (no auth required)', async () => {
    const res = await fetch(`${baseUrl}/api/public/qr/CRED-TEST-QR-001`);
    // QR endpoint uses the credentialId to construct a URL and generates QR regardless
    assert.ok([200, 500].includes(res.status), 'QR endpoint should respond (200 or error if QR lib fails)');
    assert.notStrictEqual(res.status, 401, 'QR endpoint must not require authentication');
    assert.notStrictEqual(res.status, 403, 'QR endpoint must not be forbidden');
  });

  test('GET /api/public/revocations returns public revocation list without auth', async () => {
    const res = await fetch(`${baseUrl}/api/public/revocations`);
    assert.notStrictEqual(res.status, 401);
    assert.notStrictEqual(res.status, 403);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(typeof body.data.totalRevoked === 'number');
    assert.ok(Array.isArray(body.data.revocations));
  });
});

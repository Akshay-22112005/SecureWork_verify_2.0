const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const app = require('../src/app');
const { connectDB, disconnectDB } = require('../src/config/db');
const User = require('../src/models/user.model');
const { generateToken } = require('../src/utils/jwt');

describe('Phase 2 Role-Based Access Control (RBAC) & User Endpoint Tests', () => {
  let server;
  let baseUrl;

  let regularUser;
  let regularToken;

  let adminUser;
  let adminToken;

  let auditorUser;
  let auditorToken;

  let hrUser;
  let hrToken;

  let issuerUser;
  let issuerToken;

  before(async () => {
    await connectDB();
    await User.deleteMany({ email: /@rbactest\.local$/ });

    const passwordHash = await User.hashPassword('SecretPass123!');

    // Create test accounts across roles
    regularUser = await User.create({
      name: 'Regular Bob',
      email: 'bob@rbactest.local',
      passwordHash,
      role: 'USER',
      status: 'ACTIVE'
    });
    regularToken = generateToken(regularUser);

    adminUser = await User.create({
      name: 'Admin Alice',
      email: 'admin@rbactest.local',
      passwordHash,
      role: 'ADMIN',
      status: 'ACTIVE'
    });
    adminToken = generateToken(adminUser);

    auditorUser = await User.create({
      name: 'Auditor Dan',
      email: 'auditor@rbactest.local',
      passwordHash,
      role: 'AUDITOR',
      status: 'ACTIVE'
    });
    auditorToken = generateToken(auditorUser);

    hrUser = await User.create({
      name: 'HR Carol',
      email: 'hr@rbactest.local',
      passwordHash,
      role: 'HR',
      status: 'ACTIVE'
    });
    hrToken = generateToken(hrUser);

    issuerUser = await User.create({
      name: 'Issuer Frank',
      email: 'issuer@rbactest.local',
      passwordHash,
      role: 'ISSUER',
      status: 'ACTIVE'
    });
    issuerToken = generateToken(issuerUser);

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
      await User.deleteMany({ email: /@rbactest\.local$/ });
    } catch {
      // ignore
    }
    if (server) {
      if (typeof server.closeAllConnections === 'function') {
        server.closeAllConnections();
      }
      await new Promise((resolve) => server.close(resolve));
    }
    await disconnectDB();
  });

  test('GET /api/users/me returns authenticated user data', async () => {
    const res = await fetch(`${baseUrl}/api/users/me`, {
      headers: { Authorization: `Bearer ${regularToken}` }
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.user.email, 'bob@rbactest.local');
    assert.strictEqual(body.data.user.role, 'USER');
    assert.strictEqual(body.data.user.passwordHash, undefined);
  });

  test('PATCH /api/users/me allows updating name but PREVENTS role escalation', async () => {
    const res = await fetch(`${baseUrl}/api/users/me`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${regularToken}`
      },
      body: JSON.stringify({
        name: 'Bob Updated Name',
        role: 'ADMIN', // Privilege escalation attempt
        status: 'SUSPENDED' // Status escalation attempt
      })
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.user.name, 'Bob Updated Name');

    // Security assertion: Role MUST remain USER
    assert.strictEqual(body.data.user.role, 'USER');
    assert.strictEqual(body.data.user.status, 'ACTIVE');

    // Verify directly in database
    const dbUser = await User.findOne({ userId: regularUser.userId });
    assert.strictEqual(dbUser.name, 'Bob Updated Name');
    assert.strictEqual(dbUser.role, 'USER', 'Database role must not have changed');
    assert.strictEqual(dbUser.status, 'ACTIVE');
  });

  test('GET /api/users/:id allows user to view their own profile', async () => {
    const res = await fetch(`${baseUrl}/api/users/${regularUser.userId}`, {
      headers: { Authorization: `Bearer ${regularToken}` }
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.user.userId, regularUser.userId);
  });

  test('USER attempting to view another user profile returns 403 FORBIDDEN', async () => {
    const res = await fetch(`${baseUrl}/api/users/${adminUser.userId}`, {
      headers: { Authorization: `Bearer ${regularToken}` }
    });

    assert.strictEqual(res.status, 403);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, 'FORBIDDEN');
    assert.ok(body.error.message.includes('Access denied'));
  });

  test('ADMIN can view any user profile', async () => {
    const res = await fetch(`${baseUrl}/api/users/${regularUser.userId}`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.user.userId, regularUser.userId);
  });

  test('AUDITOR can view any user profile for auditing purposes', async () => {
    const res = await fetch(`${baseUrl}/api/users/${regularUser.userId}`, {
      headers: { Authorization: `Bearer ${auditorToken}` }
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.user.userId, regularUser.userId);
  });

  test('USER attempting to modify user roles returns 403 FORBIDDEN', async () => {
    const res = await fetch(`${baseUrl}/api/users/${regularUser.userId}/role`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${regularToken}`
      },
      body: JSON.stringify({ role: 'HR' })
    });

    assert.strictEqual(res.status, 403);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, 'FORBIDDEN');
  });

  test('ADMIN can assign privileged roles (e.g. HR, ISSUER, AUDITOR)', async () => {
    const res = await fetch(`${baseUrl}/api/users/${regularUser.userId}/role`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ role: 'HR' })
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.user.role, 'HR');

    // Verify in DB
    const dbUser = await User.findOne({ userId: regularUser.userId });
    assert.strictEqual(dbUser.role, 'HR');

    // Reset back to USER
    await User.updateOne({ userId: regularUser.userId }, { role: 'USER' });
  });

  test('ADMIN assigning invalid role returns 400 VALIDATION_ERROR', async () => {
    const res = await fetch(`${baseUrl}/api/users/${regularUser.userId}/role`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ role: 'SUPER_ROOT' })
    });

    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, 'VALIDATION_ERROR');
  });

  test('USER accessing GET /api/users directory returns 403 FORBIDDEN', async () => {
    const res = await fetch(`${baseUrl}/api/users`, {
      headers: { Authorization: `Bearer ${regularToken}` }
    });

    assert.strictEqual(res.status, 403);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, 'FORBIDDEN');
  });

  test('ADMIN accessing GET /api/users directory returns 200 with list', async () => {
    const res = await fetch(`${baseUrl}/api/users`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(Array.isArray(body.data.users));
    assert.ok(body.data.total >= 5);
  });

  test('AUDITOR accessing GET /api/users directory returns 200 with list', async () => {
    const res = await fetch(`${baseUrl}/api/users`, {
      headers: { Authorization: `Bearer ${auditorToken}` }
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(Array.isArray(body.data.users));
  });

  test('Role model constants strictly include ADMIN, ISSUER, HR, USER, AUDITOR', () => {
    const { ROLES } = require('../src/models/user.model');
    assert.deepStrictEqual(ROLES.sort(), ['ADMIN', 'AUDITOR', 'HR', 'ISSUER', 'USER'].sort());
  });
});

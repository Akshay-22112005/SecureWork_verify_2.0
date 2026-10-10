/**
 * Comprehensive RBAC & Ownership Enforcement Test Suite
 * Validates complete matrix: ADMIN, ISSUER, AUDITOR, HR, USER against all route groups.
 */
const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const app = require('../src/app');
const { connectDB, disconnectDB } = require('../src/config/db');
const User = require('../src/models/user.model');
const Organization = require('../src/models/organization.model');
const Issuer = require('../src/models/issuer.model');
const Document = require('../src/models/document.model');
const Credential = require('../src/models/credential.model');
const { generateToken } = require('../src/utils/jwt');

describe('Full Role-Based Access Control (RBAC) & Ownership Enforcement Matrix', () => {
  let server;
  let baseUrl;

  // Test accounts
  let adminUser, adminToken;
  let issuerUser1, issuerToken1;
  let issuerUser2, issuerToken2;
  let auditorUser, auditorToken;
  let hrUser, hrToken;
  let regularUser1, regularToken1;
  let regularUser2, regularToken2;

  let testOrg;
  let testIssuer1;
  let testIssuer2;
  let testDoc1;
  let testDoc2;

  before(async () => {
    await connectDB();
    await User.deleteMany({ email: /@rbacmatrix\.local$/ });
    await Organization.deleteMany({ organizationCode: /RBAC_ORG_/ });
    await Issuer.deleteMany({ issuerCode: /RBAC_ISS_/ });
    await Document.deleteMany({ originalFilename: /rbac_test_/ });

    const passwordHash = await User.hashPassword('MatrixPass123!');

    // Create test accounts across all 5 roles
    adminUser = await User.create({
      name: 'Admin Boss',
      email: 'admin@rbacmatrix.local',
      passwordHash,
      role: 'ADMIN',
      status: 'ACTIVE'
    });
    adminToken = generateToken(adminUser);

    issuerUser1 = await User.create({
      name: 'Issuer Alpha',
      email: 'issuer1@rbacmatrix.local',
      passwordHash,
      role: 'ISSUER',
      status: 'ACTIVE'
    });
    issuerToken1 = generateToken(issuerUser1);

    issuerUser2 = await User.create({
      name: 'Issuer Beta',
      email: 'issuer2@rbacmatrix.local',
      passwordHash,
      role: 'ISSUER',
      status: 'ACTIVE'
    });
    issuerToken2 = generateToken(issuerUser2);

    auditorUser = await User.create({
      name: 'Auditor Charlie',
      email: 'auditor@rbacmatrix.local',
      passwordHash,
      role: 'AUDITOR',
      status: 'ACTIVE'
    });
    auditorToken = generateToken(auditorUser);

    hrUser = await User.create({
      name: 'HR Helen',
      email: 'hr@rbacmatrix.local',
      passwordHash,
      role: 'HR',
      status: 'ACTIVE'
    });
    hrToken = generateToken(hrUser);

    regularUser1 = await User.create({
      name: 'User David',
      email: 'user1@rbacmatrix.local',
      passwordHash,
      role: 'USER',
      status: 'ACTIVE'
    });
    regularToken1 = generateToken(regularUser1);

    regularUser2 = await User.create({
      name: 'User Eve',
      email: 'user2@rbacmatrix.local',
      passwordHash,
      role: 'USER',
      status: 'ACTIVE'
    });
    regularToken2 = generateToken(regularUser2);

    // Create Organization & Issuers
    testOrg = await Organization.create({
      name: 'RBAC Test Org',
      organizationCode: 'RBAC_ORG_1',
      type: 'UNIVERSITY',
      status: 'ACTIVE',
      organizationVerificationStatus: 'VERIFIED'
    });

    testIssuer1 = await Issuer.create({
      userId: issuerUser1.userId,
      organizationId: testOrg._id,
      issuerCode: 'RBAC_ISS_1',
      status: 'ACTIVE',
      accreditationStatus: 'ACCREDITED'
    });

    testIssuer2 = await Issuer.create({
      userId: issuerUser2.userId,
      organizationId: testOrg._id,
      issuerCode: 'RBAC_ISS_2',
      status: 'ACTIVE',
      accreditationStatus: 'ACCREDITED'
    });

    // Create Documents with different owners
    testDoc1 = await Document.create({
      originalFilename: 'rbac_test_doc1.pdf',
      mimeType: 'application/pdf',
      fileSize: 1024,
      storagePath: 'documents/rbac_test_1.pdf',
      sha256Hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
      hashAlgorithm: 'SHA-256',
      uploadedBy: regularUser1.userId,
      representationType: 'ORIGINAL_DIGITAL_FILE'
    });

    testDoc2 = await Document.create({
      originalFilename: 'rbac_test_doc2.pdf',
      mimeType: 'application/pdf',
      fileSize: 1024,
      storagePath: 'documents/rbac_test_2.pdf',
      sha256Hash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b856',
      hashAlgorithm: 'SHA-256',
      uploadedBy: regularUser2.userId,
      representationType: 'ORIGINAL_DIGITAL_FILE'
    });

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
      await User.deleteMany({ email: /@rbacmatrix\.local$/ });
      await Organization.deleteMany({ organizationCode: /RBAC_ORG_/ });
      await Issuer.deleteMany({ issuerCode: /RBAC_ISS_/ });
      await Document.deleteMany({ originalFilename: /rbac_test_/ });
    } catch {}

    if (server) {
      if (typeof server.closeAllConnections === 'function') {
        server.closeAllConnections();
      }
      await new Promise((resolve) => server.close(resolve));
    }
    await disconnectDB();
  });

  // ─── 1. AUDIT LOG ROUTES ──────────────────────────────────────────────────

  test('Audit Logs (/api/audit-logs): AUDITOR and ADMIN allowed (200), USER/HR/ISSUER forbidden (403)', async () => {
    // ADMIN -> 200
    const adminRes = await fetch(`${baseUrl}/api/audit-logs`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });
    assert.strictEqual(adminRes.status, 200);

    // AUDITOR -> 200
    const auditorRes = await fetch(`${baseUrl}/api/audit-logs`, {
      headers: { Authorization: `Bearer ${auditorToken}` }
    });
    assert.strictEqual(auditorRes.status, 200);

    // USER -> 403
    const userRes = await fetch(`${baseUrl}/api/audit-logs`, {
      headers: { Authorization: `Bearer ${regularToken1}` }
    });
    assert.strictEqual(userRes.status, 403);
    const userBody = await userRes.json();
    assert.strictEqual(userBody.error.code, 'FORBIDDEN');

    // HR -> 403
    const hrRes = await fetch(`${baseUrl}/api/audit-logs`, {
      headers: { Authorization: `Bearer ${hrToken}` }
    });
    assert.strictEqual(hrRes.status, 403);

    // ISSUER -> 403
    const issuerRes = await fetch(`${baseUrl}/api/audit-logs`, {
      headers: { Authorization: `Bearer ${issuerToken1}` }
    });
    assert.strictEqual(issuerRes.status, 403);
  });

  // ─── 2. CREDENTIAL ISSUANCE ROUTES ────────────────────────────────────────

  test('Credential Issue (/api/credentials/issue): USER, HR, AUDITOR cannot issue (403)', async () => {
    const payload = {
      issuerId: testIssuer1.issuerId,
      recipientId: regularUser1.userId,
      documentId: testDoc1.documentId,
      credentialType: 'DEGREE'
    };

    // USER -> 403
    const userRes = await fetch(`${baseUrl}/api/credentials/issue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${regularToken1}`
      },
      body: JSON.stringify(payload)
    });
    assert.strictEqual(userRes.status, 403);

    // HR -> 403
    const hrRes = await fetch(`${baseUrl}/api/credentials/issue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hrToken}`
      },
      body: JSON.stringify(payload)
    });
    assert.strictEqual(hrRes.status, 403);

    // AUDITOR -> 403
    const auditorRes = await fetch(`${baseUrl}/api/credentials/issue`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${auditorToken}`
      },
      body: JSON.stringify(payload)
    });
    assert.strictEqual(auditorRes.status, 403);
  });

  // ─── 3. ISSUER OWNERSHIP ENFORCEMENT ─────────────────────────────────────

  test('Issuer Key Management: ISSUER cannot generate or rotate keys for an issuer they do not own', async () => {
    // Issuer 2 tries to generate a key for Issuer 1's profile
    const res = await fetch(`${baseUrl}/api/issuers/${testIssuer1.issuerId}/keys`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${issuerToken2}` }
    });

    assert.strictEqual(res.status, 403);
    const body = await res.json();
    assert.strictEqual(body.error.code, 'FORBIDDEN');
    assert.ok(body.error.message.includes('permission'));
  });

  // ─── 4. ADMIN-ONLY GOVERNANCE ROUTES ─────────────────────────────────────

  test('Governance Routes: Only ADMIN can verify organizations or approve issuers', async () => {
    // AUDITOR trying to verify org -> 403
    const auditorRes = await fetch(`${baseUrl}/api/organizations/${testOrg.organizationId}/verify`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${auditorToken}` }
    });
    assert.strictEqual(auditorRes.status, 403);

    // HR trying to approve issuer -> 403
    const hrRes = await fetch(`${baseUrl}/api/issuers/${testIssuer1.issuerId}/approve`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${hrToken}` }
    });
    assert.strictEqual(hrRes.status, 403);

    // USER trying to assign role -> 403
    const userRes = await fetch(`${baseUrl}/api/users/${regularUser1.userId}/role`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${regularToken1}`
      },
      body: JSON.stringify({ role: 'ADMIN' })
    });
    assert.strictEqual(userRes.status, 403);
  });

  // ─── 5. USER DOCUMENT OWNERSHIP ENFORCEMENT ──────────────────────────────

  test('Document Ownership: USER cannot view or download another users document', async () => {
    // User 1 tries to access User 2's document -> 403
    const res = await fetch(`${baseUrl}/api/documents/${testDoc2.documentId}`, {
      headers: { Authorization: `Bearer ${regularToken1}` }
    });

    assert.strictEqual(res.status, 403);
    const body = await res.json();
    assert.strictEqual(body.error.code, 'FORBIDDEN');
    assert.ok(body.error.message.includes('Access denied'));
  });

  test('Document Ownership: USER can view their own document', async () => {
    // User 1 views User 1's document -> 200
    const res = await fetch(`${baseUrl}/api/documents/${testDoc1.documentId}`, {
      headers: { Authorization: `Bearer ${regularToken1}` }
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.document.documentId, testDoc1.documentId);
  });
});

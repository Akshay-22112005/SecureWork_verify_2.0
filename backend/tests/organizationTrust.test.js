const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const app = require('../src/app');
const { connectDB, disconnectDB } = require('../src/config/db');
const User = require('../src/models/user.model');
const Organization = require('../src/models/organization.model');
const Issuer = require('../src/models/issuer.model');
const auditService = require('../src/services/audit.service');
const { generateToken } = require('../src/utils/jwt');

describe('Phase 3 Organization Trust & Issuer Authorization Tests', () => {
  let server;
  let baseUrl;

  let adminUser;
  let adminToken;

  let regularUser;
  let regularToken;

  let secondUser;
  let secondToken;

  before(async () => {
    await connectDB();
    await User.deleteMany({ email: /@trusttest\.local$/ });
    await Organization.deleteMany({ officialDomain: /trusttest\.local$/ });
    await Issuer.deleteMany({ issuerCode: /^ISS_TEST_/ });

    const passwordHash = await User.hashPassword('Pass123456!');

    adminUser = await User.create({
      name: 'Trust Admin',
      email: 'admin@trusttest.local',
      passwordHash,
      role: 'ADMIN',
      status: 'ACTIVE'
    });
    adminToken = generateToken(adminUser);

    regularUser = await User.create({
      name: 'Prospective Issuer',
      email: 'issuer.candidate@trusttest.local',
      passwordHash,
      role: 'USER',
      status: 'ACTIVE'
    });
    regularToken = generateToken(regularUser);

    secondUser = await User.create({
      name: 'Second Candidate',
      email: 'second.candidate@trusttest.local',
      passwordHash,
      role: 'USER',
      status: 'ACTIVE'
    });
    secondToken = generateToken(secondUser);

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
      await User.deleteMany({ email: /@trusttest\.local$/ });
      await Organization.deleteMany({ officialDomain: /trusttest\.local$/ });
      await Issuer.deleteMany({ issuerCode: /^ISS_TEST_/ });
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

  let createdOrgId;
  let verifiedOrgId;
  let createdIssuerId;

  test('organization creation starts in PENDING status and does NOT auto-trust domain', async () => {
    const payload = {
      organizationCode: 'ORG_TEST_ACADEMY',
      name: 'Global Technical Academy',
      type: 'UNIVERSITY',
      officialDomain: 'academy.trusttest.local',
      verificationEvidence: {
        registrationNumber: 'ACAD-2026-99',
        accreditationCouncil: 'Higher Ed Board'
      }
    };

    const res = await fetch(`${baseUrl}/api/organizations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${regularToken}`
      },
      body: JSON.stringify(payload)
    });

    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.success, true);

    const org = body.data.organization;
    createdOrgId = org.organizationId;

    assert.strictEqual(org.organizationCode, 'ORG_TEST_ACADEMY');
    assert.strictEqual(org.name, 'Global Technical Academy');
    assert.strictEqual(org.type, 'UNIVERSITY');
    assert.strictEqual(org.officialDomain, 'academy.trusttest.local');

    // Security assertion: Must start as PENDING, domain is not auto-trusted
    assert.strictEqual(org.organizationVerificationStatus, 'PENDING');
    assert.strictEqual(org.status, 'PENDING');
    assert.deepStrictEqual(org.verificationMethods, ['ADMIN_REVIEW']);
    assert.strictEqual(org.verifiedBy, null);
    assert.strictEqual(org.verifiedAt, null);
  });

  test('unauthorized role access: non-admin cannot verify an organization', async () => {
    const res = await fetch(`${baseUrl}/api/organizations/${createdOrgId}/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${regularToken}` // Regular USER role
      },
      body: JSON.stringify({ notes: 'Self verify attempt' })
    });

    assert.strictEqual(res.status, 403);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, 'FORBIDDEN');
  });

  test('organization approval: ADMIN verifies organization via ADMIN_REVIEW', async () => {
    const res = await fetch(`${baseUrl}/api/organizations/${createdOrgId}/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        verificationEvidence: {
          inspectorNotes: 'Official accreditation verified with ministry records'
        }
      })
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);

    const org = body.data.organization;
    verifiedOrgId = org.organizationId;

    assert.strictEqual(org.organizationVerificationStatus, 'VERIFIED');
    assert.strictEqual(org.status, 'ACTIVE');
    assert.strictEqual(org.verifiedBy, adminUser.userId);
    assert.ok(org.verifiedAt, 'verifiedAt timestamp must be recorded');
    assert.deepStrictEqual(org.verificationMethods, ['ADMIN_REVIEW']);
  });

  test('issuer registration rejected if organization is unverified/pending', async () => {
    // Create an unverified org
    const unverifiedOrg = await Organization.create({
      organizationCode: 'ORG_TEST_PENDING',
      name: 'Unverified Institute',
      type: 'COMPANY',
      officialDomain: 'unverified.trusttest.local',
      organizationVerificationStatus: 'PENDING',
      status: 'PENDING',
      createdBy: regularUser.userId
    });

    const res = await fetch(`${baseUrl}/api/issuers/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${regularToken}`
      },
      body: JSON.stringify({
        organizationId: unverifiedOrg.organizationId,
        issuerCode: 'ISS_TEST_UNVERIFIED'
      })
    });

    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, 'ORGANIZATION_NOT_VERIFIED');
  });

  test('issuer registration creates PENDING profile belonging to verified organization', async () => {
    const res = await fetch(`${baseUrl}/api/issuers/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${regularToken}`
      },
      body: JSON.stringify({
        organizationId: verifiedOrgId,
        issuerCode: 'ISS_TEST_REGISTRAR',
        authorizationEvidence: {
          position: 'Dean of Academic Records',
          delegationLetterId: 'DL-9082'
        }
      })
    });

    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.success, true);

    const issuer = body.data.issuer;
    createdIssuerId = issuer.issuerId;

    assert.strictEqual(issuer.issuerCode, 'ISS_TEST_REGISTRAR');
    assert.strictEqual(issuer.userId, regularUser.userId);
    assert.strictEqual(issuer.organizationId, verifiedOrgId);

    // Security assertion: Initial status is strictly PENDING
    assert.strictEqual(issuer.status, 'PENDING');
    assert.strictEqual(issuer.approvedBy, null);
    assert.strictEqual(issuer.approvedAt, null);
  });

  test('one issuer profile per user constraint: duplicate registration fails with 409', async () => {
    const res = await fetch(`${baseUrl}/api/issuers/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${regularToken}` // Same user who already registered
      },
      body: JSON.stringify({
        organizationId: verifiedOrgId,
        issuerCode: 'ISS_TEST_DUPLICATE'
      })
    });

    assert.strictEqual(res.status, 409);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, 'DUPLICATE_ISSUER_PROFILE');
  });

  test('unauthorized role access: non-admin cannot approve an issuer', async () => {
    const res = await fetch(`${baseUrl}/api/issuers/${createdIssuerId}/approve`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${regularToken}`
      },
      body: JSON.stringify({ notes: 'Self approve attempt' })
    });

    assert.strictEqual(res.status, 403);
    const body = await res.json();
    assert.strictEqual(body.success, false);
    assert.strictEqual(body.error.code, 'FORBIDDEN');
  });

  test('issuer approval: ADMIN approves issuer, sets ACTIVE and promotes user role to ISSUER', async () => {
    const res = await fetch(`${baseUrl}/api/issuers/${createdIssuerId}/approve`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ notes: 'Credentials and identity verified' })
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);

    const issuer = body.data.issuer;
    assert.strictEqual(issuer.status, 'ACTIVE');
    assert.strictEqual(issuer.approvedBy, adminUser.userId);
    assert.ok(issuer.approvedAt);

    // Verify user role was promoted in User model
    const dbUser = await User.findOne({ userId: regularUser.userId });
    assert.strictEqual(dbUser.role, 'ISSUER');
  });

  test('issuer may view own issuer information via GET /api/issuers/me', async () => {
    const res = await fetch(`${baseUrl}/api/issuers/me`, {
      headers: { Authorization: `Bearer ${regularToken}` }
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.issuer.issuerId, createdIssuerId);
    assert.strictEqual(body.data.issuer.organizationId, verifiedOrgId);
    assert.strictEqual(body.data.issuer.status, 'ACTIVE');
  });

  test('issuer suspension: ADMIN suspends issuer', async () => {
    const res = await fetch(`${baseUrl}/api/issuers/${createdIssuerId}/suspend`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ reason: 'Investigation into signing irregularities' })
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.issuer.status, 'SUSPENDED');
  });

  test('issuer revocation: ADMIN revokes issuer and reverts user role back to USER', async () => {
    const res = await fetch(`${baseUrl}/api/issuers/${createdIssuerId}/revoke`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ reason: 'Permanent withdrawal of accreditation' })
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.issuer.status, 'REVOKED');

    // Verify user role reverted
    const dbUser = await User.findOne({ userId: regularUser.userId });
    assert.strictEqual(dbUser.role, 'USER');
  });

  test('organization suspension: ADMIN suspends organization and cascades to member issuers', async () => {
    // Register second candidate under verifiedOrg
    const secondIssuer = await Issuer.create({
      issuerCode: 'ISS_TEST_SECOND',
      userId: secondUser.userId,
      organizationId: verifiedOrgId,
      status: 'ACTIVE'
    });

    const res = await fetch(`${baseUrl}/api/organizations/${verifiedOrgId}/suspend`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ reason: 'Accreditation audit pending' })
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.organization.organizationVerificationStatus, 'SUSPENDED');
    assert.strictEqual(body.data.organization.status, 'SUSPENDED');

    // Verify cascaded suspension to member issuer
    const dbIssuer = await Issuer.findOne({ issuerId: secondIssuer.issuerId });
    assert.strictEqual(dbIssuer.status, 'SUSPENDED');
  });

  test('organization revocation: ADMIN revokes organization and cascades to member issuers', async () => {
    const res = await fetch(`${baseUrl}/api/organizations/${verifiedOrgId}/revoke`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({ reason: 'Institution deregistered' })
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.organization.organizationVerificationStatus, 'REVOKED');
    assert.strictEqual(body.data.organization.status, 'REVOKED');

    // Verify member issuer is revoked
    const dbIssuer = await Issuer.findOne({ organizationId: verifiedOrgId });
    assert.strictEqual(dbIssuer.status, 'REVOKED');
  });

  test('AuditService records trust events for organizations and issuers', async () => {
    const auditTrail = await auditService.getResourceAuditTrail(createdOrgId);
    assert.ok(Array.isArray(auditTrail));
    assert.ok(auditTrail.length >= 1);

    const actions = auditTrail.map(e => e.action);
    assert.ok(actions.includes('ORGANIZATION_CREATED'));
    assert.ok(actions.includes('ORGANIZATION_VERIFIED'));
  });
});

/**
 * Section C: Persona Features Automated Test Suite
 * Tests:
 * - HR candidate lookup (GET /api/hr/subjects/:userIdOrEmail/credentials)
 * - HR credential evaluation & ownership verification (POST /api/hr/verify)
 * - HR audit logging & RBAC restrictions
 * - Issuer recipient email lookup & document metadata privacy (GET /api/issuers/recipients/lookup)
 * - Issuer Key expiresAt calculation & lifecycle
 * - Audit log serialization (actorId, actorRole, targetResource)
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
const AuditLog = require('../src/models/auditLog.model');
const { generateToken } = require('../src/utils/jwt');
const credentialService = require('../src/services/credential.service');
const issuerKeyService = require('../src/services/issuerKey.service');

describe('Section C — Persona Features & Integration Tests', () => {
  let server;
  let baseUrl;

  let adminUser, adminToken;
  let hrUser, hrToken;
  let issuerUser, issuerToken;
  let auditorUser, auditorToken;
  let candidateUser, candidateToken;
  let otherUser, otherToken;

  let testOrg;
  let testIssuer;
  let testKey;
  let testDoc;
  let testCred;

  before(async () => {
    await connectDB();
    await User.deleteMany({ email: /@personatest\.local$/ });
    await Organization.deleteMany({ organizationCode: /PERSONA_ORG_/ });
    await Issuer.deleteMany({ issuerCode: /PERSONA_ISS_/ });
    await Document.deleteMany({ originalFilename: /persona_test_/ });

    const passwordHash = await User.hashPassword('PersonaPass123!');

    adminUser = await User.create({
      name: 'Persona Admin',
      email: 'admin@personatest.local',
      passwordHash,
      role: 'ADMIN',
      status: 'ACTIVE'
    });
    adminToken = generateToken(adminUser);

    hrUser = await User.create({
      name: 'Persona HR',
      email: 'hr@personatest.local',
      passwordHash,
      role: 'HR',
      status: 'ACTIVE'
    });
    hrToken = generateToken(hrUser);

    issuerUser = await User.create({
      name: 'Persona Issuer',
      email: 'issuer@personatest.local',
      passwordHash,
      role: 'ISSUER',
      status: 'ACTIVE'
    });
    issuerToken = generateToken(issuerUser);

    auditorUser = await User.create({
      name: 'Persona Auditor',
      email: 'auditor@personatest.local',
      passwordHash,
      role: 'AUDITOR',
      status: 'ACTIVE'
    });
    auditorToken = generateToken(auditorUser);

    candidateUser = await User.create({
      name: 'Candidate Scholar',
      email: 'scholar@personatest.local',
      passwordHash,
      role: 'USER',
      status: 'ACTIVE'
    });
    candidateToken = generateToken(candidateUser);

    otherUser = await User.create({
      name: 'Other User',
      email: 'other@personatest.local',
      passwordHash,
      role: 'USER',
      status: 'ACTIVE'
    });
    otherToken = generateToken(otherUser);

    testOrg = await Organization.create({
      name: 'Persona University',
      organizationCode: 'PERSONA_ORG_1',
      type: 'UNIVERSITY',
      status: 'ACTIVE',
      organizationVerificationStatus: 'VERIFIED',
      officialDomain: 'personatest.edu'
    });

    testIssuer = await Issuer.create({
      userId: issuerUser.userId,
      organizationId: testOrg.organizationId,
      issuerCode: 'PERSONA_ISS_1',
      name: 'Persona Credentials Authority',
      status: 'ACTIVE',
      accreditationStatus: 'ACCREDITED'
    });

    testKey = await issuerKeyService.generateKeyForIssuer(testIssuer.issuerId, adminUser);

    testDoc = await Document.create({
      originalFilename: 'persona_test_diploma.pdf',
      mimeType: 'application/pdf',
      fileSize: 2048,
      storagePath: 'documents/persona_test_diploma.pdf',
      sha256Hash: 'a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90',
      hashAlgorithm: 'SHA-256',
      uploadedBy: candidateUser.userId,
      representationType: 'ORIGINAL_DIGITAL_FILE'
    });

    const issued = await credentialService.issueCredential({
      issuerId: testIssuer.issuerId,
      recipientId: candidateUser.userId,
      documentId: testDoc.documentId,
      credentialType: 'DEGREE',
      title: 'Master of Science in Distributed Systems'
    }, adminUser);

    testCred = issued.credential;

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
      await User.deleteMany({ email: /@personatest\.local$/ });
      await Organization.deleteMany({ organizationCode: /PERSONA_ORG_/ });
      await Issuer.deleteMany({ issuerCode: /PERSONA_ISS_/ });
      await Document.deleteMany({ originalFilename: /persona_test_/ });
    } catch {}

    if (server) {
      if (typeof server.closeAllConnections === 'function') {
        server.closeAllConnections();
      }
      await new Promise((resolve) => server.close(resolve));
    }
    await disconnectDB();
  });

  // ─── 1. HR CANDIDATE LOOKUP & CREDENTIALS ENUMERATION ───────────────────

  test('GET /api/hr/subjects/:userIdOrEmail/credentials allows HR to query candidate by email and lists credentials', async () => {
    const res = await fetch(`${baseUrl}/api/hr/subjects/${encodeURIComponent('scholar@personatest.local')}/credentials`, {
      headers: { Authorization: `Bearer ${hrToken}` }
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.subject.email, 'scholar@personatest.local');
    assert.strictEqual(body.data.subject.userId, candidateUser.userId);
    assert.ok(Array.isArray(body.data.credentials));
    assert.ok(body.data.credentials.length >= 1);

    const cred = body.data.credentials[0];
    assert.strictEqual(cred.credentialId, testCred.credentialId);
    assert.strictEqual(cred.title, 'Master of Science in Distributed Systems');
    assert.strictEqual(cred.credentialType, 'DEGREE');
    assert.strictEqual(cred.organization.verificationStatus, 'VERIFIED');
    assert.strictEqual(cred.organization.isVerified, true);
    assert.strictEqual(cred.signatureValid, true);

    // Verify audit log record was created
    const auditRecord = await AuditLog.findOne({
      action: 'HR_CANDIDATE_LOOKUP',
      targetId: candidateUser.userId
    }).sort({ createdAt: -1 });
    assert.ok(auditRecord, 'Audit log must record HR candidate lookup');
    assert.strictEqual(auditRecord.performedBy, hrUser.userId);
  });

  test('GET /api/hr/subjects/:userIdOrEmail/credentials returns 404 for unknown user', async () => {
    const res = await fetch(`${baseUrl}/api/hr/subjects/nonexistent_user@unknown.local/credentials`, {
      headers: { Authorization: `Bearer ${hrToken}` }
    });

    assert.strictEqual(res.status, 404);
    const body = await res.json();
    assert.strictEqual(body.error.code, 'USER_NOT_FOUND');
  });

  test('GET /api/hr/subjects/:userIdOrEmail/credentials rejects unauthorized roles (403)', async () => {
    // USER role
    const userRes = await fetch(`${baseUrl}/api/hr/subjects/${candidateUser.userId}/credentials`, {
      headers: { Authorization: `Bearer ${candidateToken}` }
    });
    assert.strictEqual(userRes.status, 403);

    // AUDITOR role
    const auditorRes = await fetch(`${baseUrl}/api/hr/subjects/${candidateUser.userId}/credentials`, {
      headers: { Authorization: `Bearer ${auditorToken}` }
    });
    assert.strictEqual(auditorRes.status, 403);
  });

  // ─── 2. HR CREDENTIAL VERIFICATION ──────────────────────────────────────

  test('POST /api/hr/verify executes verification evaluation for candidate credential', async () => {
    const res = await fetch(`${baseUrl}/api/hr/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hrToken}`
      },
      body: JSON.stringify({
        credentialId: testCred.credentialId,
        subjectIdOrEmail: candidateUser.email
      })
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.result, 'VERIFIED');
    assert.strictEqual(body.data.trustLevel, 'LEVEL 5 CURRENTLY_VALID');
    assert.strictEqual(body.data.checks.digitalSignature.passed, true);
    assert.strictEqual(body.data.checks.organizationTrust.passed, true);
  });

  test('POST /api/hr/verify rejects when credential does not belong to specified subject', async () => {
    const res = await fetch(`${baseUrl}/api/hr/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${hrToken}`
      },
      body: JSON.stringify({
        credentialId: testCred.credentialId,
        subjectIdOrEmail: otherUser.email // Wrong subject
      })
    });

    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.error.code, 'CREDENTIAL_NOT_OWNED_BY_SUBJECT');
  });

  // ─── 3. ISSUER RECIPIENT LOOKUP & DOCUMENT ATTACHMENT ──────────────────

  test('GET /api/issuers/recipients/lookup returns recipient uploads for ISSUER and creates privacy audit entry', async () => {
    const res = await fetch(`${baseUrl}/api/issuers/recipients/lookup?email=${encodeURIComponent('scholar@personatest.local')}`, {
      headers: { Authorization: `Bearer ${issuerToken}` }
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.strictEqual(body.data.found, true);
    assert.strictEqual(body.data.recipient.userId, candidateUser.userId);
    assert.strictEqual(body.data.recipient.name, 'Candidate Scholar');
    assert.ok(Array.isArray(body.data.documents));
    assert.ok(body.data.documents.length >= 1);

    const doc = body.data.documents[0];
    assert.strictEqual(doc.documentId, testDoc.documentId);
    assert.strictEqual(doc.originalFilename, 'persona_test_diploma.pdf');
    assert.strictEqual(doc.storagePath, undefined, 'Private storage path must not be exposed');

    // Verify privacy audit event
    const auditRecord = await AuditLog.findOne({
      action: 'RECIPIENT_UPLOADS_VIEWED',
      targetId: candidateUser.userId
    }).sort({ createdAt: -1 });
    assert.ok(auditRecord, 'Must record audit log when issuer views recipient uploads');
    assert.strictEqual(auditRecord.performedBy, issuerUser.userId);
  });

  test('GET /api/issuers/recipients/lookup returns found:false for unregistered email', async () => {
    const res = await fetch(`${baseUrl}/api/issuers/recipients/lookup?email=${encodeURIComponent('unregistered_student@stanford.edu')}`, {
      headers: { Authorization: `Bearer ${issuerToken}` }
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.data.found, false);
    assert.strictEqual(body.data.recipient, null);
    assert.deepStrictEqual(body.data.documents, []);
  });

  // ─── 4. KEY EXPIRY & LIFECYCLE ──────────────────────────────────────────

  test('Issuer key generation calculates a sensible 365-day expiresAt field', async () => {
    assert.ok(testKey.expiresAt, 'Generated key must have expiresAt');
    const activated = new Date(testKey.activatedAt || testKey.createdAt).getTime();
    const expires = new Date(testKey.expiresAt).getTime();
    const diffDays = Math.round((expires - activated) / (24 * 60 * 60 * 1000));
    assert.ok(diffDays >= 364 && diffDays <= 366, `Expected ~365 days expiration, got ${diffDays}`);
  });

  // ─── 5. AUDIT LOG SERIALIZATION (actorId, actorRole, targetResource) ────

  test('GET /api/audit-logs returns actorId, actorRole, and targetResource properly formatted', async () => {
    const res = await fetch(`${baseUrl}/api/audit-logs?limit=5`, {
      headers: { Authorization: `Bearer ${adminToken}` }
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(Array.isArray(body.data.logs));
    assert.ok(body.data.logs.length > 0);

    const log = body.data.logs[0];
    assert.ok(log.actorId, 'actorId must be defined');
    assert.ok(log.actorRole, 'actorRole must be defined');
    assert.ok(log.targetResource, 'targetResource must be defined (e.g. Type:ID)');
    assert.ok(log.targetResource.includes(':'), 'targetResource must follow Type:ID convention');
  });
});

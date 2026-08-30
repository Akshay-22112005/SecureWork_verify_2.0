const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const app = require('../src/app');
const { connectDB, disconnectDB } = require('../src/config/db');
const User = require('../src/models/user.model');
const Organization = require('../src/models/organization.model');
const Issuer = require('../src/models/issuer.model');
const IssuerKey = require('../src/models/issuerKey.model');
const Document = require('../src/models/document.model');
const Credential = require('../src/models/credential.model');
const CredentialVersion = require('../src/models/credentialVersion.model');
const issuerKeyService = require('../src/services/issuerKey.service');
const credentialService = require('../src/services/credential.service');
const {
  buildCanonicalPayload,
  serializeCanonicalPayload,
  verifyCredentialSignature
} = require('../src/utils/credentialPayload');
const { generateToken } = require('../src/utils/jwt');
const { sha256 } = require('../src/utils/crypto');

describe('Phase 6 Credential & Signed Payload Tests', () => {
  let server;
  let baseUrl;

  let adminUser;
  let adminToken;

  let issuerUser;
  let issuerToken;

  let recipientUser;
  let recipientToken;

  let testOrg;
  let activeIssuer;
  let activeKey;
  let testDocument;
  let testDocument2;

  before(async () => {
    await connectDB();
    await User.deleteMany({ email: /@credtest\.local$/ });
    await Organization.deleteMany({ officialDomain: /credtest\.local$/ });
    await Issuer.deleteMany({ issuerCode: /^ISS_CRED_/ });
    await IssuerKey.deleteMany({ issuerId: /^iss_cred_/ });
    await Document.deleteMany({ originalFilename: /credential_doc_/ });
    await Credential.deleteMany({ organizationId: 'org_cred_test_01' });
    await CredentialVersion.deleteMany({ issuerKeyId: /^key_cred_/ });

    const passwordHash = await User.hashPassword('CredPass123!');

    adminUser = await User.create({
      name: 'Credential Admin',
      email: 'admin@credtest.local',
      passwordHash,
      role: 'ADMIN',
      status: 'ACTIVE'
    });
    adminToken = generateToken(adminUser);

    issuerUser = await User.create({
      name: 'Accredited Registrar',
      email: 'registrar@credtest.local',
      passwordHash,
      role: 'ISSUER',
      status: 'ACTIVE'
    });
    issuerToken = generateToken(issuerUser);

    recipientUser = await User.create({
      name: 'Graduating Student',
      email: 'student@credtest.local',
      passwordHash,
      role: 'USER',
      status: 'ACTIVE'
    });
    recipientToken = generateToken(recipientUser);

    testOrg = await Organization.create({
      organizationId: 'org_cred_test_01',
      organizationCode: 'ORG_CRED_UNIV',
      name: 'Credential State University',
      type: 'UNIVERSITY',
      officialDomain: 'stateuniv.credtest.local',
      organizationVerificationStatus: 'VERIFIED',
      status: 'ACTIVE',
      createdBy: adminUser.userId
    });

    activeIssuer = await Issuer.create({
      issuerId: 'iss_cred_registrar_01',
      issuerCode: 'ISS_CRED_REGISTRAR',
      userId: issuerUser.userId,
      organizationId: testOrg.organizationId,
      status: 'ACTIVE'
    });

    // Generate active Ed25519 key for issuer
    activeKey = await issuerKeyService.generateKeyForIssuer(activeIssuer.issuerId, adminUser);

    testDocument = await Document.create({
      documentId: 'doc_cred_test_01',
      originalFilename: 'credential_doc_1.pdf',
      mimeType: 'application/pdf',
      fileSize: 1024,
      storagePath: 'storage_doc_1.pdf',
      sha256Hash: sha256('PDF Document 1 Content for Credential'),
      uploadedBy: issuerUser.userId,
      representationType: 'ORIGINAL_DIGITAL_FILE'
    });

    testDocument2 = await Document.create({
      documentId: 'doc_cred_test_02',
      originalFilename: 'credential_doc_2.pdf',
      mimeType: 'application/pdf',
      fileSize: 2048,
      storagePath: 'storage_doc_2.pdf',
      sha256Hash: sha256('Amended PDF Document 2 Content for Credential'),
      uploadedBy: issuerUser.userId,
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
      await User.deleteMany({ email: /@credtest\.local$/ });
      await Organization.deleteMany({ officialDomain: /credtest\.local$/ });
      await Issuer.deleteMany({ issuerCode: /^ISS_CRED_/ });
      await IssuerKey.deleteMany({ issuerId: /^iss_cred_/ });
      await Document.deleteMany({ originalFilename: /credential_doc_/ });
      await Credential.deleteMany({ organizationId: 'org_cred_test_01' });
      await CredentialVersion.deleteMany({ issuerKeyId: /^key_cred_/ });
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

  let issuedCredentialId;
  let version1Id;
  let version2Id;

  // ==========================================
  // 1. Canonical Payload & Signing Tests
  // ==========================================
  describe('Deterministic Canonical Payload & Signature Verification', () => {
    test('canonical payload serialization is deterministic and independent of key order', () => {
      const date = new Date('2026-08-30T12:00:00.000Z');
      const payloadObj1 = buildCanonicalPayload({
        credentialId: 'crd_1',
        credentialVersionId: 'ver_1',
        documentHash: 'a'.repeat(64),
        organizationId: 'org_1',
        issuerId: 'iss_1',
        recipientId: 'rec_1',
        credentialType: 'DEGREE',
        issuedAt: date,
        expiresAt: null
      });

      // Different key order
      const payloadObj2 = {
        expiresAt: null,
        recipientId: 'rec_1',
        credentialType: 'DEGREE',
        organizationId: 'org_1',
        documentHash: 'a'.repeat(64),
        credentialId: 'crd_1',
        credentialVersionId: 'ver_1',
        issuedAt: date.toISOString(),
        issuerId: 'iss_1'
      };

      const canonical1 = serializeCanonicalPayload(payloadObj1);
      const canonical2 = serializeCanonicalPayload(payloadObj2);

      assert.strictEqual(canonical1, canonical2);
      assert.strictEqual(sha256(canonical1), sha256(canonical2));
    });

    test('valid Ed25519 signature verifies successfully, tampered payload fails', () => {
      const payload = buildCanonicalPayload({
        credentialId: 'crd_test_sig',
        credentialVersionId: 'ver_test_sig',
        documentHash: testDocument.sha256Hash,
        organizationId: testOrg.organizationId,
        issuerId: activeIssuer.issuerId,
        recipientId: recipientUser.userId,
        credentialType: 'DEGREE',
        issuedAt: new Date()
      });

      // Sign with active key
      const canonical = serializeCanonicalPayload(payload);
      const { privateKeyPem } = require('../src/utils/crypto').generateEd25519KeyPair();
      const validSig = require('../src/utils/crypto').signEd25519(canonical, privateKeyPem, 'hex');

      // Tampered payload
      const tamperedPayload = { ...payload, recipientId: 'usr_imposter_99' };
      const { publicKeyPem } = require('crypto').createPublicKey(privateKeyPem).export({ type: 'spki', format: 'pem' });

      assert.strictEqual(verifyCredentialSignature(payload, validSig, privateKeyPem), true);
      assert.strictEqual(verifyCredentialSignature(tamperedPayload, validSig, privateKeyPem), false);
    });
  });

  // ==========================================
  // 2. Credential Issuance Tests
  // ==========================================
  describe('Credential Issuance Workflow', () => {
    test('POST /api/credentials/issue issues credential v1 with canonical signed payload', async () => {
      const res = await fetch(`${baseUrl}/api/credentials/issue`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${issuerToken}`
        },
        body: JSON.stringify({
          issuerId: activeIssuer.issuerId,
          recipientId: recipientUser.userId,
          documentId: testDocument.documentId,
          credentialType: 'DEGREE',
          title: 'Bachelor of Science in Distributed Systems',
          expiresAt: '2030-08-30T00:00:00.000Z'
        })
      });

      assert.strictEqual(res.status, 201);
      const body = await res.json();
      assert.strictEqual(body.success, true);

      const { credential, version } = body.data;
      issuedCredentialId = credential.credentialId;
      version1Id = version.versionId;

      assert.strictEqual(credential.status, 'ACTIVE');
      assert.strictEqual(credential.currentVersionNumber, 1);
      assert.strictEqual(credential.currentVersionId, version.versionId);
      assert.strictEqual(credential.recipientId, recipientUser.userId);

      // Verify version 1 fields
      assert.strictEqual(version.versionNumber, 1);
      assert.strictEqual(version.documentId, testDocument.documentId);
      assert.strictEqual(version.documentHash, testDocument.sha256Hash);
      assert.strictEqual(version.issuerKeyId, activeKey.keyId);
      assert.strictEqual(version.status, 'ACTIVE');
      assert.strictEqual(version.supersedesVersionId, null);

      // Verify digital signature against issuer public key
      const isSigValid = verifyCredentialSignature(
        version.signedPayload,
        version.signature,
        activeKey.publicKey
      );
      assert.strictEqual(isSigValid, true, 'Digital signature on canonical payload must be valid');
    });

    test('GET /api/credentials/:id returns credential and current version', async () => {
      const res = await fetch(`${baseUrl}/api/credentials/${issuedCredentialId}`, {
        headers: { Authorization: `Bearer ${recipientToken}` }
      });

      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.credential.credentialId, issuedCredentialId);
      assert.strictEqual(body.data.currentVersion.versionId, version1Id);
    });
  });

  // ==========================================
  // 3. Credential Versioning & Supersession Tests
  // ==========================================
  describe('Credential Versioning & Revision Lineage', () => {
    test('POST /api/credentials/:id/versions creates v2 and marks v1 as SUPERSEDED', async () => {
      const res = await fetch(`${baseUrl}/api/credentials/${issuedCredentialId}/versions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${issuerToken}`
        },
        body: JSON.stringify({
          documentId: testDocument2.documentId,
          changeReason: 'Corrected typo in student Latin honors distinction'
        })
      });

      assert.strictEqual(res.status, 201);
      const body = await res.json();
      assert.strictEqual(body.success, true);

      const { credential, version } = body.data;
      version2Id = version.versionId;

      assert.strictEqual(credential.currentVersionNumber, 2);
      assert.strictEqual(credential.currentVersionId, version2Id);

      // Verify version 2 metadata
      assert.strictEqual(version.versionNumber, 2);
      assert.strictEqual(version.supersedesVersionId, version1Id);
      assert.strictEqual(version.changeReason, 'Corrected typo in student Latin honors distinction');
      assert.strictEqual(version.status, 'ACTIVE');

      // Verify version 1 in DB is now SUPERSEDED (Never deleted or overwritten!)
      const dbV1 = await CredentialVersion.findOne({ versionId: version1Id });
      assert.strictEqual(dbV1.status, 'SUPERSEDED');
    });

    test('GET /api/credentials/:id/versions returns complete immutable revision history', async () => {
      const res = await fetch(`${baseUrl}/api/credentials/${issuedCredentialId}/versions`, {
        headers: { Authorization: `Bearer ${recipientToken}` }
      });

      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.success, true);

      const versions = body.data.versions;
      assert.strictEqual(versions.length, 2);
      assert.strictEqual(versions[0].versionNumber, 1);
      assert.strictEqual(versions[0].status, 'SUPERSEDED');
      assert.strictEqual(versions[1].versionNumber, 2);
      assert.strictEqual(versions[1].status, 'ACTIVE');
    });
  });

  // ==========================================
  // 4. Revocation & Expiration Tests
  // ==========================================
  describe('Revocation & Expiration Workflows', () => {
    test('PATCH /api/credentials/:id/revoke marks credential and current version as REVOKED', async () => {
      const res = await fetch(`${baseUrl}/api/credentials/${issuedCredentialId}/revoke`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${issuerToken}`
        },
        body: JSON.stringify({ revocationReason: 'Academic misconduct finding' })
      });

      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.credential.status, 'REVOKED');
      assert.ok(body.data.credential.revokedAt);

      // Verify current version is also REVOKED
      const dbV2 = await CredentialVersion.findOne({ versionId: version2Id });
      assert.strictEqual(dbV2.status, 'REVOKED');
    });

    test('creating a new version for a revoked credential is rejected', async () => {
      const res = await fetch(`${baseUrl}/api/credentials/${issuedCredentialId}/versions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${issuerToken}`
        },
        body: JSON.stringify({ documentId: testDocument.documentId })
      });

      assert.strictEqual(res.status, 400);
      const body = await res.json();
      assert.strictEqual(body.success, false);
      assert.strictEqual(body.error.code, 'CREDENTIAL_REVOKED');
    });

    test('credential past expiresAt dynamically evaluates to EXPIRED without being labeled fake', async () => {
      const expiredDate = new Date(Date.now() - 3600 * 1000); // 1 hour ago
      const expiredCred = await credentialService.issueCredential({
        issuerId: activeIssuer.issuerId,
        recipientId: recipientUser.userId,
        documentId: testDocument.documentId,
        credentialType: 'LICENSE',
        expiresAt: expiredDate
      }, issuerUser);

      const res = await fetch(`${baseUrl}/api/credentials/${expiredCred.credential.credentialId}`, {
        headers: { Authorization: `Bearer ${recipientToken}` }
      });

      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      // Status evaluates to EXPIRED, but retains full verifiable signature & history
      assert.strictEqual(body.data.credential.status, 'EXPIRED');
    });
  });

  // ==========================================
  // 5. Inactive / Revoked Issuer & Key Precondition Tests
  // ==========================================
  describe('Issuance Precondition Security Enforcements', () => {
    test('issuing credential with INACTIVE issuer is rejected', async () => {
      const pendingUser = await User.create({
        name: 'Pending User',
        email: 'pending_issuer@credtest.local',
        passwordHash: await User.hashPassword('Pass123!'),
        role: 'USER',
        status: 'ACTIVE'
      });

      const pendingIssuer = await Issuer.create({
        issuerId: 'iss_cred_pending_01',
        issuerCode: 'ISS_CRED_PENDING',
        userId: pendingUser.userId,
        organizationId: testOrg.organizationId,
        status: 'PENDING'
      });

      await assert.rejects(async () => {
        await credentialService.issueCredential({
          issuerId: pendingIssuer.issuerId,
          recipientId: recipientUser.userId,
          documentId: testDocument.documentId,
          credentialType: 'CERTIFICATION'
        }, pendingUser);
      }, { code: 'ISSUER_NOT_ACTIVE' });
    });

    test('issuing credential with REVOKED issuer is rejected', async () => {
      const revokedUser = await User.create({
        name: 'Revoked User',
        email: 'revoked_issuer@credtest.local',
        passwordHash: await User.hashPassword('Pass123!'),
        role: 'USER',
        status: 'ACTIVE'
      });

      const revokedIssuer = await Issuer.create({
        issuerId: 'iss_cred_revoked_01',
        issuerCode: 'ISS_CRED_REVOKED',
        userId: revokedUser.userId,
        organizationId: testOrg.organizationId,
        status: 'REVOKED'
      });

      await assert.rejects(async () => {
        await credentialService.issueCredential({
          issuerId: revokedIssuer.issuerId,
          recipientId: recipientUser.userId,
          documentId: testDocument.documentId,
          credentialType: 'CERTIFICATION'
        }, revokedUser);
      }, { code: 'ISSUER_NOT_ACTIVE' });
    });

    test('issuing credential when active key is RETIRED or COMPROMISED is rejected', async () => {
      const keyTestUser = await User.create({
        name: 'Key Test User',
        email: 'keytest_issuer@credtest.local',
        passwordHash: await User.hashPassword('Pass123!'),
        role: 'USER',
        status: 'ACTIVE'
      });

      // Create new active issuer
      const keyTestIssuer = await Issuer.create({
        issuerId: 'iss_cred_keytest_01',
        issuerCode: 'ISS_CRED_KEYTEST',
        userId: keyTestUser.userId,
        organizationId: testOrg.organizationId,
        status: 'ACTIVE'
      });

      // Generate key and immediately compromise it
      const tempKey = await issuerKeyService.generateKeyForIssuer(keyTestIssuer.issuerId, adminUser);
      await issuerKeyService.compromiseKey(tempKey.keyId, { reason: 'Incident' }, adminUser);

      await assert.rejects(async () => {
        await credentialService.issueCredential({
          issuerId: keyTestIssuer.issuerId,
          recipientId: recipientUser.userId,
          documentId: testDocument.documentId,
          credentialType: 'CERTIFICATION'
        }, keyTestUser);
      }, { code: 'KEY_NOT_ACTIVE' });
    });
  });

  // ==========================================
  // 6. Timeline Milestone Tests
  // ==========================================
  describe('Credential Lifecycle Timeline', () => {
    test('GET /api/credentials/:id/timeline returns chronological milestones', async () => {
      const res = await fetch(`${baseUrl}/api/credentials/${issuedCredentialId}/timeline`, {
        headers: { Authorization: `Bearer ${recipientToken}` }
      });

      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.success, true);

      const timeline = body.data.timeline;
      assert.ok(Array.isArray(timeline));
      assert.ok(timeline.length >= 3);

      const types = timeline.map(e => e.type);
      assert.ok(types.includes('CREDENTIAL_ISSUED'));
      assert.ok(types.includes('CREDENTIAL_AMENDED'));
      assert.ok(types.includes('CREDENTIAL_REVOKED'));
    });
  });
});

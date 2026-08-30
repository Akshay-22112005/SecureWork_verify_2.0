const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const app = require('../src/app');
const { connectDB, disconnectDB } = require('../src/config/db');
const User = require('../src/models/user.model');
const Organization = require('../src/models/organization.model');
const Issuer = require('../src/models/issuer.model');
const IssuerKey = require('../src/models/issuerKey.model');
const Document = require('../src/models/document.model');
const Credential = require('../src/models/credential.model');
const CredentialVersion = require('../src/models/credentialVersion.model');
const Verification = require('../src/models/verification.model');
const VerificationEvidence = require('../src/models/verificationEvidence.model');
const issuerKeyService = require('../src/services/issuerKey.service');
const credentialService = require('../src/services/credential.service');
const verificationService = require('../src/services/verification.service');
const { generateToken } = require('../src/utils/jwt');
const { sha256 } = require('../src/utils/crypto');
const { RESULT_TYPES, TRUST_LEVELS } = require('../src/services/verification/verificationConstants');

describe('Phase 9 Verification Evidence & Manual Review Tests', () => {
  let server;
  let baseUrl;
  let adminUser;
  let hrUser;
  let auditorUser;
  let regularUser;
  let issuerUser;
  let recipientUser;

  let adminToken;
  let hrToken;
  let auditorToken;
  let userToken;
  let issuerToken;

  let testOrg;
  let testIssuer;
  let testDoc;
  let validCredential;

  before(async () => {
    await connectDB();

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;

    // 1. Create Users for all test roles
    adminUser = await User.create({
      name: 'P9 Admin',
      email: `p9_admin_${Date.now()}@securework.local`,
      passwordHash: await User.hashPassword('AdminPass123!'),
      role: 'ADMIN',
      status: 'ACTIVE'
    });
    adminToken = generateToken(adminUser);

    hrUser = await User.create({
      name: 'P9 HR Manager',
      email: `p9_hr_${Date.now()}@securework.local`,
      passwordHash: await User.hashPassword('HrPass123!'),
      role: 'HR',
      status: 'ACTIVE'
    });
    hrToken = generateToken(hrUser);

    auditorUser = await User.create({
      name: 'P9 Compliance Auditor',
      email: `p9_auditor_${Date.now()}@securework.local`,
      passwordHash: await User.hashPassword('AuditorPass123!'),
      role: 'AUDITOR',
      status: 'ACTIVE'
    });
    auditorToken = generateToken(auditorUser);

    regularUser = await User.create({
      name: 'P9 Regular User',
      email: `p9_user_${Date.now()}@securework.local`,
      passwordHash: await User.hashPassword('UserPass123!'),
      role: 'USER',
      status: 'ACTIVE'
    });
    userToken = generateToken(regularUser);

    issuerUser = await User.create({
      name: 'P9 Registrar Official',
      email: `p9_issuer_${Date.now()}@securework.local`,
      passwordHash: await User.hashPassword('IssuerPass123!'),
      role: 'ISSUER',
      status: 'ACTIVE'
    });
    issuerToken = generateToken(issuerUser);

    recipientUser = await User.create({
      name: 'P9 Student Graduate',
      email: `p9_grad_${Date.now()}@securework.local`,
      passwordHash: await User.hashPassword('GradPass123!'),
      role: 'USER',
      status: 'ACTIVE'
    });

    // 2. Setup verified Organization and Issuer
    testOrg = await Organization.create({
      organizationId: `org_p9_${Date.now()}`,
      organizationCode: `ORG_P9_${Date.now()}`,
      name: 'State Polytechnic University',
      type: 'UNIVERSITY',
      officialDomain: 'polytechnic.edu',
      organizationVerificationStatus: 'VERIFIED',
      status: 'ACTIVE',
      createdBy: adminUser.userId
    });

    testIssuer = await Issuer.create({
      issuerId: `iss_p9_${Date.now()}`,
      issuerCode: `ISS_P9_${Date.now()}`,
      userId: issuerUser.userId,
      organizationId: testOrg.organizationId,
      status: 'ACTIVE'
    });

    await issuerKeyService.generateKeyForIssuer(testIssuer.issuerId, adminUser);

    // 3. Ingest test document
    const docBytes = Buffer.from('Official Diploma Certificate in Software Engineering 2026');
    testDoc = await Document.create({
      documentId: `doc_p9_${Date.now()}`,
      originalFilename: 'diploma.pdf',
      mimeType: 'application/pdf',
      fileSize: docBytes.length,
      storagePath: 'diploma.pdf',
      sha256Hash: sha256(docBytes),
      uploadedBy: issuerUser.userId,
      representationType: 'ORIGINAL_DIGITAL_FILE'
    });

    // 4. Issue valid credential
    const issued = await credentialService.issueCredential({
      issuerId: testIssuer.issuerId,
      recipientId: recipientUser.userId,
      documentId: testDoc.documentId,
      credentialType: 'DEGREE'
    }, adminUser);
    validCredential = issued.credential;
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

  // ==========================================
  // 1. Evidence Creation
  // ==========================================
  describe('Discrete Verification Evidence Creation', () => {
    let verificationRecord;

    test('Verification evaluation automatically generates discrete historical VerificationEvidence records', async () => {
      verificationRecord = await verificationService.evaluateCredentialVerification({
        credentialId: validCredential.credentialId,
        claimedRecipientId: recipientUser.userId,
        documentHash: testDoc.sha256Hash
      }, regularUser);

      assert.ok(verificationRecord.verificationId);
      assert.strictEqual(verificationRecord.cryptographicStatus, 'PASSED');
      assert.strictEqual(verificationRecord.humanVerificationStatus, 'PENDING');
      assert.strictEqual(verificationRecord.finalResult, RESULT_TYPES.VERIFIED);

      // Verify evidence records in database
      const evidenceList = await VerificationEvidence.find({
        verificationId: verificationRecord.verificationId
      });

      assert.ok(evidenceList.length >= 6, 'Should generate discrete evidence for evaluated checks');

      const types = evidenceList.map(e => e.evidenceType);
      assert.ok(types.includes('DIGITAL_SIGNATURE'));
      assert.ok(types.includes('HASH_MATCH'));
      assert.ok(types.includes('ISSUER_STATUS'));
      assert.ok(types.includes('CREDENTIAL_STATUS'));
      assert.ok(types.includes('DOMAIN_VERIFICATION'));
      assert.ok(types.includes('IDENTITY_EVIDENCE'));

      // Check signature evidence details
      const sigEvidence = evidenceList.find(e => e.evidenceType === 'DIGITAL_SIGNATURE');
      assert.strictEqual(sigEvidence.signatureValid, true);
      assert.strictEqual(sigEvidence.evidenceStatus, 'CONFIRMED');
      assert.ok(sigEvidence.evidenceId.startsWith('evi_'));
    });

    test('GET /api/verifications/:id/evidence returns discrete historical evidence artifacts', async () => {
      const res = await fetch(`${baseUrl}/api/verifications/${verificationRecord.verificationId}/evidence`);
      assert.strictEqual(res.status, 200);

      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.ok(Array.isArray(body.data.evidence));
      assert.ok(body.data.evidence.length >= 6);
      assert.ok(body.data.evidence[0].evidenceId);
    });

    test('GET /api/verifications returns paginated verifications list', async () => {
      const res = await fetch(`${baseUrl}/api/verifications`);
      assert.strictEqual(res.status, 200);

      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.ok(Array.isArray(body.data.verifications));
      assert.ok(body.data.verifications.length >= 1);
    });
  });

  // ==========================================
  // 2. Historical Evidence Preservation
  // ==========================================
  describe('Historical Evidence Preservation (Immutability)', () => {
    test('Attempts to mutate or update existing VerificationEvidence records fail (immutability guard)', async () => {
      const evidence = await VerificationEvidence.findOne();
      assert.ok(evidence, 'Should have at least one evidence record');

      // 1. Attempt update via save()
      evidence.evidenceStatus = 'CONTRADICTED';
      await assert.rejects(
        async () => {
          await evidence.save();
        },
        (err) => {
          assert.ok(err.message.includes('immutable'));
          return true;
        }
      );

      // 2. Attempt update via updateOne()
      await assert.rejects(
        async () => {
          await VerificationEvidence.updateOne(
            { evidenceId: evidence.evidenceId },
            { evidenceStatus: 'CONTRADICTED' }
          );
        },
        (err) => {
          assert.ok(err.message.includes('immutable'));
          return true;
        }
      );
    });
  });

  // ==========================================
  // 3. Cryptographic Failure + Human Confirmation Invariant
  // ==========================================
  describe('Cryptographic Failure + Human Confirmation Invariant', () => {
    let failedVerificationId;

    test('Altered document hash fails cryptographic check: cryptographicStatus = FAILED', async () => {
      const tamperedHash = sha256('Forged altered bytes with tampered GPA');

      const evalRes = await verificationService.evaluateCredentialVerification({
        credentialId: validCredential.credentialId,
        documentHash: tamperedHash
      }, regularUser);

      failedVerificationId = evalRes.verificationId;
      assert.strictEqual(evalRes.result, RESULT_TYPES.ALTERED);
      assert.strictEqual(evalRes.cryptographicStatus, 'FAILED');
      assert.strictEqual(evalRes.humanVerificationStatus, 'PENDING');
      assert.strictEqual(evalRes.finalResult, RESULT_TYPES.ALTERED);
      assert.strictEqual(evalRes.trustLevel, TRUST_LEVELS.LEVEL_2_SOURCE_VERIFIED);
    });

    test('Human reviewer independently confirms document: cryptographicStatus = FAILED, humanVerificationStatus = CONFIRMED, finalResult = MANUALLY_VERIFIED', async () => {
      const reviewRes = await fetch(`${baseUrl}/api/verifications/${failedVerificationId}/manual-review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${hrToken}`
        },
        body: JSON.stringify({
          decision: 'CONFIRMED',
          reviewNotes: 'Called University Registrar office directly. Confirmed Alice graduated with Honors in 2026. Discrepancy is due to re-scanned seal.',
          supportingEvidence: {
            registrarContact: 'Dr. Smith, Registrar Dean',
            callDate: '2026-08-30',
            referenceNumber: 'REG-CALL-8849'
          }
        })
      });

      assert.strictEqual(reviewRes.status, 200);
      const body = await reviewRes.json();
      assert.strictEqual(body.success, true);

      const verification = body.data.verification;

      // INVARIANT CHECKS:
      // 1. cryptographicStatus MUST REMAIN 'FAILED' (never rewritten!)
      assert.strictEqual(verification.cryptographicStatus, 'FAILED');
      // 2. humanVerificationStatus becomes 'CONFIRMED'
      assert.strictEqual(verification.humanVerificationStatus, 'CONFIRMED');
      // 3. finalResult becomes 'MANUALLY_VERIFIED'
      assert.strictEqual(verification.finalResult, RESULT_TYPES.MANUALLY_VERIFIED);
      // 4. trustLevel reaches LEVEL 5 CURRENTLY_VALID
      assert.strictEqual(verification.trustLevel, TRUST_LEVELS.LEVEL_5_CURRENTLY_VALID);
      // 5. Reviewer identity is recorded
      assert.strictEqual(verification.reviewedBy, hrUser.userId);
      assert.ok(verification.explanation.includes('Cryptographic verification failed, but authorized reviewer'));

      // 6. Cryptographic failure evidence is preserved untouched in historical evidence trail
      const evidenceList = await VerificationEvidence.find({ verificationId: failedVerificationId });
      const hashEvidence = evidenceList.find(e => e.evidenceType === 'HASH_MATCH');
      assert.strictEqual(hashEvidence.evidenceStatus, 'CONTRADICTED', 'Cryptographic hash mismatch evidence remains intact');

      // 7. A new MANUAL_REVIEW evidence record exists
      const manualEvidence = evidenceList.find(e => e.evidenceType === 'MANUAL_REVIEW');
      assert.ok(manualEvidence);
      assert.strictEqual(manualEvidence.evidenceStatus, 'CONFIRMED');
      assert.strictEqual(manualEvidence.sourceId, hrUser.userId);
    });
  });

  // ==========================================
  // 4. RBAC for Reviewers & Unauthorized Modification Prevention
  // ==========================================
  describe('RBAC for Manual Reviewers & Unauthorized Access Prevention', () => {
    let testVerificationId;

    before(async () => {
      const v = await verificationService.evaluateCredentialVerification({
        credentialId: validCredential.credentialId,
        documentHash: testDoc.sha256Hash
      });
      testVerificationId = v.verificationId;
    });

    test('Regular USER cannot submit manual reviews: returns 403 FORBIDDEN', async () => {
      const res = await fetch(`${baseUrl}/api/verifications/${testVerificationId}/manual-review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`
        },
        body: JSON.stringify({
          decision: 'CONFIRMED',
          reviewNotes: 'Unauthorized attempt by standard user'
        })
      });

      assert.strictEqual(res.status, 403);
    });

    test('ISSUER cannot submit manual reviews on arbitrary verifications: returns 403 FORBIDDEN', async () => {
      const res = await fetch(`${baseUrl}/api/verifications/${testVerificationId}/manual-review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${issuerToken}`
        },
        body: JSON.stringify({
          decision: 'CONFIRMED',
          reviewNotes: 'Unauthorized attempt by issuer'
        })
      });

      assert.strictEqual(res.status, 403);
    });

    test('AUDITOR can submit manual reviews: returns 200 OK', async () => {
      const res = await fetch(`${baseUrl}/api/verifications/${testVerificationId}/manual-review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${auditorToken}`
        },
        body: JSON.stringify({
          decision: 'CONFIRMED',
          reviewNotes: 'Compliance auditor audit confirmed'
        })
      });

      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.data.verification.reviewedBy, auditorUser.userId);
    });

    test('ADMIN can submit manual reviews: returns 200 OK', async () => {
      const res = await fetch(`${baseUrl}/api/verifications/${testVerificationId}/manual-review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          decision: 'REJECTED',
          reviewNotes: 'Admin override: revoked upon disciplinary sanctions'
        })
      });

      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.data.verification.finalResult, RESULT_TYPES.ALTERED);
      assert.strictEqual(body.data.verification.humanVerificationStatus, 'REJECTED');
    });

    test('Unauthenticated user cannot submit manual review: returns 401 UNAUTHORIZED', async () => {
      const res = await fetch(`${baseUrl}/api/verifications/${testVerificationId}/manual-review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision: 'CONFIRMED' })
      });

      assert.strictEqual(res.status, 401);
    });
  });
});

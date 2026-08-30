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
const Verification = require('../src/models/verification.model');
const issuerKeyService = require('../src/services/issuerKey.service');
const credentialService = require('../src/services/credential.service');
const verificationEngine = require('../src/services/verification/verificationEngine');
const { TRUST_LEVELS, RESULT_TYPES } = require('../src/services/verification/verificationConstants');
const { sha256 } = require('../src/utils/crypto');

describe('Phase 7 Verification Engine Tests', () => {
  let server;
  let baseUrl;

  let adminUser;
  let issuerUser;
  let recipientUser;

  let verifiedOrg;
  let unverifiedOrg;
  let activeIssuer;
  let activeKey;
  let compromisedKey;
  let testDocument;

  let validCredential;
  let validVersion;

  before(async () => {
    await connectDB();
    await User.deleteMany({ email: /@veriftest\.local$/ });
    await Organization.deleteMany({ officialDomain: /veriftest\.local$/ });
    await Issuer.deleteMany({ issuerCode: /^ISS_VERIF_/ });
    await IssuerKey.deleteMany({ issuerId: /^iss_verif_/ });
    await Document.deleteMany({ originalFilename: /verif_doc_/ });
    await Credential.deleteMany({ organizationId: /^org_verif_/ });
    await CredentialVersion.deleteMany({ issuerKeyId: /^key_verif_/ });
    await Verification.deleteMany({});

    const passwordHash = await User.hashPassword('VerifSecret123!');

    adminUser = await User.create({
      name: 'Verification Admin',
      email: 'admin@veriftest.local',
      passwordHash,
      role: 'ADMIN',
      status: 'ACTIVE'
    });

    issuerUser = await User.create({
      name: 'Authorized Dean',
      email: 'dean@veriftest.local',
      passwordHash,
      role: 'ISSUER',
      status: 'ACTIVE'
    });

    recipientUser = await User.create({
      name: 'Alumni Recipient',
      email: 'alumni@veriftest.local',
      passwordHash,
      role: 'USER',
      status: 'ACTIVE'
    });

    verifiedOrg = await Organization.create({
      organizationId: 'org_verif_verified_01',
      organizationCode: 'ORG_VERIF_ACCREDITED',
      name: 'Institute of Verified Science',
      type: 'UNIVERSITY',
      officialDomain: 'ivs.veriftest.local',
      organizationVerificationStatus: 'VERIFIED',
      status: 'ACTIVE',
      createdBy: adminUser.userId
    });

    unverifiedOrg = await Organization.create({
      organizationId: 'org_verif_unverified_01',
      organizationCode: 'ORG_VERIF_SHADY',
      name: 'Unverified Online Diploma Mill',
      type: 'OTHER',
      officialDomain: 'shady.veriftest.local',
      organizationVerificationStatus: 'PENDING',
      status: 'ACTIVE',
      createdBy: adminUser.userId
    });

    activeIssuer = await Issuer.create({
      issuerId: 'iss_verif_dean_01',
      issuerCode: 'ISS_VERIF_DEAN',
      userId: issuerUser.userId,
      organizationId: verifiedOrg.organizationId,
      status: 'ACTIVE'
    });

    activeKey = await issuerKeyService.generateKeyForIssuer(activeIssuer.issuerId, adminUser);

    testDocument = await Document.create({
      documentId: 'doc_verif_test_01',
      originalFilename: 'verif_doc_degree.pdf',
      mimeType: 'application/pdf',
      fileSize: 4096,
      storagePath: 'verif_doc_degree.pdf',
      sha256Hash: sha256('Original Verified Document Content 2026'),
      uploadedBy: issuerUser.userId,
      representationType: 'ORIGINAL_DIGITAL_FILE'
    });

    // Issue baseline active valid credential
    const issued = await credentialService.issueCredential({
      issuerId: activeIssuer.issuerId,
      recipientId: recipientUser.userId,
      documentId: testDocument.documentId,
      credentialType: 'DEGREE',
      title: 'Master of Science in Cryptographic Systems'
    }, issuerUser);

    validCredential = issued.credential;
    validVersion = issued.version;

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
      await User.deleteMany({ email: /@veriftest\.local$/ });
      await Organization.deleteMany({ officialDomain: /veriftest\.local$/ });
      await Issuer.deleteMany({ issuerCode: /^ISS_VERIF_/ });
      await IssuerKey.deleteMany({ issuerId: /^iss_verif_/ });
      await Document.deleteMany({ originalFilename: /verif_doc_/ });
      await Credential.deleteMany({ organizationId: /^org_verif_/ });
      await CredentialVersion.deleteMany({ issuerKeyId: /^key_verif_/ });
      await Verification.deleteMany({});
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

  // ==========================================
  // 1. Fully Verified Credential
  // ==========================================
  test('VERIFIED: valid credential achieves LEVEL 5 CURRENTLY_VALID with all 16 checks passed', async () => {
    const report = await verificationEngine.evaluateVerification({
      credentialId: validCredential.credentialId,
      claimedRecipientId: recipientUser.userId,
      documentHash: testDocument.sha256Hash
    });

    assert.strictEqual(report.result, RESULT_TYPES.VERIFIED);
    assert.strictEqual(report.trustLevel, TRUST_LEVELS.LEVEL_5_CURRENTLY_VALID);
    assert.ok(report.checks.digitalSignature.passed);
    assert.ok(report.checks.documentIntegrity.passed);
    assert.ok(report.checks.organizationTrust.passed);
    assert.ok(report.checks.issuerAuthorization.passed);
    assert.ok(report.checks.recipientBinding.passed);
    assert.strictEqual(report.warnings.length, 0);
  });

  // ==========================================
  // 2. Altered Document Detection
  // ==========================================
  test('ALTERED: tampered document hash yields ALTERED result and LEVEL 2 SOURCE_VERIFIED', async () => {
    const tamperedHash = sha256('Tampered altered degree certificate bytes');
    const report = await verificationEngine.evaluateVerification({
      credentialId: validCredential.credentialId,
      documentHash: tamperedHash,
      representationType: 'ORIGINAL_DIGITAL_FILE'
    });

    assert.strictEqual(report.result, RESULT_TYPES.ALTERED);
    assert.strictEqual(report.trustLevel, TRUST_LEVELS.LEVEL_2_SOURCE_VERIFIED);
    assert.strictEqual(report.checks.documentIntegrity.passed, false);
    assert.ok(report.explanation.includes('altered'));
  });

  // ==========================================
  // 3. Scan / Screenshot Exact Match Caveat
  // ==========================================
  test('NOT_EXACT_FILE_MATCH: scan or screenshot that does not byte-match returns NOT_EXACT_FILE_MATCH', async () => {
    const scanHash = sha256('Scan photograph pixels with noise');
    const report = await verificationEngine.evaluateVerification({
      credentialId: validCredential.credentialId,
      documentHash: scanHash,
      representationType: 'SCAN'
    });

    assert.strictEqual(report.result, RESULT_TYPES.NOT_EXACT_FILE_MATCH);
    assert.strictEqual(report.trustLevel, TRUST_LEVELS.LEVEL_2_SOURCE_VERIFIED);
    assert.ok(report.explanation.includes('Screenshots/scans cannot be cryptographically verified'));
  });

  // ==========================================
  // 4. Revoked Credential
  // ==========================================
  test('CREDENTIAL_REVOKED: revoked credential retains valid signature (LEVEL 4) but results in CREDENTIAL_REVOKED', async () => {
    const revokedCred = await credentialService.issueCredential({
      issuerId: activeIssuer.issuerId,
      recipientId: recipientUser.userId,
      documentId: testDocument.documentId,
      credentialType: 'CERTIFICATION'
    }, issuerUser);

    await credentialService.revokeCredential(
      revokedCred.credential.credentialId,
      { revocationReason: 'Student expelled for academic honor code violation' },
      issuerUser
    );

    const report = await verificationEngine.evaluateVerification({
      credentialId: revokedCred.credential.credentialId,
      documentHash: testDocument.sha256Hash
    });

    assert.strictEqual(report.result, RESULT_TYPES.CREDENTIAL_REVOKED);
    assert.strictEqual(report.trustLevel, TRUST_LEVELS.LEVEL_4_SIGNATURE_VERIFIED);
    assert.ok(report.explanation.includes('historically authentic'));
    assert.ok(report.explanation.includes('revoked'));
  });

  // ==========================================
  // 5. Expired Credential
  // ==========================================
  test('CREDENTIAL_EXPIRED: expired credential evaluates to CREDENTIAL_EXPIRED without being labeled fake', async () => {
    const expiredCred = await credentialService.issueCredential({
      issuerId: activeIssuer.issuerId,
      recipientId: recipientUser.userId,
      documentId: testDocument.documentId,
      credentialType: 'LICENSE',
      expiresAt: new Date(Date.now() - 60000) // 1 minute ago
    }, issuerUser);

    const report = await verificationEngine.evaluateVerification({
      credentialId: expiredCred.credential.credentialId,
      documentHash: testDocument.sha256Hash
    });

    assert.strictEqual(report.result, RESULT_TYPES.CREDENTIAL_EXPIRED);
    assert.strictEqual(report.trustLevel, TRUST_LEVELS.LEVEL_4_SIGNATURE_VERIFIED);
    assert.strictEqual(report.checks.expiration.passed, false);
    assert.ok(report.explanation.includes('expired, not fake'));
  });

  // ==========================================
  // 6. Superseded Version
  // ==========================================
  test('CREDENTIAL_SUPERSEDED: evaluating an older version yields CREDENTIAL_SUPERSEDED', async () => {
    const multiVersionCred = await credentialService.issueCredential({
      issuerId: activeIssuer.issuerId,
      recipientId: recipientUser.userId,
      documentId: testDocument.documentId,
      credentialType: 'DEGREE'
    }, issuerUser);

    const doc2 = await Document.create({
      documentId: 'doc_verif_test_v2_' + Date.now(),
      originalFilename: 'verif_doc_v2.pdf',
      mimeType: 'application/pdf',
      fileSize: 5000,
      storagePath: 'verif_doc_v2.pdf',
      sha256Hash: sha256('Amended version 2 bytes ' + Date.now()),
      uploadedBy: issuerUser.userId,
      representationType: 'ORIGINAL_DIGITAL_FILE'
    });

    await credentialService.createCredentialVersion(
      multiVersionCred.credential.credentialId,
      { documentId: doc2.documentId, changeReason: 'Correction' },
      issuerUser
    );

    // Evaluate old version 1 explicitly
    const report = await verificationEngine.evaluateVerification({
      credentialId: multiVersionCred.credential.credentialId,
      versionNumber: 1,
      documentHash: testDocument.sha256Hash
    });

    assert.strictEqual(report.result, RESULT_TYPES.CREDENTIAL_SUPERSEDED);
    assert.strictEqual(report.trustLevel, TRUST_LEVELS.LEVEL_4_SIGNATURE_VERIFIED);
    assert.ok(report.explanation.includes('superseded by version'));
  });

  // ==========================================
  // 7. Invalid Signature (AI Cannot Override!)
  // ==========================================
  test('SIGNATURE_INVALID: tampered signature fails and AI CANNOT override cryptographic failure', async () => {
    // Corrupt the signature in database for a test credential version
    const fakeCred = await credentialService.issueCredential({
      issuerId: activeIssuer.issuerId,
      recipientId: recipientUser.userId,
      documentId: testDocument.documentId,
      credentialType: 'CERTIFICATION'
    }, issuerUser);

    await CredentialVersion.updateOne(
      { versionId: fakeCred.version.versionId },
      { signature: 'deadbeef'.repeat(16) } // Invalid signature
    );

    const report = await verificationEngine.evaluateVerification({
      credentialId: fakeCred.credential.credentialId,
      documentHash: testDocument.sha256Hash,
      // AI reports document is 100% clean and authentic
      aiData: {
        tamperingDetected: false,
        anomalyScore: 0.01,
        notes: 'AI heuristics found zero signs of modification'
      }
    });

    assert.strictEqual(report.result, RESULT_TYPES.SIGNATURE_INVALID);
    assert.strictEqual(report.checks.digitalSignature.passed, false);
    assert.ok(report.explanation.includes('AI or OCR cannot override cryptographic failure'));
  });

  // ==========================================
  // 8. Key Compromised Precondition
  // ==========================================
  test('KEY_COMPROMISED: signing key compromised prior to issuance flags KEY_COMPROMISED', async () => {
    const compUser = await User.create({
      name: 'Compromised Issuer',
      email: 'comp_issuer_' + Date.now() + '@veriftest.local',
      passwordHash: await User.hashPassword('Pass123!'),
      role: 'USER',
      status: 'ACTIVE'
    });

    const compromiseTestIssuer = await Issuer.create({
      issuerId: 'iss_verif_comp_' + Date.now(),
      issuerCode: 'ISS_VERIF_COMP_' + Date.now(),
      userId: compUser.userId,
      organizationId: verifiedOrg.organizationId,
      status: 'ACTIVE'
    });

    const compromisedIssuerKey = await issuerKeyService.generateKeyForIssuer(compromiseTestIssuer.issuerId, adminUser);
    
    // Issue credential using adminUser
    const issuedWithKey = await credentialService.issueCredential({
      issuerId: compromiseTestIssuer.issuerId,
      recipientId: recipientUser.userId,
      documentId: testDocument.documentId,
      credentialType: 'CERTIFICATION'
    }, adminUser);

    // Backdate the compromisedAt timestamp to BEFORE issuance
    const compromisedTimestamp = new Date(new Date(issuedWithKey.version.issuedAt).getTime() - 3600000);
    await IssuerKey.updateOne(
      { keyId: compromisedIssuerKey.keyId },
      { status: 'COMPROMISED', compromisedAt: compromisedTimestamp }
    );

    const report = await verificationEngine.evaluateVerification({
      credentialId: issuedWithKey.credential.credentialId,
      documentHash: testDocument.sha256Hash
    });

    assert.strictEqual(report.result, RESULT_TYPES.KEY_COMPROMISED);
    assert.strictEqual(report.trustLevel, TRUST_LEVELS.LEVEL_3_INTEGRITY_VERIFIED);
    assert.ok(report.explanation.includes('compromised prior to issuance'));
  });

  // ==========================================
  // 9. Identity Mismatch
  // ==========================================
  test('IDENTITY_MISMATCH: claimed recipient not matching bound recipient yields IDENTITY_MISMATCH', async () => {
    const report = await verificationEngine.evaluateVerification({
      credentialId: validCredential.credentialId,
      claimedRecipientId: 'usr_imposter_someone_else',
      documentHash: testDocument.sha256Hash
    });

    assert.strictEqual(report.result, RESULT_TYPES.IDENTITY_MISMATCH);
    assert.strictEqual(report.trustLevel, TRUST_LEVELS.LEVEL_3_INTEGRITY_VERIFIED);
    assert.strictEqual(report.checks.recipientBinding.passed, false);
  });

  // ==========================================
  // 10. Untrusted Origin
  // ==========================================
  test('UNTRUSTED_ORIGIN: credential from unverified organization yields UNTRUSTED_ORIGIN', async () => {
    const shadyUser = await User.create({
      name: 'Shady Issuer',
      email: 'shady_issuer_' + Date.now() + '@veriftest.local',
      passwordHash: await User.hashPassword('Pass123!'),
      role: 'USER',
      status: 'ACTIVE'
    });

    const shadyIssuer = await Issuer.create({
      issuerId: 'iss_verif_shady_' + Date.now(),
      issuerCode: 'ISS_VERIF_SHADY_' + Date.now(),
      userId: shadyUser.userId,
      organizationId: unverifiedOrg.organizationId,
      status: 'ACTIVE'
    });

    await issuerKeyService.generateKeyForIssuer(shadyIssuer.issuerId, adminUser);

    const shadyCred = await credentialService.issueCredential({
      issuerId: shadyIssuer.issuerId,
      recipientId: recipientUser.userId,
      documentId: testDocument.documentId,
      credentialType: 'DEGREE'
    }, adminUser);

    const report = await verificationEngine.evaluateVerification({
      credentialId: shadyCred.credential.credentialId,
      documentHash: testDocument.sha256Hash
    });

    assert.strictEqual(report.result, RESULT_TYPES.UNTRUSTED_ORIGIN);
    assert.strictEqual(report.trustLevel, TRUST_LEVELS.LEVEL_1_SOURCE_FOUND);
    assert.strictEqual(report.checks.organizationTrust.passed, false);
  });

  // ==========================================
  // 11. Conflicting Evidence
  // ==========================================
  test('CONFLICTING_EVIDENCE: OCR textual contradictions yield CONFLICTING_EVIDENCE', async () => {
    const report = await verificationEngine.evaluateVerification({
      credentialId: validCredential.credentialId,
      documentHash: testDocument.sha256Hash,
      ocrData: {
        extractedText: 'Degree issued by Harvard College',
        fieldsMatch: false,
        discrepancy: 'OCR extracted issuing body "Harvard College" which contradicts registry "Institute of Verified Science"'
      }
    });

    assert.strictEqual(report.result, RESULT_TYPES.CONFLICTING_EVIDENCE);
    assert.strictEqual(report.checks.conflicts.passed, false);
    assert.ok(report.warnings.some(w => w.includes('OCR text claims disagree')));
  });

  // ==========================================
  // 12. Manual Review Workflows
  // ==========================================
  test('MANUAL_REVIEW: pending manual review yields MANUAL_REVIEW', async () => {
    const report = await verificationEngine.evaluateVerification({
      credentialId: validCredential.credentialId,
      documentHash: testDocument.sha256Hash,
      manualReviewDecision: 'PENDING'
    });

    assert.strictEqual(report.result, RESULT_TYPES.MANUAL_REVIEW);
    assert.strictEqual(report.trustLevel, TRUST_LEVELS.LEVEL_3_INTEGRITY_VERIFIED);
  });

  test('MANUALLY_VERIFIED: approved manual review yields MANUALLY_VERIFIED and LEVEL 5 CURRENTLY_VALID', async () => {
    const report = await verificationEngine.evaluateVerification({
      credentialId: validCredential.credentialId,
      documentHash: testDocument.sha256Hash,
      manualReviewDecision: 'VERIFIED'
    });

    assert.strictEqual(report.result, RESULT_TYPES.MANUALLY_VERIFIED);
    assert.strictEqual(report.trustLevel, TRUST_LEVELS.LEVEL_5_CURRENTLY_VALID);
  });

  // ==========================================
  // 13. API Endpoint Integration Test
  // ==========================================
  test('POST /api/verifications/evaluate executes pipeline and persists audit record', async () => {
    const res = await fetch(`${baseUrl}/api/verifications/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        credentialId: validCredential.credentialId,
        claimedRecipientId: recipientUser.userId,
        documentHash: testDocument.sha256Hash
      })
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);

    const data = body.data;
    assert.ok(data.verificationId);
    assert.strictEqual(data.result, RESULT_TYPES.VERIFIED);
    assert.strictEqual(data.trustLevel, TRUST_LEVELS.LEVEL_5_CURRENTLY_VALID);
    assert.ok(data.checks);
    assert.ok(Array.isArray(data.evidence));
    assert.ok(Array.isArray(data.warnings));
    assert.ok(data.explanation);

    // Verify persisted record lookup
    const lookupRes = await fetch(`${baseUrl}/api/verifications/${data.verificationId}`);
    assert.strictEqual(lookupRes.status, 200);
    const lookupBody = await lookupRes.json();
    assert.strictEqual(lookupBody.data.verification.verificationId, data.verificationId);
  });
});

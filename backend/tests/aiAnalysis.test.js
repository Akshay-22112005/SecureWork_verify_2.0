const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const app = require('../src/app');
const { connectDB, disconnectDB } = require('../src/config/db');
const User = require('../src/models/user.model');
const Organization = require('../src/models/organization.model');
const Issuer = require('../src/models/issuer.model');
const Document = require('../src/models/document.model');
const Credential = require('../src/models/credential.model');
const CredentialVersion = require('../src/models/credentialVersion.model');
const OcrAnalysis = require('../src/models/ocrAnalysis.model');
const AIAnalysis = require('../src/models/aiAnalysis.model');
const aiService = require('../src/services/ai.service');
const { localAiAdapter } = require('../src/services/ai');
const issuerKeyService = require('../src/services/issuerKey.service');
const credentialService = require('../src/services/credential.service');
const verificationService = require('../src/services/verification.service');
const { generateToken } = require('../src/utils/jwt');
const { sha256 } = require('../src/utils/crypto');
const { RESULT_TYPES, TRUST_LEVELS } = require('../src/services/verification/verificationConstants');

describe('Phase 11 Local AI/ML Module Tests', () => {
  let server;
  let baseUrl;
  let adminUser;
  let adminToken;
  let regularUser;
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

    adminUser = await User.create({
      name: 'AI Admin',
      email: `ai_admin_${Date.now()}@securework.local`,
      passwordHash: await User.hashPassword('AdminPass123!'),
      role: 'ADMIN',
      status: 'ACTIVE'
    });
    adminToken = generateToken(adminUser);

    regularUser = await User.create({
      name: 'Grad Subject',
      email: `subject_${Date.now()}@securework.local`,
      passwordHash: await User.hashPassword('SubjectPass123!'),
      role: 'USER',
      status: 'ACTIVE'
    });

    testOrg = await Organization.create({
      organizationId: `org_ai_${Date.now()}`,
      organizationCode: `ORG_AI_${Date.now()}`,
      name: 'Pacific Institute of Technology',
      type: 'UNIVERSITY',
      officialDomain: 'pacific-tech.edu',
      organizationVerificationStatus: 'VERIFIED',
      status: 'ACTIVE',
      createdBy: adminUser.userId
    });

    testIssuer = await Issuer.create({
      issuerId: `iss_ai_${Date.now()}`,
      issuerCode: `ISS_AI_${Date.now()}`,
      userId: adminUser.userId,
      organizationId: testOrg.organizationId,
      status: 'ACTIVE'
    });

    await issuerKeyService.generateKeyForIssuer(testIssuer.issuerId, adminUser);

    const docBytes = Buffer.from('Official Diploma Certificate in Data Science and Machine Learning 2026');
    testDoc = await Document.create({
      documentId: `doc_ai_${Date.now()}`,
      originalFilename: 'diploma_ds.pdf',
      mimeType: 'application/pdf',
      fileSize: docBytes.length,
      storagePath: 'diploma_ds.pdf',
      sha256Hash: sha256(docBytes),
      uploadedBy: adminUser.userId,
      representationType: 'ORIGINAL_DIGITAL_FILE'
    });

    // Ingest OCR analysis record for this document
    await OcrAnalysis.create({
      documentId: testDoc.documentId,
      status: 'SUCCESS',
      ocrText: 'Pacific Institute of Technology\nThis certifies that Jane Doe has been awarded Bachelor of Science\nDate: 2026-06-01\nCertificate No: CERT-2026-DS',
      ocrEngine: 'Tesseract.js (Local)',
      ocrVersion: '5.1.1',
      extractedFields: {
        recipientName: 'Jane Doe',
        organizationName: 'Pacific Institute of Technology',
        credentialType: 'Bachelor of Science',
        issueDate: '2026-06-01',
        identifier: 'CERT-2026-DS'
      }
    });

    const issued = await credentialService.issueCredential({
      issuerId: testIssuer.issuerId,
      recipientId: regularUser.userId,
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
  // 1. Local AI Analysis (FULL_LOCAL default)
  // ==========================================
  test('Local AI analysis: runs in FULL_LOCAL mode without external APIs', async () => {
    assert.strictEqual(localAiAdapter.getMode(), 'FULL_LOCAL', 'Default mode must be FULL_LOCAL');

    const analysis = await aiService.analyzeDocument(testDoc.documentId, {}, adminUser);

    assert.ok(analysis);
    assert.strictEqual(analysis.documentId, testDoc.documentId);
    assert.strictEqual(analysis.status, 'SUCCESS');
    assert.ok(['LOW', 'MEDIUM', 'HIGH'].includes(analysis.riskLevel));
    assert.ok(typeof analysis.riskScore === 'number' || typeof analysis.score === 'number');
    assert.ok(Array.isArray(analysis.findings));
    assert.ok(analysis.modelName);
    assert.ok(analysis.modelVersion);
    assert.ok(analysis.createdAt);
  });

  // ==========================================
  // 2. AI Unavailable Mode
  // ==========================================
  test('AI unavailable mode: returns explicit unavailable state without crashing', async () => {
    localAiAdapter.simulateUnavailable(true);

    const analysis = await aiService.analyzeDocument(testDoc.documentId, {}, adminUser);

    assert.strictEqual(analysis.status, 'UNAVAILABLE');
    assert.strictEqual(analysis.message, 'AI analysis unavailable');
    assert.ok(analysis.errorReason.includes('unavailable'));

    localAiAdapter.simulateUnavailable(false);
  });

  // ==========================================
  // 3. AI Evidence Persistence
  // ==========================================
  test('AI evidence persistence: stores structured record in MongoDB', async () => {
    const record = await AIAnalysis.findOne({ documentId: testDoc.documentId, status: 'SUCCESS' });

    assert.ok(record);
    assert.strictEqual(record.documentId, testDoc.documentId);
    assert.ok(record.analysisId.startsWith('ai_'));
    assert.ok(['LOW', 'MEDIUM', 'HIGH'].includes(record.riskLevel));
    assert.ok(record.modelName);
    assert.ok(record.createdAt);
  });

  // ==========================================
  // 4. IMPORTANT TRUST RULE: AI Cannot Override Signature Failure
  // ==========================================
  test('Strict Rule: AI low risk MUST NOT override digital signature failure', async () => {
    // 1. Alter credential version signature to simulate invalid cryptographic signature
    const version = await CredentialVersion.findOne({ credentialId: validCredential.credentialId });
    const originalSig = version.signature;
    version.signature = Buffer.alloc(64, 0x99).toString('base64');
    await version.save();

    // 2. Evaluate verification with AI reporting LOW risk
    const result = await verificationService.evaluateCredentialVerification({
      credentialId: validCredential.credentialId,
      documentHash: testDoc.sha256Hash,
      aiData: {
        riskLevel: 'LOW',
        score: 0.02,
        tamperingDetected: false,
        findings: []
      }
    }, adminUser);

    // 3. Invariant: Result MUST REMAIN SIGNATURE_INVALID (never VERIFIED)!
    assert.strictEqual(result.result, RESULT_TYPES.SIGNATURE_INVALID);
    assert.strictEqual(result.cryptographicStatus, 'FAILED');
    assert.notStrictEqual(result.result, RESULT_TYPES.VERIFIED);
    assert.ok(result.explanation.includes('Cryptographic signature is invalid'));

    // Restore signature
    version.signature = originalSig;
    await version.save();
  });

  // ==========================================
  // 5. IMPORTANT TRUST RULE: AI Cannot Override Revocation
  // ==========================================
  test('Strict Rule: AI low risk MUST NOT override credential revocation', async () => {
    // 1. Revoke the credential
    const cred = await Credential.findOne({ credentialId: validCredential.credentialId });
    cred.status = 'REVOKED';
    cred.revokedAt = new Date();
    cred.revocationReason = 'Honor code disciplinary breach';
    await cred.save();

    // 2. Evaluate verification with clean AI report
    const result = await verificationService.evaluateCredentialVerification({
      credentialId: validCredential.credentialId,
      documentHash: testDoc.sha256Hash,
      aiData: {
        riskLevel: 'LOW',
        score: 0.01,
        tamperingDetected: false,
        findings: []
      }
    }, adminUser);

    // 3. Invariant: Result MUST REMAIN CREDENTIAL_REVOKED (never VERIFIED)!
    assert.strictEqual(result.result, RESULT_TYPES.CREDENTIAL_REVOKED);
    assert.notStrictEqual(result.result, RESULT_TYPES.VERIFIED);
    assert.ok(result.explanation.includes('officially revoked'));

    // Restore credential status for remaining tests
    cred.status = 'ACTIVE';
    cred.revokedAt = null;
    cred.revocationReason = null;
    await cred.save();
  });

  // ==========================================
  // 6. AI Failure Does Not Break Verification
  // ==========================================
  test('AI failure/unavailability does not break core verification pipeline', async () => {
    localAiAdapter.simulateUnavailable(true);

    const result = await verificationService.evaluateCredentialVerification({
      credentialId: validCredential.credentialId,
      documentHash: testDoc.sha256Hash
    }, adminUser);

    assert.ok(result);
    assert.strictEqual(result.result, RESULT_TYPES.VERIFIED);
    assert.strictEqual(result.trustLevel, TRUST_LEVELS.LEVEL_5_CURRENTLY_VALID);
    assert.strictEqual(result.cryptographicStatus, 'PASSED');

    localAiAdapter.simulateUnavailable(false);
  });

  // ==========================================
  // 7. API Endpoints
  // ==========================================
  test('POST /api/analysis/document triggers AI analysis and returns structured result', async () => {
    const res = await fetch(`${baseUrl}/api/analysis/document`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        documentId: testDoc.documentId
      })
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.data.analysis);
    assert.strictEqual(body.data.analysis.documentId, testDoc.documentId);
    assert.ok(['LOW', 'MEDIUM', 'HIGH'].includes(body.data.analysis.riskLevel));
  });

  test('GET /api/analysis/:documentId retrieves stored analysis', async () => {
    const res = await fetch(`${baseUrl}/api/analysis/${testDoc.documentId}`);

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.data.analysis);
    assert.strictEqual(body.data.analysis.documentId, testDoc.documentId);
  });
});

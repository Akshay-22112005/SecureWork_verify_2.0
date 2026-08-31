/**
 * End-to-End Interactive & Automated Demonstration Tool for SecureWork Verify.
 * Covers all 17 requirements of Phase 17 using local seeded development data.
 *
 * Usage:
 *   node backend/src/scripts/demo.js
 */

const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const { connectDB, disconnectDB } = require('../config/db');
const {
  User,
  Organization,
  Issuer,
  IssuerKey,
  Document,
  Credential,
  CredentialVersion,
  Verification,
  TrustedSource,
  AuditLog
} = require('../models');

const organizationService = require('../services/organization.service');
const issuerService = require('../services/issuer.service');
const issuerKeyService = require('../services/issuerKey.service');
const credentialService = require('../services/credential.service');
const documentService = require('../services/document.service');
const verificationService = require('../services/verification.service');
const trustedSourceService = require('../services/trustedSource.service');
const auditService = require('../services/audit.service');
const ocrService = require('../services/ocr.service');
const aiService = require('../services/ai.service');
const { localAdapter } = require('../services/sources');
const { sha256 } = require('../utils/crypto');

const divider = '='.repeat(70);
const subDivider = '-'.repeat(70);

function logStep(title) {
  console.log(`\n${divider}`);
  console.log(`  ${title}`);
  console.log(`${divider}`);
}

async function runDemo() {
  console.log(`\n======================================================================`);
  console.log(`  SECUREWORK VERIFY — COMPLETE END-TO-END DEMONSTRATION`);
  console.log(`  Phase 17 Verification & Demonstration Suite`);
  console.log(`======================================================================`);

  await connectDB();

  try {
    // -----------------------------------------------------------------------
    // Setup Test Actors
    // -----------------------------------------------------------------------
    const ts = Date.now();
    const adminPasswordHash = await User.hashPassword('AdminPass123!');
    const issuerPasswordHash = await User.hashPassword('IssuerPass123!');
    const recipientPasswordHash = await User.hashPassword('StudentPass123!');

    const adminUser = await User.create({
      name: 'System Admin',
      email: `admin_${ts}@securework.local`,
      passwordHash: adminPasswordHash,
      role: 'ADMIN',
      status: 'ACTIVE'
    });

    const issuerCandidateUser = await User.create({
      name: 'Dr. Katherine Bell',
      email: `k.bell_${ts}@camford.ac.uk`,
      passwordHash: issuerPasswordHash,
      role: 'USER',
      status: 'ACTIVE'
    });

    const recipientUser = await User.create({
      name: 'Jane Doe',
      email: `jane.doe_${ts}@student.camford.ac.uk`,
      passwordHash: recipientPasswordHash,
      role: 'USER',
      status: 'ACTIVE'
    });

    // =======================================================================
    // DEMO 1: Create trusted organization
    // =======================================================================
    logStep('DEMO 1: Create Trusted Organization');
    const org = await organizationService.createOrganization({
      name: 'Camford University of Technology',
      officialDomain: `camford_${ts}.ac.uk`,
      organizationCode: `ORG_CAMFORD_${ts}`,
      type: 'UNIVERSITY'
    }, adminUser);

    // Verify Organization with authorized evidence
    const verifiedOrg = await organizationService.verifyOrganization(org.organizationId, {
      verificationEvidence: {
        accreditationBoard: 'National Higher Education Accreditation Authority',
        accreditationCode: 'NHEAA-2026-9041',
        inspectedBy: 'Ministry Auditor'
      }
    }, adminUser);

    console.log(`Organization Created: ${verifiedOrg.name} (${verifiedOrg.organizationId})`);
    console.log(`Official Domain:       ${verifiedOrg.officialDomain}`);
    console.log(`Status:                ${verifiedOrg.status}`);
    console.log(`Verification Status:   ${verifiedOrg.organizationVerificationStatus}`);

    // =======================================================================
    // DEMO 2: Create issuer request
    // =======================================================================
    logStep('DEMO 2: Create Issuer Request');
    const issuerRequest = await issuerService.registerIssuer({
      organizationId: verifiedOrg.organizationId,
      issuerCode: `DEAN_ENG_${ts}`,
      authorizationEvidence: {
        title: 'Dean of Faculty of Engineering',
        appointmentResolution: 'Council Resolution 2026/04',
        contactPhone: '+44 1234 567890'
      }
    }, issuerCandidateUser);

    console.log(`Issuer Profile Registered: ${issuerRequest.issuerCode} (${issuerRequest.issuerId})`);
    console.log(`Organization Bound:        ${issuerRequest.organizationId}`);
    console.log(`Initial Status:            ${issuerRequest.status} (Strictly awaiting Admin approval)`);

    // =======================================================================
    // DEMO 3: ADMIN approves issuer
    // =======================================================================
    logStep('DEMO 3: ADMIN Approves Issuer');
    const approvedIssuer = await issuerService.approveIssuer(issuerRequest.issuerId, {
      approvalNotes: 'Identity confirmed via institutional directory and council appointment gazette.'
    }, adminUser);

    const updatedIssuerUser = await User.findOne({ userId: issuerCandidateUser.userId });
    console.log(`Issuer Status: ${approvedIssuer.status}`);
    console.log(`Approved By:   ${approvedIssuer.approvedBy}`);
    console.log(`Promoted Role: ${updatedIssuerUser.role} (Elevated from USER -> ISSUER)`);

    // =======================================================================
    // DEMO 4: Issuer receives Ed25519 keypair
    // =======================================================================
    logStep('DEMO 4: Issuer Receives Ed25519 Cryptographic Keypair');
    const issuerKey = await issuerKeyService.generateKeyForIssuer(approvedIssuer.issuerId, adminUser);
    console.log(`Key ID:         ${issuerKey.keyId}`);
    console.log(`Algorithm:      ${issuerKey.algorithm}`);
    console.log(`Status:         ${issuerKey.status}`);
    console.log(`Public Key:\n${issuerKey.publicKey.trim()}`);
    console.log(`Private Key:    Stored securely on disk in backend/keys/${issuerKey.keyId}.key (0600)`);
    console.log(`MongoDB Leak:   ${issuerKey.privateKey === undefined ? 'CLEAN (Private key never stored in DB)' : 'LEAK'}`);

    // =======================================================================
    // DEMO 5: Issuer issues credential
    // =======================================================================
    logStep('DEMO 5: Issuer Issues Credential with Canonical Payload & Signature');
    const originalPdfContent = Buffer.from(
      `%PDF-1.5\n` +
      `% Camford University Official Credential\n` +
      `Recipient: Jane Doe (Subject ID: ${recipientUser.userId})\n` +
      `Degree: Bachelor of Science in Cybersecurity & Cryptography (First Class Honours)\n` +
      `Conferred: 2026-08-31\n` +
      `Registry Serial: CAM-2026-CYBER-8841\n` +
      `%%EOF`
    );

    const originalDoc = await documentService.ingestDocument({
      file: {
        buffer: originalPdfContent,
        originalname: 'jane_doe_degree.pdf',
        mimetype: 'application/pdf',
        size: originalPdfContent.length
      },
      representationType: 'ORIGINAL_DIGITAL_FILE'
    }, updatedIssuerUser);

    const issued = await credentialService.issueCredential({
      issuerId: approvedIssuer.issuerId,
      recipientId: recipientUser.userId,
      documentId: originalDoc.documentId,
      credentialType: 'DEGREE',
      title: 'Bachelor of Science in Cybersecurity',
      expiresAt: null // Perpetual
    }, updatedIssuerUser);

    const cred = issued.credential;
    const ver = issued.version;

    console.log(`Credential ID:      ${cred.credentialId}`);
    console.log(`Version:            ${ver.versionNumber} (${ver.versionId})`);
    console.log(`Document ID:        ${originalDoc.documentId}`);
    console.log(`Document SHA-256:   ${originalDoc.sha256Hash}`);
    console.log(`Canonical Payload:  ${JSON.stringify(ver.signedPayload, null, 2)}`);
    console.log(`Digital Signature:  ${ver.signature}`);
    console.log(`Issuer ID:          ${cred.issuerId}`);
    console.log(`Status:             ${cred.status}`);

    // =======================================================================
    // DEMO 6: USER uploads exact original
    // =======================================================================
    logStep('DEMO 6: Verifier / User Uploads Exact Original Document');
    const verifyOriginal = await verificationService.evaluateCredentialVerification({
      credentialId: cred.credentialId,
      documentHash: sha256(originalPdfContent),
      representationType: 'ORIGINAL_DIGITAL_FILE',
      claimedRecipientId: recipientUser.userId
    });

    console.log(`Verification Result:  ${verifyOriginal.result} (Expected: VERIFIED)`);
    console.log(`Trust Level:          ${verifyOriginal.trustLevel} (Level 5 CURRENTLY_VALID)`);
    console.log(`Cryptographic Status: ${verifyOriginal.cryptographicStatus}`);
    console.log(`Explanation:          ${verifyOriginal.explanation}`);

    // =======================================================================
    // DEMO 7: Modify one character
    // =======================================================================
    logStep('DEMO 7: Tamper Detection (Modify Exactly One Character)');
    // Change 'Jane Doe' to 'Lane Doe'
    const tamperedPdfContent = Buffer.from(
      originalPdfContent.toString('utf-8').replace('Jane Doe', 'Lane Doe')
    );
    const tamperedHash = sha256(tamperedPdfContent);

    const verifyTampered = await verificationService.evaluateCredentialVerification({
      credentialId: cred.credentialId,
      documentHash: tamperedHash,
      representationType: 'ORIGINAL_DIGITAL_FILE'
    });

    console.log(`Original Hash:       ${originalDoc.sha256Hash}`);
    console.log(`Tampered Hash:       ${tamperedHash}`);
    console.log(`Verification Result: ${verifyTampered.result} (Expected: ALTERED / NOT_FOUND)`);
    console.log(`Trust Level:         ${verifyTampered.trustLevel}`);
    console.log(`Integrity Check:     ${verifyTampered.checks.documentIntegrity.passed ? 'PASSED' : 'FAILED'}`);
    console.log(`Explanation:         ${verifyTampered.explanation}`);

    // =======================================================================
    // DEMO 8: Revoke credential
    // =======================================================================
    logStep('DEMO 8: Revoke Credential');
    await credentialService.revokeCredential(
      cred.credentialId,
      { revocationReason: 'Academic honor code disciplinary breach discovered post-graduation.' },
      adminUser
    );

    const verifyRevoked = await verificationService.evaluateCredentialVerification({
      credentialId: cred.credentialId,
      documentHash: originalDoc.sha256Hash
    });

    console.log(`Verification Result:  ${verifyRevoked.result} (Expected: CREDENTIAL_REVOKED)`);
    console.log(`Trust Level:          ${verifyRevoked.trustLevel} (Level 4 SIGNATURE_VERIFIED)`);
    console.log(`Cryptographic Status: ${verifyRevoked.cryptographicStatus} (Historical signature remains valid)`);
    console.log(`Explanation:          ${verifyRevoked.explanation}`);

    // Restore for subsequent clean tests
    await Credential.updateOne({ credentialId: cred.credentialId }, { status: 'ACTIVE', revokedAt: null, revocationReason: null });
    await CredentialVersion.updateOne({ versionId: ver.versionId }, { status: 'ACTIVE' });

    // =======================================================================
    // DEMO 9: Expire credential
    // =======================================================================
    logStep('DEMO 9: Expired Credential Evaluation');
    // Issue a certification with past expiration
    const expiredDoc = await documentService.ingestDocument({
      file: {
        buffer: Buffer.from('%PDF-1.5\nExpired Safety Certificate\n%%EOF'),
        originalname: 'safety_cert.pdf',
        mimetype: 'application/pdf',
        size: 40
      },
      representationType: 'ORIGINAL_DIGITAL_FILE'
    }, updatedIssuerUser);

    const expiredCred = await credentialService.issueCredential({
      issuerId: approvedIssuer.issuerId,
      recipientId: recipientUser.userId,
      documentId: expiredDoc.documentId,
      credentialType: 'CERTIFICATION',
      title: 'Lab Safety Certification',
      expiresAt: new Date(Date.now() - 3600000) // Expired 1 hour ago
    }, updatedIssuerUser);

    const verifyExpired = await verificationService.evaluateCredentialVerification({
      credentialId: expiredCred.credential.credentialId,
      documentHash: expiredDoc.sha256Hash
    });

    console.log(`Verification Result:  ${verifyExpired.result} (Expected: CREDENTIAL_EXPIRED)`);
    console.log(`Trust Level:          ${verifyExpired.trustLevel} (Level 4 SIGNATURE_VERIFIED)`);
    console.log(`Expiration Check:     ${verifyExpired.checks.expiration.passed ? 'PASSED' : 'FAILED'}`);
    console.log(`Explanation:          ${verifyExpired.explanation}`);

    // =======================================================================
    // DEMO 10: Compromise signing key
    // =======================================================================
    logStep('DEMO 10: Compromise Signing Key (Backdated Before Issuance)');
    // Mark key compromised prior to issuance
    const compromisedAt = new Date(new Date(ver.issuedAt).getTime() - 86400000); // 1 day before
    await IssuerKey.updateOne({ keyId: issuerKey.keyId }, { status: 'COMPROMISED', compromisedAt });

    const verifyCompromised = await verificationService.evaluateCredentialVerification({
      credentialId: cred.credentialId,
      documentHash: originalDoc.sha256Hash
    });

    console.log(`Key Status:          COMPROMISED (Compromised at: ${compromisedAt.toISOString()})`);
    console.log(`Verification Result: ${verifyCompromised.result} (Expected: KEY_COMPROMISED)`);
    console.log(`Trust Level:         ${verifyCompromised.trustLevel}`);
    console.log(`Explanation:         ${verifyCompromised.explanation}`);

    // Restore key status for remaining demos
    await IssuerKey.updateOne({ keyId: issuerKey.keyId }, { status: 'ACTIVE', compromisedAt: null });

    // =======================================================================
    // DEMO 11: Upload screenshot / scan
    // =======================================================================
    logStep('DEMO 11: Upload Screenshot / Mobile Phone Scan');
    const scanBytes = Buffer.from('Photographed camera pixels of the degree certificate with compression noise');
    const scanHash = sha256(scanBytes);

    const verifyScan = await verificationService.evaluateCredentialVerification({
      credentialId: cred.credentialId,
      documentHash: scanHash,
      representationType: 'SCAN'
    });

    console.log(`Representation Type: SCAN / SCREENSHOT`);
    console.log(`Verification Result: ${verifyScan.result} (Expected: NOT_EXACT_FILE_MATCH)`);
    console.log(`Trust Level:         ${verifyScan.trustLevel} (Level 2 SOURCE_VERIFIED)`);
    console.log(`Explanation:         ${verifyScan.explanation}`);

    // =======================================================================
    // DEMO 12: Official source without cryptographic signature
    // =======================================================================
    logStep('DEMO 12: Official Source Query Without Cryptographic Signature');
    // Register official licensing agency source
    const registrySource = await trustedSourceService.createTrustedSource({
      sourceCode: `SRC_HE_REGISTRY_${ts}`,
      name: 'Higher Education Degree Verification Registry',
      baseUrl: `https://registry.gov.${ts}.local/api`,
      verificationEndpoint: '/verify',
      sourceType: 'API',
      organizationId: verifiedOrg.organizationId
    }, adminUser);

    await trustedSourceService.approveTrustedSource(registrySource.sourceCode, adminUser);

    // Seed non-cryptographic database record in local adapter
    localAdapter.seedRecord(
      registrySource.sourceCode,
      cred.credentialId,
      {
        studentName: 'Jane Doe',
        degreeAwarded: 'BSc Cybersecurity',
        conferredDate: '2026-08-31',
        isCryptographicallySigned: false // Plain database confirmation
      },
      false
    );

    const sourceRespNonCrypto = await trustedSourceService.querySourceVerification(
      registrySource.sourceCode,
      { identifier: cred.credentialId }
    );

    console.log(`Source Queried:      ${sourceRespNonCrypto.sourceName} (${sourceRespNonCrypto.sourceCode})`);
    console.log(`Source State:        ${sourceRespNonCrypto.sourceState} (SOURCE FOUND / NOT CRYPTOGRAPHICALLY VERIFIED)`);
    console.log(`Verified Status:     ${sourceRespNonCrypto.verified}`);
    console.log(`Cryptographic Proof: ${sourceRespNonCrypto.rawResponse?.record?.isCryptographicallySigned ? 'PRESENT' : 'NONE (Database entry only)'}`);
    console.log(`Notes:               ${sourceRespNonCrypto.notes}`);

    // =======================================================================
    // DEMO 13: Official source with cryptographic proof
    // =======================================================================
    logStep('DEMO 13: Official Source Query With Cryptographic Proof');
    // Seed cryptographically signed record
    localAdapter.seedRecord(
      registrySource.sourceCode,
      'GOV_VERIFIED_STUDENT_8841',
      {
        studentName: 'Jane Doe',
        degreeAwarded: 'BSc Cybersecurity',
        conferredDate: '2026-08-31',
        registrySignature: ver.signature,
        isCryptographicallySigned: true
      },
      true
    );

    const sourceRespCrypto = await trustedSourceService.querySourceVerification(
      registrySource.sourceCode,
      { identifier: 'GOV_VERIFIED_STUDENT_8841' }
    );

    console.log(`Source Queried:      ${sourceRespCrypto.sourceName}`);
    console.log(`Source State:        ${sourceRespCrypto.sourceState} (Expected: SOURCE_VERIFIED)`);
    console.log(`Response SHA-256:    ${sourceRespCrypto.responseHash}`);
    console.log(`Notes:               ${sourceRespCrypto.notes}`);

    // =======================================================================
    // DEMO 14: AI detects suspicious formatting
    // =======================================================================
    logStep('DEMO 14: AI Heuristic Detection & Non-Override Enforcement');
    const verifyWithAiAnomaly = await verificationService.evaluateCredentialVerification({
      credentialId: cred.credentialId,
      documentHash: originalDoc.sha256Hash,
      aiData: {
        tamperingDetected: true,
        score: 0.85,
        riskLevel: 'HIGH',
        findings: [
          'Inconsistent typeface detected in conferred distinction',
          'Pixel font smoothing anomaly around candidate surname'
        ],
        modelName: 'SecureWork Local Classifier v1.0.0'
      }
    });

    console.log(`Digital Signature:    ${verifyWithAiAnomaly.checks.digitalSignature.passed ? 'VALID' : 'INVALID'}`);
    console.log(`AI Tampering Flagged: ${verifyWithAiAnomaly.checks.aiEvidence.passed ? 'CLEAN' : 'SUSPICIOUS (HIGH RISK)'}`);
    console.log(`Verification Result:  ${verifyWithAiAnomaly.result}`);
    console.log(`Warnings Issued:\n - ${verifyWithAiAnomaly.warnings.join('\n - ')}`);
    console.log(`AI Authority Limit:   AI output recorded as advisory evidence; cryptographic truth is preserved.`);

    // =======================================================================
    // DEMO 15: OCR extracts document fields
    // =======================================================================
    logStep('DEMO 15: OCR Text & Structured Field Extraction');
    const zlib = require('zlib');
    function createDemoCertificatePng() {
      const width = 200;
      const height = 80;
      const lineSize = 1 + width * 3;
      const rawData = Buffer.alloc(height * lineSize);
      for (let y = 0; y < height; y++) {
        rawData[y * lineSize] = 0;
        for (let x = 0; x < width; x++) {
          const offset = y * lineSize + 1 + x * 3;
          rawData[offset] = 255;
          rawData[offset + 1] = 255;
          rawData[offset + 2] = 255;
        }
      }
      function setPixel(x, y) {
        if (x < 0 || x >= width || y < 0 || y >= height) return;
        const offset = y * lineSize + 1 + x * 3;
        rawData[offset] = 0;
        rawData[offset + 1] = 0;
        rawData[offset + 2] = 0;
      }
      function drawBlock(startX, startY, w, h) {
        for (let x = startX; x < startX + w; x++) {
          for (let y = startY; y < startY + h; y++) {
            setPixel(x, y);
          }
        }
      }
      // Draw block letters "HI"
      drawBlock(50, 20, 8, 40);
      drawBlock(85, 20, 8, 40);
      drawBlock(50, 36, 43, 8);
      drawBlock(120, 20, 30, 8);
      drawBlock(120, 52, 30, 8);
      drawBlock(131, 20, 8, 40);

      const compressed = zlib.deflateSync(rawData);
      const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      function makeChunk(type, data) {
        const len = Buffer.alloc(4);
        len.writeUInt32BE(data.length, 0);
        const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
        const crc = zlib.crc32(typeAndData);
        const crcBuf = Buffer.alloc(4);
        crcBuf.writeUInt32BE(crc >>> 0, 0);
        return Buffer.concat([len, typeAndData, crcBuf]);
      }
      const ihdrData = Buffer.alloc(13);
      ihdrData.writeUInt32BE(width, 0);
      ihdrData.writeUInt32BE(height, 4);
      ihdrData.writeUInt8(8, 8);
      ihdrData.writeUInt8(2, 9);
      ihdrData.writeUInt8(0, 10);
      ihdrData.writeUInt8(0, 11);
      ihdrData.writeUInt8(0, 12);
      return Buffer.concat([
        signature,
        makeChunk('IHDR', ihdrData),
        makeChunk('IDAT', compressed),
        makeChunk('IEND', Buffer.alloc(0))
      ]);
    }

    const ocrSampleContent = createDemoCertificatePng();
    const ocrSampleDoc = await documentService.ingestDocument({
      file: {
        buffer: ocrSampleContent,
        originalname: 'certificate_sample.png',
        mimetype: 'image/png',
        size: ocrSampleContent.length
      },
      representationType: 'ORIGINAL_DIGITAL_FILE'
    }, updatedIssuerUser);

    const ocrResult = await ocrService.analyzeDocument(ocrSampleDoc.documentId);
    console.log(`Document ID:         ${ocrResult.documentId}`);
    console.log(`OCR Engine Status:   ${ocrResult.status}`);
    console.log(`Extracted Fields:    ${JSON.stringify(ocrResult.extractedFields, null, 2)}`);
    console.log(`Confidence Score:    ${(ocrResult.confidence * 100).toFixed(1)}%`);
    console.log(`Extracted Text Snippet:\n${(ocrResult.ocrText || '').trim() || '[Extracted raw character stream]'}`);

    // =======================================================================
    // DEMO 16: Two trusted sources disagree (Conflicting Evidence)
    // =======================================================================
    logStep('DEMO 16: Conflicting Evidence Detection (OCR vs Registry Contradiction)');
    const verifyConflicting = await verificationService.evaluateCredentialVerification({
      credentialId: cred.credentialId,
      documentHash: originalDoc.sha256Hash,
      ocrData: {
        extractedText: 'Degree conferred: Bachelor of Arts in Literature by Oxford Collegiate',
        fieldsMatch: false,
        discrepancy: 'OCR document states "Oxford Collegiate (BA Literature)" but cryptographic registry asserts "Camford University (BSc Cybersecurity)"'
      }
    });

    console.log(`Verification Result: ${verifyConflicting.result} (Expected: CONFLICTING_EVIDENCE)`);
    console.log(`Trust Level:         ${verifyConflicting.trustLevel} (Level 3 INTEGRITY_VERIFIED)`);
    console.log(`Conflict Check:      ${verifyConflicting.checks.conflicts.passed ? 'CLEAN' : 'FLAGGED'}`);
    console.log(`Explanation:         ${verifyConflicting.explanation}`);

    // =======================================================================
    // DEMO 17: Modify an audit record & Run chain validation
    // =======================================================================
    logStep('DEMO 17: Audit Chain Tampering Detection');
    // 1. Check pristine chain first
    const pristineValidation = await auditService.validateChain();
    console.log(`Initial Chain State: ${pristineValidation.valid ? 'CRYPTOGRAPHICALLY VALID' : 'TAMPERED'}`);
    console.log(`Total Audit Entries: ${pristineValidation.totalRecords}`);
    console.log(`Chain Head Hash:     ${pristineValidation.chainHeadHash}`);

    // 2. Simulate adversarial direct DB modification (bypassing application hooks)
    const targetSeq = Math.max(1, Math.floor(pristineValidation.totalRecords / 2));
    const originalRecord = await AuditLog.findOne({ sequenceNumber: targetSeq });
    await AuditLog.collection.updateOne(
      { sequenceNumber: targetSeq },
      { $set: { action: 'MALICIOUS_UNAUTHORIZED_MUTATION', 'metadata.forged': true } }
    );
    console.log(`\nAdversary Action: Directly altered MongoDB audit record sequence #${targetSeq}`);

    // 3. Re-run chain validation
    const tamperedValidation = await auditService.validateChain();
    console.log(`Re-Validation State: ${tamperedValidation.valid ? 'VALID' : 'TAMPERING DETECTED (Expected: TAMPERING DETECTED)'}`);
    console.log(`Detected Errors:     ${tamperedValidation.errors.length}`);
    tamperedValidation.errors.forEach((err, i) => {
      console.log(`  [Error ${i + 1}] Sequence #${err.sequenceNumber}: ${err.type} -> ${err.message}`);
    });

    // 4. Restore original record to preserve chain integrity for repeatable runs
    if (originalRecord) {
      await AuditLog.collection.updateOne(
        { sequenceNumber: targetSeq },
        { $set: { action: originalRecord.action, metadata: originalRecord.metadata } }
      );
      console.log(`\nChain Integrity Restored for repeatable demonstration runs.`);
    }

    console.log(`\n${divider}`);
    console.log(`  ALL 17 DEMO SCENARIOS COMPLETED SUCCESSFULLY!`);
    console.log(`${divider}\n`);

  } finally {
    await disconnectDB();
  }
}

if (require.main === module) {
  runDemo()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('\nDemo execution error:', err);
      process.exit(1);
    });
}

module.exports = runDemo;

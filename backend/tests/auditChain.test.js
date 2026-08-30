const { test, describe, before, after, beforeEach } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const app = require('../src/app');
const { connectDB, disconnectDB } = require('../src/config/db');
const User = require('../src/models/user.model');
const AuditLog = require('../src/models/auditLog.model');
const AuditCheckpoint = require('../src/models/auditCheckpoint.model');
const auditService = require('../src/services/audit.service');
const { generateToken } = require('../src/utils/jwt');
const { sha256 } = require('../src/utils/crypto');

describe('Phase 12 Hash-Chained Audit Log Tests', () => {
  let server;
  let baseUrl;
  let adminUser;
  let auditorUser;
  let regularUser;
  let adminToken;
  let auditorToken;
  let userToken;

  before(async () => {
    await connectDB();

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;

    adminUser = await User.create({
      name: 'Audit Admin',
      email: `audit_admin_${Date.now()}@securework.local`,
      passwordHash: await User.hashPassword('AdminPass123!'),
      role: 'ADMIN',
      status: 'ACTIVE'
    });
    adminToken = generateToken(adminUser);

    auditorUser = await User.create({
      name: 'Chief Auditor',
      email: `chief_auditor_${Date.now()}@securework.local`,
      passwordHash: await User.hashPassword('AuditorPass123!'),
      role: 'AUDITOR',
      status: 'ACTIVE'
    });
    auditorToken = generateToken(auditorUser);

    regularUser = await User.create({
      name: 'Standard User',
      email: `standard_${Date.now()}@securework.local`,
      passwordHash: await User.hashPassword('UserPass123!'),
      role: 'USER',
      status: 'ACTIVE'
    });
    userToken = generateToken(regularUser);
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

  beforeEach(async () => {
    // Reset audit collection to test a pristine chain in isolation
    await AuditLog.collection.deleteMany({});
    await AuditCheckpoint.collection.deleteMany({});
  });

  // ==========================================
  // 1. Chain Creation & Genesis
  // ==========================================
  test('Chain creation & Genesis: first record links to SHA256("GENESIS_SECUREWORK_VERIFY")', async () => {
    const expectedGenesisHash = sha256('GENESIS_SECUREWORK_VERIFY');

    const firstLog = await auditService.appendLog({
      action: 'ORGANIZATION_CREATED',
      performedBy: adminUser.userId,
      targetType: 'ORGANIZATION',
      targetId: 'org_test_genesis',
      metadata: { name: 'Genesis University' }
    });

    assert.strictEqual(firstLog.sequenceNumber, 1, 'Genesis record must have sequenceNumber 1');
    assert.strictEqual(firstLog.previousHash, expectedGenesisHash, 'Genesis record previousHash must match expected');
    assert.ok(firstLog.currentHash, 'Current hash must be generated');

    const expectedCurrentHash = auditService.computeEntryHash(firstLog);
    assert.strictEqual(firstLog.currentHash, expectedCurrentHash, 'currentHash must match canonical computed hash');
  });

  // ==========================================
  // 2. Multiple Records Chain Linkage
  // ==========================================
  test('Multiple records: each record references previousHash and sequence increments uniquely', async () => {
    const record1 = await auditService.appendLog({
      action: 'USER_REGISTERED',
      performedBy: 'SYSTEM',
      targetType: 'USER',
      targetId: 'usr_1',
      metadata: { email: 'user1@test.local' }
    });

    const record2 = await auditService.appendLog({
      action: 'ISSUER_KEY_GENERATED',
      performedBy: adminUser.userId,
      targetType: 'ISSUER_KEY',
      targetId: 'key_1',
      metadata: { algorithm: 'ED25519' }
    });

    const record3 = await auditService.appendLog({
      action: 'CREDENTIAL_ISSUED',
      performedBy: adminUser.userId,
      targetType: 'CREDENTIAL',
      targetId: 'crd_1',
      metadata: { credentialType: 'DEGREE' }
    });

    assert.strictEqual(record1.sequenceNumber, 1);
    assert.strictEqual(record2.sequenceNumber, 2);
    assert.strictEqual(record3.sequenceNumber, 3);

    assert.strictEqual(record2.previousHash, record1.currentHash, 'Record 2 must link to Record 1 currentHash');
    assert.strictEqual(record3.previousHash, record2.currentHash, 'Record 3 must link to Record 2 currentHash');

    // Confirm all hashes are unique
    const hashes = new Set([record1.currentHash, record2.currentHash, record3.currentHash]);
    assert.strictEqual(hashes.size, 3);
  });

  // ==========================================
  // 3. Chain Validation (Pristine)
  // ==========================================
  test('Chain validation: pristine chain passes cryptographic verification with valid: true', async () => {
    for (let i = 1; i <= 5; i++) {
      await auditService.appendLog({
        action: `EVENT_${i}`,
        performedBy: adminUser.userId,
        targetType: 'ENTITY',
        targetId: `ent_${i}`,
        metadata: { index: i }
      });
    }

    const report = await auditService.validateChain();

    assert.strictEqual(report.valid, true);
    assert.strictEqual(report.totalRecords, 5);
    assert.strictEqual(report.errors.length, 0);
    assert.ok(report.chainHeadHash);
    assert.strictEqual(report.genesisHash, sha256('GENESIS_SECUREWORK_VERIFY'));
  });

  // ==========================================
  // 4. Tampering Detection (Modified Record)
  // ==========================================
  test('Tampering detection: modifying an audit record content is detected by validateChain', async () => {
    for (let i = 1; i <= 4; i++) {
      await auditService.appendLog({
        action: `VALID_EVENT_${i}`,
        performedBy: adminUser.userId,
        targetType: 'ENTITY',
        targetId: `ent_${i}`,
        metadata: { value: i * 100 }
      });
    }

    // Directly tamper with record #2 in raw database (bypassing Mongoose hooks)
    await AuditLog.collection.updateOne(
      { sequenceNumber: 2 },
      { $set: { action: 'MALICIOUS_FORGED_ACTION', 'metadata.value': 999999 } }
    );

    const report = await auditService.validateChain();

    assert.strictEqual(report.valid, false, 'Chain must be marked invalid after tampering');
    assert.ok(report.errors.length >= 1);

    const hashError = report.errors.find(e => e.sequenceNumber === 2 && e.type === 'INCORRECT_CURRENT_HASH');
    assert.ok(hashError, 'Must report INCORRECT_CURRENT_HASH for sequence 2');
    assert.ok(hashError.message.includes('modified'));
  });

  // ==========================================
  // 5. Deletion Detection (Sequence Gap)
  // ==========================================
  test('Deletion detection: deleting a record from the middle of the chain is detected', async () => {
    for (let i = 1; i <= 4; i++) {
      await auditService.appendLog({
        action: `STEP_${i}`,
        performedBy: adminUser.userId,
        targetType: 'STEP',
        targetId: `step_${i}`
      });
    }

    // Delete record #3 directly from raw collection
    await AuditLog.collection.deleteOne({ sequenceNumber: 3 });

    const report = await auditService.validateChain();

    assert.strictEqual(report.valid, false, 'Chain must fail validation upon record deletion');
    const gapError = report.errors.find(e => e.type === 'SEQUENCE_GAP');
    assert.ok(gapError, 'Must detect SEQUENCE_GAP');

    const brokenLinkError = report.errors.find(e => e.type === 'BROKEN_PREVIOUS_HASH');
    assert.ok(brokenLinkError, 'Must detect BROKEN_PREVIOUS_HASH');
  });

  // ==========================================
  // 6. Reordering Detection
  // ==========================================
  test('Reordering detection: swapped or out-of-order records are flagged', async () => {
    await auditService.appendLog({ action: 'A', performedBy: 'U', targetType: 'T', targetId: '1' });
    await auditService.appendLog({ action: 'B', performedBy: 'U', targetType: 'T', targetId: '2' });
    await auditService.appendLog({ action: 'C', performedBy: 'U', targetType: 'T', targetId: '3' });

    // Swap sequence numbers between records 2 and 3 in MongoDB collection
    await AuditLog.collection.updateOne({ sequenceNumber: 2 }, { $set: { sequenceNumber: 99 } });
    await AuditLog.collection.updateOne({ sequenceNumber: 3 }, { $set: { sequenceNumber: 2 } });
    await AuditLog.collection.updateOne({ sequenceNumber: 99 }, { $set: { sequenceNumber: 3 } });

    const report = await auditService.validateChain();

    assert.strictEqual(report.valid, false, 'Reordered records must invalidate the chain');
    assert.ok(report.errors.length > 0);
  });

  // ==========================================
  // 7. Checkpoint Creation
  // ==========================================
  test('Checkpoint creation: creates internal anchor over current chain head', async () => {
    for (let i = 1; i <= 3; i++) {
      await auditService.appendLog({
        action: `CHECKPOINT_ACTION_${i}`,
        performedBy: adminUser.userId,
        targetType: 'SYSTEM',
        targetId: `sys_${i}`
      });
    }

    const lastLog = await AuditLog.findOne().sort({ sequenceNumber: -1 });

    const checkpoint = await auditService.createCheckpoint({
      externalAnchorType: 'INTERNAL_LOCAL',
      externalReference: 'LOCAL_TEST_REF_001'
    }, auditorUser);

    assert.ok(checkpoint.checkpointId.startsWith('chk_'));
    assert.strictEqual(checkpoint.sequenceStart, 1);
    assert.strictEqual(checkpoint.sequenceEnd, 3);
    assert.strictEqual(checkpoint.chainHeadHash, lastLog.currentHash);
    assert.strictEqual(checkpoint.externalAnchorType, 'INTERNAL_LOCAL');

    // Confirm persisted in database
    const saved = await AuditCheckpoint.findOne({ checkpointId: checkpoint.checkpointId });
    assert.ok(saved);
    assert.strictEqual(saved.chainHeadHash, lastLog.currentHash);
  });

  // ==========================================
  // 8. RBAC for Audit Log API
  // ==========================================
  describe('RBAC for Audit Log Endpoints', () => {
    beforeEach(async () => {
      await auditService.appendLog({
        action: 'ACCESS_TEST_LOG',
        performedBy: adminUser.userId,
        targetType: 'SECURITY',
        targetId: 'sec_1'
      });
    });

    test('AUDITOR can access GET /api/audit-logs and GET /api/audit-logs/validate', async () => {
      const listRes = await fetch(`${baseUrl}/api/audit-logs`, {
        headers: { Authorization: `Bearer ${auditorToken}` }
      });
      assert.strictEqual(listRes.status, 200);
      const listBody = await listRes.json();
      assert.strictEqual(listBody.success, true);
      assert.ok(Array.isArray(listBody.data.logs));

      const valRes = await fetch(`${baseUrl}/api/audit-logs/validate`, {
        headers: { Authorization: `Bearer ${auditorToken}` }
      });
      assert.strictEqual(valRes.status, 200);
      const valBody = await valRes.json();
      assert.strictEqual(valBody.success, true);
      assert.strictEqual(valBody.data.validation.valid, true);
    });

    test('ADMIN can access GET /api/audit-logs and create checkpoints', async () => {
      const chkRes = await fetch(`${baseUrl}/api/audit-logs/checkpoint`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({ externalAnchorType: 'INTERNAL_LOCAL' })
      });
      assert.strictEqual(chkRes.status, 201);
      const chkBody = await chkRes.json();
      assert.strictEqual(chkBody.success, true);
      assert.ok(chkBody.data.checkpoint.checkpointId);
    });

    test('Regular USER cannot access audit logs: returns 403 FORBIDDEN', async () => {
      const res = await fetch(`${baseUrl}/api/audit-logs`, {
        headers: { Authorization: `Bearer ${userToken}` }
      });
      assert.strictEqual(res.status, 403);
    });

    test('Unauthenticated client cannot access audit logs: returns 401 UNAUTHORIZED', async () => {
      const res = await fetch(`${baseUrl}/api/audit-logs`);
      assert.strictEqual(res.status, 401);
    });
  });
});

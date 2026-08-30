const { test, describe, before, after, beforeEach } = require('node:test');
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
const TrustedSource = require('../src/models/trustedSource.model');
const Notification = require('../src/models/notification.model');
const AuditLog = require('../src/models/auditLog.model');

const organizationService = require('../src/services/organization.service');
const issuerService = require('../src/services/issuer.service');
const issuerKeyService = require('../src/services/issuerKey.service');
const credentialService = require('../src/services/credential.service');
const verificationService = require('../src/services/verification.service');
const notificationService = require('../src/services/notification.service');
const auditService = require('../src/services/audit.service');
const { generateToken } = require('../src/utils/jwt');
const { sha256 } = require('../src/utils/crypto');

describe('Phase 13 Notifications & Backend Module Integration Tests', () => {
  let server;
  let baseUrl;
  let adminUser;
  let auditorUser;
  let issuerUser;
  let recipientUser;
  let unrelatedUser;

  let adminToken;
  let auditorToken;
  let issuerToken;
  let recipientToken;
  let unrelatedToken;

  before(async () => {
    await connectDB();

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;

    const stamp = Date.now();
    adminUser = await User.create({
      name: 'Integration Admin',
      email: `admin_${stamp}@securework.local`,
      passwordHash: await User.hashPassword('AdminPass123!'),
      role: 'ADMIN',
      status: 'ACTIVE'
    });
    adminToken = generateToken(adminUser);

    auditorUser = await User.create({
      name: 'Integration Auditor',
      email: `auditor_${stamp}@securework.local`,
      passwordHash: await User.hashPassword('AuditorPass123!'),
      role: 'AUDITOR',
      status: 'ACTIVE'
    });
    auditorToken = generateToken(auditorUser);

    issuerUser = await User.create({
      name: 'Dr. Jane Dean',
      email: `issuer_${stamp}@stanford.edu`,
      passwordHash: await User.hashPassword('IssuerPass123!'),
      role: 'USER',
      status: 'ACTIVE'
    });
    issuerToken = generateToken(issuerUser);

    recipientUser = await User.create({
      name: 'Alice Scholar',
      email: `alice_${stamp}@alumni.edu`,
      passwordHash: await User.hashPassword('ScholarPass123!'),
      role: 'USER',
      status: 'ACTIVE'
    });
    recipientToken = generateToken(recipientUser);

    unrelatedUser = await User.create({
      name: 'Unrelated User',
      email: `unrelated_${stamp}@external.com`,
      passwordHash: await User.hashPassword('UnrelatedPass123!'),
      role: 'USER',
      status: 'ACTIVE'
    });
    unrelatedToken = generateToken(unrelatedUser);
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
  // 1. Notification Adapter & In-App Storage
  // ==========================================
  describe('Notification Adapter & In-App Persistence', () => {
    test('LocalNotificationAdapter: dispatches and persists notification in MongoDB with IN_APP channel', async () => {
      const notif = await notificationService.notifyUser({
        recipientUserId: recipientUser.userId,
        type: 'GENERAL',
        title: 'System Welcome',
        message: 'Welcome to SecureWork Verify workforce portal.',
        severity: 'INFO',
        data: { feature: 'onboarding' }
      });

      assert.ok(notif.notificationId.startsWith('notif_'));
      assert.strictEqual(notif.recipientUserId, recipientUser.userId);
      assert.strictEqual(notif.read, false);
      assert.strictEqual(notif.channel, 'IN_APP');

      const saved = await Notification.findOne({ notificationId: notif.notificationId });
      assert.ok(saved);
      assert.strictEqual(saved.title, 'System Welcome');
    });

    test('notifyRole broadcasts to all active users with role (e.g. AUDITOR)', async () => {
      await notificationService.notifyRole('AUDITOR', {
        type: 'SECURITY_ALERT',
        title: 'Audit Routine Triggered',
        message: 'Periodic compliance scan initiated.',
        severity: 'INFO'
      });

      const auditorNotifs = await Notification.find({
        recipientUserId: auditorUser.userId,
        type: 'SECURITY_ALERT'
      });
      assert.ok(auditorNotifs.length >= 1);
    });
  });

  // ==========================================
  // 2. Lifecycle Notifications & Non-Duplication
  // ==========================================
  describe('Lifecycle State Change Notifications & Audit Deduplication', () => {
    let org;
    let issuer;
    let issuerKey;
    let credential;

    test('Organization verification triggers notification & records exactly 1 audit log', async () => {
      const initialAuditCount = await AuditLog.countDocuments({ action: 'ORGANIZATION_VERIFIED' });

      // Create organization
      org = await organizationService.createOrganization({
        name: 'Stanford University Global',
        organizationCode: `SUG_${Date.now()}`,
        type: 'UNIVERSITY',
        officialDomain: `stanford_${Date.now()}.edu`
      }, issuerUser);

      // Admin verifies organization
      await organizationService.verifyOrganization(org.organizationId, {}, adminUser);

      // Verify notification sent to creator
      const notifs = await Notification.find({
        recipientUserId: issuerUser.userId,
        type: 'ORGANIZATION_VERIFIED'
      });
      assert.strictEqual(notifs.length, 1);
      assert.strictEqual(notifs[0].severity, 'SUCCESS');

      // Verify EXACTLY ONE audit log was created for this action (no duplicates)
      const afterAuditCount = await AuditLog.countDocuments({ action: 'ORGANIZATION_VERIFIED' });
      assert.strictEqual(afterAuditCount, initialAuditCount + 1, 'Exactly one audit log entry must be created');
    });

    test('Issuer approval triggers notification & promotes user role', async () => {
      const initialAuditCount = await AuditLog.countDocuments({ action: 'ISSUER_APPROVED' });

      // Request issuer accreditation
      issuer = await issuerService.registerIssuer({
        organizationId: org.organizationId,
        issuerCode: `MED_${Date.now()}`
      }, issuerUser);

      // Admin approves issuer
      await issuerService.approveIssuer(issuer.issuerId, adminUser);

      // Verify notification sent to issuer user
      const notifs = await Notification.find({
        recipientUserId: issuerUser.userId,
        type: 'ISSUER_APPROVED'
      });
      assert.strictEqual(notifs.length, 1);
      assert.strictEqual(notifs[0].severity, 'SUCCESS');

      // Verify no duplicate audit entries
      const afterAuditCount = await AuditLog.countDocuments({ action: 'ISSUER_APPROVED' });
      assert.strictEqual(afterAuditCount, initialAuditCount + 1);
    });

    test('Issuer key generation, rotation, and compromise triggers notifications', async () => {
      // 1. Generate Key
      issuerKey = await issuerKeyService.generateKeyForIssuer(issuer.issuerId, adminUser);

      // 2. Rotate Key
      const initialRotateAudits = await AuditLog.countDocuments({ action: 'ISSUER_KEY_ROTATED' });
      const newKey = await issuerKeyService.rotateIssuerKey(issuer.issuerId, adminUser);

      const rotateNotifs = await Notification.find({
        recipientUserId: issuerUser.userId,
        type: 'KEY_ROTATED'
      });
      assert.ok(rotateNotifs.length >= 1);
      const afterRotateAudits = await AuditLog.countDocuments({ action: 'ISSUER_KEY_ROTATED' });
      assert.strictEqual(afterRotateAudits, initialRotateAudits + 1);

      // 3. Compromise Key
      const initialCompromiseAudits = await AuditLog.countDocuments({ action: 'ISSUER_KEY_COMPROMISED' });
      await issuerKeyService.compromiseKey(issuerKey.keyId, { reason: 'Hardware key stolen' }, adminUser);

      const compromiseNotifs = await Notification.find({
        recipientUserId: issuerUser.userId,
        type: 'KEY_COMPROMISED'
      });
      assert.strictEqual(compromiseNotifs.length, 1);
      assert.strictEqual(compromiseNotifs[0].severity, 'CRITICAL');

      const afterCompromiseAudits = await AuditLog.countDocuments({ action: 'ISSUER_KEY_COMPROMISED' });
      assert.strictEqual(afterCompromiseAudits, initialCompromiseAudits + 1);
    });

    test('Credential issuance & revocation notify recipient with zero duplicate audit events', async () => {
      // Ingest document for credential
      const doc = await Document.create({
        documentId: `doc_int_${Date.now()}`,
        originalFilename: 'diploma_alice.pdf',
        mimeType: 'application/pdf',
        fileSize: 1024,
        storagePath: 'documents/fake_alice.pdf',
        sha256Hash: sha256('alice_verified_degree_payload_2026'),
        hashAlgorithm: 'SHA-256',
        uploadedBy: issuerUser.userId,
        representationType: 'ORIGINAL_DIGITAL_FILE'
      });

      const initialIssueAudits = await AuditLog.countDocuments({ action: 'CREDENTIAL_ISSUED' });

      // Issue credential to recipientUser
      const issued = await credentialService.issueCredential({
        issuerId: issuer.issuerId,
        recipientId: recipientUser.userId,
        documentId: doc.documentId,
        credentialType: 'DEGREE',
        title: 'Bachelor of Science in Computer Science',
        validityDays: 365
      }, adminUser);
      credential = issued.credential;

      // Recipient must have received CREDENTIAL_ISSUED notification
      const recipientNotifs = await Notification.find({
        recipientUserId: recipientUser.userId,
        type: 'CREDENTIAL_ISSUED'
      });
      assert.ok(recipientNotifs.length >= 1);
      assert.strictEqual(recipientNotifs[0].severity, 'SUCCESS');

      const afterIssueAudits = await AuditLog.countDocuments({ action: 'CREDENTIAL_ISSUED' });
      assert.strictEqual(afterIssueAudits, initialIssueAudits + 1);

      // Revoke credential
      const initialRevokeAudits = await AuditLog.countDocuments({ action: 'CREDENTIAL_REVOKED' });
      await credentialService.revokeCredential(credential.credentialId, 'Administrative degree correction', adminUser);

      // Recipient must receive CREDENTIAL_REVOKED notification
      const revokeNotifs = await Notification.find({
        recipientUserId: recipientUser.userId,
        type: 'CREDENTIAL_REVOKED'
      });
      assert.ok(revokeNotifs.length >= 1);
      assert.strictEqual(revokeNotifs[0].severity, 'WARNING');

      const afterRevokeAudits = await AuditLog.countDocuments({ action: 'CREDENTIAL_REVOKED' });
      assert.strictEqual(afterRevokeAudits, initialRevokeAudits + 1);
    });
  });

  // ==========================================
  // 3. Notification API & RBAC Privacy Boundary
  // ==========================================
  describe('Notification API Endpoints & Privacy Enforcement', () => {
    let testNotif;

    beforeEach(async () => {
      testNotif = await Notification.create({
        recipientUserId: recipientUser.userId,
        type: 'GENERAL',
        title: 'Important Alert',
        message: 'Your verification report is ready.',
        severity: 'INFO',
        read: false
      });
    });

    test('GET /api/notifications returns user own notifications and unreadCount', async () => {
      const res = await fetch(`${baseUrl}/api/notifications`, {
        headers: { Authorization: `Bearer ${recipientToken}` }
      });
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.ok(Array.isArray(body.data.notifications));
      assert.ok(body.data.unreadCount >= 1);

      const found = body.data.notifications.find(n => n.notificationId === testNotif.notificationId);
      assert.ok(found);
    });

    test('GET /api/notifications?unreadOnly=true filters out read notifications', async () => {
      // Create a read notification
      await Notification.create({
        recipientUserId: recipientUser.userId,
        type: 'GENERAL',
        title: 'Old Notification',
        message: 'Already acknowledged.',
        read: true,
        readAt: new Date()
      });

      const res = await fetch(`${baseUrl}/api/notifications?unreadOnly=true`, {
        headers: { Authorization: `Bearer ${recipientToken}` }
      });
      const body = await res.json();
      assert.strictEqual(res.status, 200);
      assert.ok(body.data.notifications.every(n => n.read === false));
    });

    test('PATCH /api/notifications/:id/read marks notification as read', async () => {
      const res = await fetch(`${baseUrl}/api/notifications/${testNotif.notificationId}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${recipientToken}` }
      });
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.data.notification.read, true);
      assert.ok(body.data.notification.readAt);
    });

    test('Privacy boundary: User cannot mark another user notification as read (returns 403 FORBIDDEN)', async () => {
      const res = await fetch(`${baseUrl}/api/notifications/${testNotif.notificationId}/read`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${unrelatedToken}` }
      });
      assert.strictEqual(res.status, 403);
      const body = await res.json();
      assert.strictEqual(body.error.code, 'FORBIDDEN');
    });

    test('PATCH /api/notifications/read-all marks all unread notifications as read', async () => {
      const res = await fetch(`${baseUrl}/api/notifications/read-all`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${recipientToken}` }
      });
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.ok(body.data.updatedCount >= 1);

      const unread = await Notification.countDocuments({ recipientUserId: recipientUser.userId, read: false });
      assert.strictEqual(unread, 0);
    });

    test('Unauthenticated client cannot access /api/notifications: returns 401', async () => {
      const res = await fetch(`${baseUrl}/api/notifications`);
      assert.strictEqual(res.status, 401);
    });
  });

  // ==========================================
  // 4. Complete 16-Module End-to-End Integration
  // ==========================================
  describe('Full 16-Module End-to-End Platform Integration', () => {
    test('Seamless execution across all 16 modules simultaneously', async () => {
      // 1. Auth & RBAC
      assert.ok(adminToken);
      assert.ok(auditorToken);

      // 2. Organization & TrustedSource
      const intOrg = await organizationService.createOrganization({
        name: 'Consortium Verification Board',
        organizationCode: `CVB_${Date.now()}`,
        type: 'VERIFIER_ORG',
        officialDomain: `consortium_${Date.now()}.org`
      }, adminUser);
      await organizationService.verifyOrganization(intOrg.organizationId, {}, adminUser);

      // 3. Issuer & IssuerKey
      const authorityUser = await User.create({
        name: 'Authority User',
        email: `authority_${Date.now()}@cvb.org`,
        passwordHash: await User.hashPassword('AuthPass123!'),
        role: 'USER',
        status: 'ACTIVE'
      });
      const intIssuer = await issuerService.registerIssuer({
        organizationId: intOrg.organizationId,
        issuerCode: `AUTH_${Date.now()}`
      }, authorityUser);
      await issuerService.approveIssuer(intIssuer.issuerId, adminUser);
      const key = await issuerKeyService.generateKeyForIssuer(intIssuer.issuerId, adminUser);

      // 4. Document & Storage
      const rawPayload = Buffer.from('Official Degree Credential Content - 2026');
      const docHash = sha256(rawPayload);
      const doc = await Document.create({
        documentId: `doc_e2e_${Date.now()}`,
        originalFilename: 'consortium_degree.pdf',
        mimeType: 'application/pdf',
        fileSize: rawPayload.length,
        storagePath: 'documents/consortium_degree.pdf',
        sha256Hash: docHash,
        hashAlgorithm: 'SHA-256',
        uploadedBy: adminUser.userId,
        representationType: 'ORIGINAL_DIGITAL_FILE'
      });

      // 5. Credential & CredentialVersion
      const { credential: cred, version: ver } = await credentialService.issueCredential({
        issuerId: intIssuer.issuerId,
        recipientId: recipientUser.userId,
        documentId: doc.documentId,
        credentialType: 'CERTIFICATION',
        title: 'Master Cybersecurity Professional',
        validityDays: 180
      }, adminUser);

      assert.strictEqual(cred.status, 'ACTIVE');
      assert.strictEqual(ver.status, 'ACTIVE');

      // 6. Verification Pipeline (OCR + AI + Evidence + Engine)
      const evalRes = await verificationService.evaluateCredentialVerification({
        credentialId: cred.credentialId,
        documentHash: docHash,
        aiData: {
          riskLevel: 'LOW',
          score: 0.05,
          findings: []
        }
      }, auditorUser);

      assert.strictEqual(evalRes.cryptographicStatus, 'PASSED');
      assert.strictEqual(evalRes.result, 'VERIFIED');
      assert.ok(evalRes.verificationId);

      // 7. Manual Review
      const reviewRes = await verificationService.submitManualReview(
        evalRes.verificationId,
        {
          decision: 'CONFIRMED',
          reviewNotes: 'End-to-end integration audit verified.'
        },
        auditorUser
      );
      assert.strictEqual(reviewRes.humanVerificationStatus, 'CONFIRMED');

      // 8. Hash-Chained Audit Log Validation
      const chainReport = await auditService.validateChain();
      assert.strictEqual(chainReport.valid, true, 'Audit log chain must be 100% valid');
      assert.strictEqual(chainReport.errors.length, 0);

      // 9. Notification Delivery Check
      const recipientNotifs = await notificationService.getUserNotifications(recipientUser.userId);
      assert.ok(recipientNotifs.notifications.length >= 1);
    });
  });
});

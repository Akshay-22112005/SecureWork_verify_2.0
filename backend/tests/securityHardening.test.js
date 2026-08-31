const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const jwt = require('jsonwebtoken');
const app = require('../src/app');
const env = require('../src/config/env');
const { connectDB, disconnectDB } = require('../src/config/db');
const { generateToken, verifyToken } = require('../src/utils/jwt');
const { isPrivateOrBlockedIp, validateUrlForSsrf } = require('../src/utils/ssrfProtection');
const { validateFileCharacteristics, sanitizeFilename, detectMagicBytes, isExecutable } = require('../src/utils/fileValidator');
const { canonicalizeJson, sha256, generateEd25519KeyPair, signEd25519, verifyEd25519, timingSafeCompare } = require('../src/utils/crypto');
const { sanitizeData } = require('../src/utils/logger');
const { User, Organization, Credential, CredentialVersion, Issuer, IssuerKey, Document } = require('../src/models');
const { evaluateVerification } = require('../src/services/verification/verificationEngine');
const LocalStorageAdapter = require('../src/services/storage/localStorage.adapter');

describe('Phase 15 — Security Hardening Test Suite', () => {
  let server;
  let baseUrl;

  before(async () => {
    await connectDB();
    server = http.createServer(app);
    await new Promise(resolve => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;
  });

  after(async () => {
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
    await disconnectDB();
  });

  // =========================================================================
  // 1. Authentication & JWT Security Tests
  // =========================================================================
  describe('1. Authentication & JWT Security Hardening', () => {
    test('rejects JWT signed with "none" algorithm (algorithm confusion attack)', () => {
      const user = { userId: 'usr_sec_test', role: 'USER', email: 'test@sec.local' };
      // Forge a token using "none" algorithm
      const noneToken = jwt.sign(user, '', { algorithm: 'none' });

      assert.throws(() => {
        verifyToken(noneToken);
      }, (err) => {
        return err.name === 'JsonWebTokenError';
      });
    });

    test('rejects JWT signed with an invalid/mismatched secret', () => {
      const forgedToken = jwt.sign(
        { userId: 'usr_sec_test', role: 'ADMIN' },
        'wrong_attacker_secret_key_1234567890',
        { algorithm: 'HS256' }
      );

      assert.throws(() => {
        verifyToken(forgedToken);
      }, (err) => {
        return err.name === 'JsonWebTokenError';
      });
    });

    test('rejects expired JWT token with TOKEN_EXPIRED behavior', async () => {
      const expiredToken = jwt.sign(
        { userId: 'usr_sec_test', role: 'USER' },
        env.JWT_SECRET,
        { algorithm: 'HS256', expiresIn: '-1s' }
      );

      assert.throws(() => {
        verifyToken(expiredToken);
      }, (err) => {
        return err.name === 'TokenExpiredError';
      });

      // API request using expired token must return 401 TOKEN_EXPIRED
      const res = await fetch(`${baseUrl}/api/users/me`, {
        headers: { Authorization: `Bearer ${expiredToken}` }
      });
      assert.strictEqual(res.status, 401);
      const data = await res.json();
      assert.strictEqual(data.error.code, 'TOKEN_EXPIRED');
    });

    test('verifies valid token succeeds and extracts minimal claims', () => {
      const user = { userId: 'usr_sec_valid', role: 'AUDITOR', email: 'auditor@sec.local' };
      const token = generateToken(user);
      const decoded = verifyToken(token);

      assert.strictEqual(decoded.userId, 'usr_sec_valid');
      assert.strictEqual(decoded.role, 'AUDITOR');
      assert.strictEqual(decoded.email, 'auditor@sec.local');
    });
  });

  // =========================================================================
  // 2. RBAC & Password Storage Security Tests
  // =========================================================================
  describe('2. RBAC & Password Storage Security', () => {
    test('public registration strictly forces role "USER" and rejects privilege escalation payload', async () => {
      const testEmail = `sec_reg_${Date.now()}@securework.local`;
      const res = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Attacker Trying Admin',
          email: testEmail,
          password: 'Password123!',
          role: 'ADMIN' // Malicious attempt to escalate role
        })
      });

      assert.strictEqual(res.status, 201);
      const data = await res.json();
      assert.strictEqual(data.data.user.role, 'USER', 'Registration must enforce role USER regardless of client payload');

      // Verify in MongoDB directly
      const userInDb = await User.findOne({ email: testEmail });
      assert.strictEqual(userInDb.role, 'USER');
    });

    test('user profile update (PATCH /api/users/me) strictly ignores attempts to alter role or status', async () => {
      const testEmail = `sec_esc_${Date.now()}@securework.local`;
      const regRes = await fetch(`${baseUrl}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'Regular Worker',
          email: testEmail,
          password: 'Password123!'
        })
      });
      const regData = await regRes.json();
      const token = regData.data.token;

      // Attempt to patch role to ADMIN
      const patchRes = await fetch(`${baseUrl}/api/users/me`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: 'Updated Name',
          role: 'ADMIN',
          status: 'SUSPENDED'
        })
      });

      assert.strictEqual(patchRes.status, 200);
      const patchData = await patchRes.json();
      assert.strictEqual(patchData.data.user.name, 'Updated Name');
      assert.strictEqual(patchData.data.user.role, 'USER', 'Role must not be modifiable via updateMe');

      const dbUser = await User.findOne({ email: testEmail });
      assert.strictEqual(dbUser.role, 'USER');
      assert.strictEqual(dbUser.status, 'ACTIVE');
    });

    test('passwordHash is never exposed in user queries or toJSON serialization', async () => {
      const user = await User.findOne();
      assert.ok(user);

      // 1. Default Mongoose query has select: false for passwordHash
      assert.strictEqual(user.passwordHash, undefined, 'passwordHash must be omitted by default query');

      // 2. toJSON transform strips it
      const json = user.toJSON();
      assert.strictEqual(json.passwordHash, undefined, 'toJSON must never include passwordHash');
      assert.strictEqual(JSON.stringify(json).includes('passwordHash'), false);
    });
  });

  // =========================================================================
  // 3. File Uploads, Magic Bytes & Path Traversal Security Tests
  // =========================================================================
  describe('3. File Uploads, Magic Bytes & Path Traversal', () => {
    test('blocks executable binaries: Windows PE (MZ) and Linux ELF', () => {
      const peBuffer = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]); // MZ header
      const elfBuffer = Buffer.from([0x7f, 0x45, 0x4c, 0x46, 0x02, 0x01, 0x01, 0x00]); // ELF header
      const shebangBuffer = Buffer.from('#!/bin/bash\nrm -rf /');

      assert.strictEqual(isExecutable(peBuffer), true);
      assert.strictEqual(isExecutable(elfBuffer), true);
      assert.strictEqual(isExecutable(shebangBuffer), true);

      assert.throws(() => {
        validateFileCharacteristics(peBuffer, 'application/pdf', 'malware.pdf');
      }, (err) => err.code === 'EXECUTABLE_PROHIBITED');
    });

    test('blocks disguised/spoofed files: non-PDF disguised as .pdf', () => {
      const fakePdfBuffer = Buffer.from('Just plain text pretending to be a PDF');
      assert.throws(() => {
        validateFileCharacteristics(fakePdfBuffer, 'application/pdf', 'fake.pdf');
      }, (err) => err.code === 'UNSUPPORTED_FILE_TYPE');
    });

    test('validates authentic PDF magic bytes (%PDF)', () => {
      const validPdfBuffer = Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF');
      const result = validateFileCharacteristics(validPdfBuffer, 'application/pdf', 'document.pdf');
      assert.strictEqual(result.detectedMimeType, 'application/pdf');
      assert.strictEqual(result.sanitizedFilename, 'document.pdf');
    });

    test('sanitizes filename against path traversal attempts', () => {
      assert.strictEqual(sanitizeFilename('../../../etc/passwd'), 'passwd');
      assert.strictEqual(sanitizeFilename('..\\..\\windows\\system32\\cmd.exe'), 'cmd.exe');
      assert.strictEqual(sanitizeFilename('payload;rm -rf.pdf'), 'payload_rm_-rf.pdf');
    });

    test('LocalStorageAdapter strictly blocks directory traversal on resolvePath', () => {
      const adapter = new LocalStorageAdapter();
      assert.throws(() => {
        adapter.resolvePath('../../secret.key');
      }, (err) => err.code === 'PATH_TRAVERSAL_PROHIBITED');

      assert.throws(() => {
        adapter.resolvePath('..\\..\\secret.key');
      }, (err) => err.code === 'PATH_TRAVERSAL_PROHIBITED');
    });

    test('rejects files exceeding MAX_FILE_SIZE_BYTES (10 MB)', () => {
      const oversized = Buffer.alloc(10 * 1024 * 1024 + 1); // 10MB + 1 byte
      assert.throws(() => {
        validateFileCharacteristics(oversized, 'application/pdf', 'large.pdf');
      }, (err) => err.code === 'FILE_TOO_LARGE');
    });
  });

  // =========================================================================
  // 4. SSRF, DNS Resolution & Cloud Metadata Protection Tests
  // =========================================================================
  describe('4. SSRF, DNS Resolution & Private IP Blocking', () => {
    test('blocks loopback IPs (127.0.0.1, ::1, 0.0.0.0)', () => {
      assert.strictEqual(isPrivateOrBlockedIp('127.0.0.1'), true);
      assert.strictEqual(isPrivateOrBlockedIp('127.0.1.1'), true);
      assert.strictEqual(isPrivateOrBlockedIp('::1'), true);
      assert.strictEqual(isPrivateOrBlockedIp('0.0.0.0'), true);
      assert.strictEqual(isPrivateOrBlockedIp('::ffff:127.0.0.1'), true);
    });

    test('blocks private RFC 1918 networks (10.x, 172.16-31.x, 192.168.x)', () => {
      assert.strictEqual(isPrivateOrBlockedIp('10.0.0.1'), true);
      assert.strictEqual(isPrivateOrBlockedIp('10.254.0.1'), true);
      assert.strictEqual(isPrivateOrBlockedIp('172.16.0.1'), true);
      assert.strictEqual(isPrivateOrBlockedIp('172.31.255.254'), true);
      assert.strictEqual(isPrivateOrBlockedIp('192.168.1.1'), true);
      assert.strictEqual(isPrivateOrBlockedIp('192.168.0.100'), true);
    });

    test('blocks cloud metadata IP (169.254.169.254) and link-local', () => {
      assert.strictEqual(isPrivateOrBlockedIp('169.254.169.254'), true);
      assert.strictEqual(isPrivateOrBlockedIp('169.254.1.1'), true);
    });

    test('blocks Carrier-Grade NAT (RFC 6598: 100.64.0.0/10) and Benchmark testing (198.18.0.0/15)', () => {
      assert.strictEqual(isPrivateOrBlockedIp('100.64.0.1'), true);
      assert.strictEqual(isPrivateOrBlockedIp('100.127.255.254'), true);
      assert.strictEqual(isPrivateOrBlockedIp('198.18.0.1'), true);
      assert.strictEqual(isPrivateOrBlockedIp('198.19.255.254'), true);
    });

    test('allows legitimate public routable IPs', () => {
      assert.strictEqual(isPrivateOrBlockedIp('8.8.8.8'), false);
      assert.strictEqual(isPrivateOrBlockedIp('1.1.1.1'), false);
      assert.strictEqual(isPrivateOrBlockedIp('104.244.42.1'), false);
    });

    test('validateUrlForSsrf enforces HTTPS-only and blocks non-HTTPS schemes', async () => {
      await assert.rejects(async () => {
        await validateUrlForSsrf('http://example.com/api', 'example.com');
      }, (err) => err.code === 'SSRF_HTTPS_REQUIRED');

      await assert.rejects(async () => {
        await validateUrlForSsrf('ftp://example.com/api', 'example.com');
      }, (err) => err.code === 'SSRF_HTTPS_REQUIRED');

      await assert.rejects(async () => {
        await validateUrlForSsrf('file:///etc/passwd', 'example.com');
      }, (err) => err.code === 'SSRF_HTTPS_REQUIRED');
    });

    test('validateUrlForSsrf blocks unauthorized domain mismatches', async () => {
      await assert.rejects(async () => {
        await validateUrlForSsrf('https://evil-hacker.com/verify', 'official-registry.gov');
      }, (err) => err.code === 'SSRF_DOMAIN_UNTRUSTED');
    });
  });

  // =========================================================================
  // 5. Request Limits, Rate Limiting & Timeouts
  // =========================================================================
  describe('5. Request Limits & Rate Limiting', () => {
    test('rate limiter returns standard RateLimit headers and enforces HTTP 429 when exceeded', async () => {
      // Send multiple requests with x-test-rate-limit header to trigger rate limiting
      const results = [];
      for (let i = 0; i < 105; i++) {
        const res = await fetch(`${baseUrl}/api/auth/me`, {
          headers: {
            'x-test-rate-limit': 'true',
            'X-Forwarded-For': '198.51.100.42'
          }
        });
        results.push(res);
      }

      // Check the final request
      const lastRes = results[results.length - 1];
      assert.strictEqual(lastRes.status, 429, 'Excessive requests must return HTTP 429');

      assert.ok(lastRes.headers.get('RateLimit-Limit'), 'RateLimit-Limit header must be present');
      assert.ok(lastRes.headers.get('RateLimit-Remaining'), 'RateLimit-Remaining header must be present');
      assert.ok(lastRes.headers.get('Retry-After'), 'Retry-After header must be present on 429');

      const body = await lastRes.json();
      assert.strictEqual(body.error.code, 'RATE_LIMIT_EXCEEDED');
    });
  });

  // =========================================================================
  // 6. Cryptographic Security & Offline Verification
  // =========================================================================
  describe('6. Cryptographic Security & Canonicalization', () => {
    test('JCS canonicalizeJson produces deterministic serialization regardless of key ordering', () => {
      const obj1 = { z: 1, a: 'test', m: { b: 2, a: 1 } };
      const obj2 = { a: 'test', m: { a: 1, b: 2 }, z: 1 };

      const canon1 = canonicalizeJson(obj1);
      const canon2 = canonicalizeJson(obj2);

      assert.strictEqual(canon1, canon2);
      assert.strictEqual(sha256(obj1), sha256(obj2));
    });

    test('Ed25519 asymmetric signature generation and verification', () => {
      const { publicKeyPem, privateKeyPem } = generateEd25519KeyPair();
      const payload = { credentialId: 'crd_sec_100', subject: 'John Doe', issuedAt: '2026-08-31T00:00:00.000Z' };

      const signature = signEd25519(payload, privateKeyPem);
      assert.ok(signature && signature.length > 0);

      // Verify authentic signature
      const isValid = verifyEd25519(payload, signature, publicKeyPem);
      assert.strictEqual(isValid, true);

      // Tampered payload must fail
      const tamperedPayload = { ...payload, subject: 'Attacker Altered Name' };
      const isTamperedValid = verifyEd25519(tamperedPayload, signature, publicKeyPem);
      assert.strictEqual(isTamperedValid, false);
    });

    test('timingSafeCompare protects hash comparisons against timing attacks', () => {
      const hash1 = sha256('authentic_content');
      const hash2 = sha256('authentic_content');
      const hash3 = sha256('different_content');

      assert.strictEqual(timingSafeCompare(hash1, hash2), true);
      assert.strictEqual(timingSafeCompare(hash1, hash3), false);
      assert.strictEqual(timingSafeCompare(hash1, 'invalid_length'), false);
    });
  });

  // =========================================================================
  // 7. AI/OCR Security Boundaries
  // =========================================================================
  describe('7. AI/OCR Security Boundaries & Non-Override Guarantees', () => {
    let aiTestCred;
    let aiTestVersion;
    let aiTestKey;
    let aiTestIssuer;
    let docHash;

    before(async () => {
      const { publicKeyPem, privateKeyPem } = generateEd25519KeyPair();
      const keyId = `key_ai_${Date.now()}`;
      const issuerId = `iss_ai_${Date.now()}`;
      const credId = `crd_ai_${Date.now()}`;
      docHash = sha256('ai_hardening_doc_bytes');

      const orgId = `org_ai_${Date.now()}`;
      const docId = `doc_ai_${Date.now()}`;

      await Organization.create({
        organizationId: orgId,
        organizationCode: `ORG_${Date.now()}`,
        name: 'AI Test University',
        type: 'UNIVERSITY',
        officialDomain: 'aitest.local',
        organizationVerificationStatus: 'VERIFIED',
        status: 'ACTIVE',
        createdBy: 'usr_admin'
      });

      await Document.create({
        documentId: docId,
        originalFilename: 'test_doc.pdf',
        mimeType: 'application/pdf',
        fileSize: 1024,
        storagePath: 'test_doc.pdf',
        sha256Hash: docHash,
        uploadedBy: 'usr_admin',
        representationType: 'ORIGINAL_DIGITAL_FILE'
      });

      aiTestIssuer = await Issuer.create({
        issuerId,
        issuerCode: `CODE_${Date.now()}`,
        name: 'AI Test Issuer',
        userId: `usr_issuer_${Date.now()}`,
        organizationId: orgId,
        status: 'ACTIVE'
      });

      const credentialService = require('../src/services/credential.service');
      const user = await User.create({
        name: 'AI Subject',
        email: `sub_${Date.now()}@aitest.local`,
        passwordHash: 'dummy',
        role: 'USER',
        status: 'ACTIVE'
      });

      const keyStorageAdapter = require('../src/services/crypto');
      await keyStorageAdapter.keyStorage.storePrivateKey(keyId, privateKeyPem);

      aiTestKey = await IssuerKey.create({
        issuerId,
        keyId,
        algorithm: 'ED25519',
        publicKey: publicKeyPem,
        privateKeyReference: `local:${keyId}`,
        status: 'ACTIVE'
      });

      const issued = await credentialService.issueCredential({
        issuerId,
        recipientId: user.userId,
        documentId: docId,
        credentialType: 'DEGREE'
      }, { userId: 'usr_admin', role: 'ADMIN' });

      aiTestCred = issued.credential;
      aiTestVersion = await CredentialVersion.findOne({ credentialId: aiTestCred.credentialId });
    });

    test('Rule: AI clean / low-risk analysis CANNOT override a failed cryptographic signature', async () => {
      const originalSig = aiTestVersion.signature;
      // Corrupt signature
      aiTestVersion.signature = Buffer.alloc(64, 0x11).toString('base64');
      await aiTestVersion.save();

      const verificationService = require('../src/services/verification.service');
      const result = await verificationService.evaluateCredentialVerification({
        credentialId: aiTestCred.credentialId,
        documentHash: docHash,
        aiData: {
          riskLevel: 'LOW',
          score: 0.01,
          tamperingDetected: false,
          findings: []
        }
      });

      assert.strictEqual(result.result, 'SIGNATURE_INVALID');
      assert.strictEqual(result.cryptographicStatus, 'FAILED');
      assert.notStrictEqual(result.result, 'VERIFIED');

      // Restore signature
      aiTestVersion.signature = originalSig;
      await aiTestVersion.save();
    });

    test('Rule: Unavailable AI/OCR status does not break core verification pipeline', async () => {
      const verificationService = require('../src/services/verification.service');
      const result = await verificationService.evaluateCredentialVerification({
        credentialId: aiTestCred.credentialId,
        documentHash: docHash
      });

      assert.ok(result);
      assert.strictEqual(result.result, 'VERIFIED');
      assert.strictEqual(result.cryptographicStatus, 'PASSED');
    });
  });

  // =========================================================================
  // 8. Sensitive Data & Log Sanitization
  // =========================================================================
  describe('8. Sensitive Data & Log Redaction', () => {
    test('sanitizeData redacts passwords, tokens, API keys, and private keys', () => {
      const data = {
        name: 'Safe',
        password: 'PlainTextPassword',
        token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        privateKey: '-----BEGIN PRIVATE KEY-----\nMIIEvgIB...',
        nested: {
          apiKey: 'key_secret_123'
        }
      };

      const sanitized = sanitizeData(data);
      assert.strictEqual(sanitized.password, '[REDACTED]');
      assert.strictEqual(sanitized.token, '[REDACTED]');
      assert.strictEqual(sanitized.privateKey, '[REDACTED]');
      assert.strictEqual(sanitized.nested.apiKey, '[REDACTED]');
      assert.strictEqual(sanitized.name, 'Safe');
    });
  });
});

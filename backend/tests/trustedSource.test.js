const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const app = require('../src/app');
const { connectDB, disconnectDB } = require('../src/config/db');
const User = require('../src/models/user.model');
const Organization = require('../src/models/organization.model');
const TrustedSource = require('../src/models/trustedSource.model');
const trustedSourceService = require('../src/services/trustedSource.service');
const { localAdapter, setSourceAdapter, getSourceAdapter } = require('../src/services/sources');
const { isPrivateOrBlockedIp, validateUrlForSsrf, safeFetch } = require('../src/utils/ssrfProtection');
const { generateToken } = require('../src/utils/jwt');
const { sha256 } = require('../src/utils/crypto');

describe('Phase 8 Trusted Source & SSRF Protection Tests', () => {
  let server;
  let baseUrl;
  let adminUser;
  let regularUser;
  let adminToken;
  let userToken;
  let testOrg;

  before(async () => {
    await connectDB();

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;

    // 1. Create test users
    adminUser = await User.create({
      name: 'Phase 8 Admin',
      email: `p8_admin_${Date.now()}@securework.local`,
      passwordHash: await User.hashPassword('AdminPass123!'),
      role: 'ADMIN',
      status: 'ACTIVE'
    });
    adminToken = generateToken(adminUser);

    regularUser = await User.create({
      name: 'Phase 8 User',
      email: `p8_user_${Date.now()}@securework.local`,
      passwordHash: await User.hashPassword('UserPass123!'),
      role: 'USER',
      status: 'ACTIVE'
    });
    userToken = generateToken(regularUser);

    // 2. Create parent Organization
    testOrg = await Organization.create({
      organizationId: `org_p8_${Date.now()}`,
      organizationCode: `ORG_P8_${Date.now()}`,
      name: 'State Licensing Board of Engineering',
      type: 'GOVERNMENT',
      officialDomain: 'licensing.state.gov',
      organizationVerificationStatus: 'VERIFIED',
      status: 'ACTIVE',
      createdBy: adminUser.userId
    });

    // Enforce local adapter
    setSourceAdapter(localAdapter);
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
  // 1. Trusted Source Lifecycle
  // ==========================================
  describe('Trusted Source Lifecycle Governance', () => {
    let sourceId;
    const sourceCode = `SRC_ENG_BOARD_${Date.now()}`;

    test('POST /api/trusted-sources: registers a source in PENDING state', async () => {
      const res = await fetch(`${baseUrl}/api/trusted-sources`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({
          sourceCode,
          organizationId: testOrg.organizationId,
          name: 'Official State Engineering Registry',
          sourceType: 'API',
          baseUrl: 'https://registry.licensing.state.gov/api/v1',
          verificationEndpoint: '/verify'
        })
      });

      assert.strictEqual(res.status, 201);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.trustedSource.sourceCode, sourceCode);
      assert.strictEqual(body.data.trustedSource.status, 'PENDING');
      assert.strictEqual(body.data.trustedSource.verificationStatus, 'PENDING');
      assert.strictEqual(body.data.trustedSource.domain, 'registry.licensing.state.gov');
      sourceId = body.data.trustedSource.sourceCode;
    });

    test('Non-admin cannot approve trusted source', async () => {
      const res = await fetch(`${baseUrl}/api/trusted-sources/${sourceId}/approve`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${userToken}`
        }
      });

      assert.strictEqual(res.status, 403);
    });

    test('Admin approves trusted source: transitions to ACTIVE and VERIFIED', async () => {
      const res = await fetch(`${baseUrl}/api/trusted-sources/${sourceId}/approve`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        }
      });

      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.data.trustedSource.status, 'ACTIVE');
      assert.strictEqual(body.data.trustedSource.verificationStatus, 'VERIFIED');
      assert.strictEqual(body.data.trustedSource.verifiedBy, adminUser.userId);
    });

    test('Admin suspends trusted source', async () => {
      const res = await fetch(`${baseUrl}/api/trusted-sources/${sourceId}/suspend`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({ reason: 'Scheduled registry audit' })
      });

      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.data.trustedSource.status, 'SUSPENDED');
    });

    test('Admin revokes trusted source', async () => {
      const res = await fetch(`${baseUrl}/api/trusted-sources/${sourceId}/revoke`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({ reason: 'Permanent registry decommission' })
      });

      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.data.trustedSource.status, 'REVOKED');
      assert.strictEqual(body.data.trustedSource.verificationStatus, 'FAILED');
    });
  });

  // ==========================================
  // 2. SSRF Protection Evaluators
  // ==========================================
  describe('Defense-in-Depth SSRF Protection', () => {
    test('Private IP addresses are identified and blocked', () => {
      // Loopback
      assert.strictEqual(isPrivateOrBlockedIp('127.0.0.1'), true);
      assert.strictEqual(isPrivateOrBlockedIp('127.100.0.5'), true);
      assert.strictEqual(isPrivateOrBlockedIp('::1'), true);
      assert.strictEqual(isPrivateOrBlockedIp('0:0:0:0:0:0:0:1'), true);

      // Current network
      assert.strictEqual(isPrivateOrBlockedIp('0.0.0.0'), true);

      // RFC 1918 Private subnets
      assert.strictEqual(isPrivateOrBlockedIp('10.0.0.1'), true);
      assert.strictEqual(isPrivateOrBlockedIp('10.254.1.1'), true);
      assert.strictEqual(isPrivateOrBlockedIp('172.16.0.1'), true);
      assert.strictEqual(isPrivateOrBlockedIp('172.31.255.255'), true);
      assert.strictEqual(isPrivateOrBlockedIp('192.168.0.1'), true);
      assert.strictEqual(isPrivateOrBlockedIp('192.168.100.50'), true);

      // Link-local & Cloud Metadata
      assert.strictEqual(isPrivateOrBlockedIp('169.254.169.254'), true);
      assert.strictEqual(isPrivateOrBlockedIp('169.254.1.1'), true);

      // Public IP addresses should NOT be blocked
      assert.strictEqual(isPrivateOrBlockedIp('8.8.8.8'), false);
      assert.strictEqual(isPrivateOrBlockedIp('1.1.1.1'), false);
      assert.strictEqual(isPrivateOrBlockedIp('93.184.216.34'), false);
    });

    test('HTTPS-only enforcement: rejects plain http and file protocols', async () => {
      await assert.rejects(
        async () => {
          await validateUrlForSsrf('http://example.com/api', 'example.com');
        },
        (err) => {
          assert.strictEqual(err.code, 'SSRF_HTTPS_REQUIRED');
          return true;
        }
      );

      await assert.rejects(
        async () => {
          await validateUrlForSsrf('file:///etc/passwd', 'example.com');
        },
        (err) => {
          assert.strictEqual(err.code, 'SSRF_HTTPS_REQUIRED');
          return true;
        }
      );
    });

    test('Localhost and cloud metadata hostnames are strictly rejected', async () => {
      await assert.rejects(
        async () => {
          await validateUrlForSsrf('https://localhost:8080/admin', 'localhost');
        },
        (err) => {
          assert.strictEqual(err.code, 'SSRF_BLOCKED_HOST');
          return true;
        }
      );

      await assert.rejects(
        async () => {
          await validateUrlForSsrf('https://metadata.google.internal/computeMetadata/v1/', 'metadata.google.internal');
        },
        (err) => {
          assert.strictEqual(err.code, 'SSRF_BLOCKED_HOST');
          return true;
        }
      );
    });

    test('Untrusted domain rejection: URL not in allowlist is rejected', async () => {
      await assert.rejects(
        async () => {
          await validateUrlForSsrf('https://attacker.evil.com/fake-cert', 'harvard.edu');
        },
        (err) => {
          assert.strictEqual(err.code, 'SSRF_DOMAIN_UNTRUSTED');
          return true;
        }
      );
    });

    test('Arbitrary user-supplied URL cannot be verified without registered TrustedSource', async () => {
      const res = await fetch(`${baseUrl}/api/verifications/verify-source`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sourceCode: 'SRC_UNREGISTERED_ATTACKER',
          queryParams: { identifier: '12345' }
        })
      });

      assert.strictEqual(res.status, 404);
      const body = await res.json();
      assert.strictEqual(body.error.code, 'UNSUPPORTED_SOURCE');
    });
  });

  // ==========================================
  // 3. Source States: SOURCE_FOUND vs SOURCE_VERIFIED
  // ==========================================
  describe('Official Source Verification & States', () => {
    let activeSourceCode;

    before(async () => {
      activeSourceCode = `SRC_REGISTRAR_${Date.now()}`;
      const source = await trustedSourceService.createTrustedSource(
        {
          sourceCode: activeSourceCode,
          organizationId: testOrg.organizationId,
          name: 'State Professional Registry',
          sourceType: 'API',
          baseUrl: 'https://registry.licensing.state.gov/api/v1',
          verificationEndpoint: '/verify'
        },
        adminUser
      );
      await trustedSourceService.approveTrustedSource(source.sourceCode, adminUser);
    });

    test('SOURCE_FOUND: registry confirms record but provides no cryptographic proof', async () => {
      // Seed local adapter with non-cryptographic record
      localAdapter.seedRecord(
        activeSourceCode,
        'LIC_PE_99482',
        {
          licenseNumber: 'LIC_PE_99482',
          holderName: 'Jane Doe, PE',
          status: 'ACTIVE',
          issuedDate: '2024-01-15'
        },
        false // Not cryptographically signed
      );

      const res = await fetch(`${baseUrl}/api/verifications/verify-source`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceCode: activeSourceCode,
          queryParams: { identifier: 'LIC_PE_99482' }
        })
      });

      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.verified, true);
      assert.strictEqual(body.data.sourceState, 'SOURCE_FOUND');
      assert.ok(body.data.responseHash);
      assert.ok(body.data.notes.includes('no cryptographic proof'));
    });

    test('SOURCE_VERIFIED: registry confirms record with cryptographic proof', async () => {
      // Seed local adapter with cryptographically signed record
      localAdapter.seedRecord(
        activeSourceCode,
        'LIC_CRYPTO_771',
        {
          licenseNumber: 'LIC_CRYPTO_771',
          holderName: 'Dr. Alan Turing',
          status: 'ACTIVE',
          signature: 'ed25519_signed_payload_proof'
        },
        true // Cryptographically signed
      );

      const res = await fetch(`${baseUrl}/api/verifications/verify-source`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceCode: activeSourceCode,
          queryParams: { identifier: 'LIC_CRYPTO_771' }
        })
      });

      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.verified, true);
      assert.strictEqual(body.data.sourceState, 'SOURCE_VERIFIED');
      assert.ok(body.data.notes.includes('cryptographic confirmation'));
    });

    test('NOT_FOUND: queried identifier does not exist at official source', async () => {
      const res = await fetch(`${baseUrl}/api/verifications/verify-source`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceCode: activeSourceCode,
          queryParams: { identifier: 'NON_EXISTENT_GHOST_RECORD' }
        })
      });

      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.data.verified, false);
      assert.strictEqual(body.data.sourceState, 'NOT_FOUND');
    });

    test('SOURCE_UNAVAILABLE: simulated source downtime returns SOURCE_UNAVAILABLE', async () => {
      localAdapter.simulateFailure(activeSourceCode, true);

      const res = await fetch(`${baseUrl}/api/verifications/verify-source`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceCode: activeSourceCode,
          queryParams: { identifier: 'LIC_PE_99482' }
        })
      });

      assert.strictEqual(res.status, 400);
      const body = await res.json();
      assert.strictEqual(body.error.code, 'SOURCE_UNAVAILABLE');

      localAdapter.simulateFailure(activeSourceCode, false);
    });

    test('Suspended or unverified source cannot be queried: returns UNTRUSTED_ORIGIN', async () => {
      const suspendedCode = `SRC_SUSPENDED_${Date.now()}`;
      const src = await trustedSourceService.createTrustedSource(
        {
          sourceCode: suspendedCode,
          organizationId: testOrg.organizationId,
          name: 'Suspended Board',
          sourceType: 'OFFICIAL_WEBSITE',
          baseUrl: 'https://suspended.state.gov'
        },
        adminUser
      );
      await trustedSourceService.approveTrustedSource(src.sourceCode, adminUser);
      await trustedSourceService.suspendTrustedSource(src.sourceCode, 'Audit hold', adminUser);

      const res = await fetch(`${baseUrl}/api/verifications/verify-source`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourceCode: suspendedCode,
          queryParams: { identifier: 'ANY_ID' }
        })
      });

      assert.strictEqual(res.status, 400);
      const body = await res.json();
      assert.strictEqual(body.error.code, 'UNTRUSTED_ORIGIN');
    });
  });
});

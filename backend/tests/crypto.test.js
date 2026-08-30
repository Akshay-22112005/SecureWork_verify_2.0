const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const { Readable } = require('stream');
const app = require('../src/app');
const { connectDB, disconnectDB } = require('../src/config/db');
const User = require('../src/models/user.model');
const Organization = require('../src/models/organization.model');
const Issuer = require('../src/models/issuer.model');
const IssuerKey = require('../src/models/issuerKey.model');
const issuerKeyService = require('../src/services/issuerKey.service');
const {
  sha256,
  sha256Stream,
  canonicalizeJson,
  generateEd25519KeyPair,
  signEd25519,
  verifyEd25519,
  keyStorage,
  LocalKeyStorageAdapter
} = require('../src/services/crypto');
const { generateToken } = require('../src/utils/jwt');

describe('Phase 4 Cryptography & Issuer Key Management Tests', () => {
  let server;
  let baseUrl;

  let adminUser;
  let adminToken;

  let issuerUser;
  let issuerToken;

  let testOrg;
  let testIssuer;

  before(async () => {
    await connectDB();
    await User.deleteMany({ email: /@cryptotest\.local$/ });
    await Organization.deleteMany({ officialDomain: /cryptotest\.local$/ });
    await Issuer.deleteMany({ issuerCode: /^ISS_CRYPTO_/ });
    await IssuerKey.deleteMany({ issuerId: /^iss_crypto_/ });

    const passwordHash = await User.hashPassword('CryptoSecret123!');

    adminUser = await User.create({
      name: 'Crypto Admin',
      email: 'admin@cryptotest.local',
      passwordHash,
      role: 'ADMIN',
      status: 'ACTIVE'
    });
    adminToken = generateToken(adminUser);

    issuerUser = await User.create({
      name: 'Key Master',
      email: 'keymaster@cryptotest.local',
      passwordHash,
      role: 'ISSUER',
      status: 'ACTIVE'
    });
    issuerToken = generateToken(issuerUser);

    testOrg = await Organization.create({
      organizationCode: 'ORG_CRYPTO_LAB',
      name: 'Cryptographic Trust Labs',
      type: 'CERTIFICATION_BODY',
      officialDomain: 'trustlab.cryptotest.local',
      organizationVerificationStatus: 'VERIFIED',
      status: 'ACTIVE',
      createdBy: adminUser.userId
    });

    testIssuer = await Issuer.create({
      issuerId: 'iss_crypto_main_01',
      issuerCode: 'ISS_CRYPTO_ROOT',
      userId: issuerUser.userId,
      organizationId: testOrg.organizationId,
      status: 'ACTIVE'
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
      await User.deleteMany({ email: /@cryptotest\.local$/ });
      await Organization.deleteMany({ officialDomain: /cryptotest\.local$/ });
      await Issuer.deleteMany({ issuerCode: /^ISS_CRYPTO_/ });
      await IssuerKey.deleteMany({ issuerId: /^iss_crypto_/ });
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
  // 1. SHA-256 Tests
  // ==========================================
  describe('SHA-256 Cryptographic Utilities', () => {
    test('SHA-256 matches NIST standard test vectors for empty string and known sentence', () => {
      // NIST vector: empty string
      const emptyHash = sha256('');
      assert.strictEqual(emptyHash, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');

      // NIST vector: "The quick brown fox jumps over the lazy dog"
      const foxHash = sha256('The quick brown fox jumps over the lazy dog');
      assert.strictEqual(foxHash, 'd7a8fbb307d7809469ca9abcb0082e4f8d5651e46d3cdb762d02d0bf37c9e592');
    });

    test('SHA-256 stream hashing computes identical digest asynchronously', async () => {
      const content = 'SecureWork Verify document stream verification test payload';
      const stream = Readable.from([
        Buffer.from('SecureWork Verify '),
        Buffer.from('document stream '),
        Buffer.from('verification test payload')
      ]);

      const streamHash = await sha256Stream(stream);
      const directHash = sha256(content);
      assert.strictEqual(streamHash, directHash);
    });

    test('Deterministic JSON canonicalization ensures key-order independent hashing', () => {
      const objA = { credentialId: 'c1', subject: { name: 'Alice', age: 30 }, active: true };
      const objB = { active: true, subject: { age: 30, name: 'Alice' }, credentialId: 'c1' };

      const hashA = sha256(objA);
      const hashB = sha256(objB);
      assert.strictEqual(hashA, hashB);
    });
  });

  // ==========================================
  // 2. Ed25519 Key Generation & Signing Tests
  // ==========================================
  describe('Ed25519 Keypair Generation, Signing & Verification', () => {
    let keypair;

    test('Ed25519 keypair generation creates valid SPKI public and PKCS#8 private PEMs', () => {
      keypair = generateEd25519KeyPair();
      assert.ok(keypair.publicKeyPem.includes('BEGIN PUBLIC KEY'));
      assert.ok(keypair.publicKeyPem.includes('END PUBLIC KEY'));
      assert.ok(keypair.privateKeyPem.includes('BEGIN PRIVATE KEY'));
      assert.ok(keypair.privateKeyPem.includes('END PRIVATE KEY'));
    });

    test('signature generation and verification with valid keypair succeeds', () => {
      const payload = {
        claimId: 'clm_9081',
        degree: 'Master of Computer Science',
        issueDate: '2026-08-30'
      };

      const signature = signEd25519(payload, keypair.privateKeyPem, 'hex');
      assert.ok(signature && signature.length > 0);

      const isValid = verifyEd25519(payload, signature, keypair.publicKeyPem, 'hex');
      assert.strictEqual(isValid, true);
    });

    test('signature verification fails when payload is tampered with', () => {
      const payload = { amount: 100, recipient: 'Alice' };
      const signature = signEd25519(payload, keypair.privateKeyPem, 'hex');

      const tamperedPayload = { amount: 999999, recipient: 'Alice' };
      const isValid = verifyEd25519(tamperedPayload, signature, keypair.publicKeyPem, 'hex');
      assert.strictEqual(isValid, false);
    });

    test('signature verification fails when signature is altered', () => {
      const payload = 'Verifiable workforce credential record';
      const signature = signEd25519(payload, keypair.privateKeyPem, 'hex');

      const tamperedSig = signature.slice(0, -2) + (signature.endsWith('0') ? '1' : '0');
      const isValid = verifyEd25519(payload, tamperedSig, keypair.publicKeyPem, 'hex');
      assert.strictEqual(isValid, false);
    });
  });

  // ==========================================
  // 3. Local Key Storage Adapter Security Tests
  // ==========================================
  describe('Key Storage Adapter Abstraction', () => {
    test('local key storage stores and retrieves private key, and rejects path traversal', async () => {
      const testKeyId = 'key_test_storage_01';
      const dummyPem = '-----BEGIN PRIVATE KEY-----\nMC4CAQAwBQYDK2VwBCIEI...\n-----END PRIVATE KEY-----';

      const ref = await keyStorage.storePrivateKey(testKeyId, dummyPem);
      assert.strictEqual(ref, `local:${testKeyId}`);

      const exists = await keyStorage.hasPrivateKey(testKeyId);
      assert.strictEqual(exists, true);

      const retrieved = await keyStorage.getPrivateKey(testKeyId);
      assert.strictEqual(retrieved.trim(), dummyPem.trim());

      // Path traversal security assertion
      await assert.rejects(async () => {
        await keyStorage.getPrivateKey('../../../sensitive_file');
      }, /Key identifier contains no valid characters|traversal/i);

      // Clean up
      await keyStorage.deletePrivateKey(testKeyId);
    });
  });

  // ==========================================
  // 4. Issuer Key Lifecycle (Rotation, Compromise, Revocation)
  // ==========================================
  describe('Issuer Key Lifecycle & API', () => {
    let key1;
    let key2;

    test('POST /api/issuers/:id/keys generates initial ACTIVE key', async () => {
      const res = await fetch(`${baseUrl}/api/issuers/${testIssuer.issuerId}/keys`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${issuerToken}` }
      });

      assert.strictEqual(res.status, 201);
      const body = await res.json();
      assert.strictEqual(body.success, true);

      key1 = body.data.key;
      assert.strictEqual(key1.issuerId, testIssuer.issuerId);
      assert.strictEqual(key1.status, 'ACTIVE');
      assert.strictEqual(key1.algorithm, 'ED25519');
      assert.ok(key1.publicKey.includes('BEGIN PUBLIC KEY'));

      // Security assertion: Private key material must NEVER be returned by API
      assert.strictEqual(key1.privateKey, undefined);
      assert.strictEqual(key1.privateKeyPem, undefined);
      assert.strictEqual(key1.privateKeyReference, undefined);
    });

    test('signing with initial active key works successfully', async () => {
      const signResult = await issuerKeyService.signPayload(key1.keyId, { test: 'payload1' });
      assert.ok(signResult.signature);

      const verifyResult = await issuerKeyService.verifyPayload(key1.keyId, { test: 'payload1' }, signResult.signature);
      assert.strictEqual(verifyResult.isValid, true);
    });

    test('POST /api/issuers/:id/rotate-key marks old key as RETIRED and creates new ACTIVE key', async () => {
      const res = await fetch(`${baseUrl}/api/issuers/${testIssuer.issuerId}/rotate-key`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${issuerToken}` }
      });

      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.success, true);

      key2 = body.data.key;
      assert.strictEqual(key2.status, 'ACTIVE');
      assert.notStrictEqual(key2.keyId, key1.keyId);

      // Verify old key was RETIRED in database
      const oldKeyDb = await IssuerKey.findOne({ keyId: key1.keyId });
      assert.strictEqual(oldKeyDb.status, 'RETIRED');
      assert.ok(oldKeyDb.retiredAt, 'retiredAt must be recorded');
    });

    test('historical key lookup preserves retired key for credential verification', async () => {
      const res = await fetch(`${baseUrl}/api/issuer-keys/${key1.keyId}`);
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.key.status, 'RETIRED');

      // Historical verification against retired key STILL succeeds
      const signResult = await issuerKeyService.signPayload(key2.keyId, { historicalDoc: true });
      const verifyResult = await issuerKeyService.verifyPayload(key2.keyId, { historicalDoc: true }, signResult.signature);
      assert.strictEqual(verifyResult.isValid, true);
    });

    test('signing new payload with RETIRED key is rejected', async () => {
      await assert.rejects(async () => {
        await issuerKeyService.signPayload(key1.keyId, { newCredential: true });
      }, { code: 'KEY_NOT_ACTIVE' });
    });

    test('PATCH /api/issuer-keys/:id/compromise marks key COMPROMISED and halts signing', async () => {
      const res = await fetch(`${baseUrl}/api/issuer-keys/${key2.keyId}/compromise`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({ reason: 'Suspected private key leak in logs' })
      });

      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.key.status, 'COMPROMISED');
      assert.ok(body.data.key.compromisedAt);

      // Verify new signing attempt with compromised key is rejected
      await assert.rejects(async () => {
        await issuerKeyService.signPayload(key2.keyId, { badData: true });
      }, { code: 'KEY_NOT_ACTIVE' });
    });

    test('PATCH /api/issuer-keys/:id/revoke marks key REVOKED', async () => {
      const res = await fetch(`${baseUrl}/api/issuer-keys/${key1.keyId}/revoke`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`
        },
        body: JSON.stringify({ reason: 'End of cryptographic validity period' })
      });

      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.key.status, 'REVOKED');
      assert.ok(body.data.key.revokedAt);
    });

    test('private-key API protection: raw private key material is NEVER stored in MongoDB or returned by API', async () => {
      // 1. Check API listing
      const res = await fetch(`${baseUrl}/api/issuer-keys`);
      const body = await res.json();
      assert.strictEqual(res.status, 200);
      for (const k of body.data.keys) {
        assert.strictEqual(k.privateKey, undefined);
        assert.strictEqual(k.privateKeyPem, undefined);
        assert.strictEqual(k.privateKeyReference, undefined);
      }

      // 2. Check direct raw MongoDB document collection
      const rawDoc = await IssuerKey.collection.findOne({ keyId: key2.keyId });
      assert.strictEqual(rawDoc.privateKey, undefined, 'MongoDB must NEVER store privateKey');
      assert.strictEqual(rawDoc.privateKeyPem, undefined, 'MongoDB must NEVER store privateKeyPem');
      assert.ok(rawDoc.publicKey.includes('BEGIN PUBLIC KEY'), 'MongoDB stores public key');
    });
  });
});

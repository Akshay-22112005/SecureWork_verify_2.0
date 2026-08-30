const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const app = require('../src/app');
const { connectDB, disconnectDB } = require('../src/config/db');
const User = require('../src/models/user.model');
const Document = require('../src/models/document.model');
const documentService = require('../src/services/document.service');
const { storageAdapter, LocalStorageAdapter } = require('../src/services/storage');
const { sha256 } = require('../src/utils/crypto');
const { generateToken } = require('../src/utils/jwt');

describe('Phase 5 Document Management & Local Storage Tests', () => {
  let server;
  let baseUrl;

  let ownerUser;
  let ownerToken;

  let otherUser;
  let otherToken;

  let adminUser;
  let adminToken;

  // Minimal valid file buffers with proper magic bytes
  const validPdfBuffer = Buffer.concat([
    Buffer.from('%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF')
  ]);

  const validPngBuffer = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG Signature
    0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR
    0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
    0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4,
    0x89, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e,
    0x44, 0xae, 0x42, 0x60, 0x82
  ]);

  const validJpgBuffer = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46,
    0x49, 0x46, 0x00, 0x01, 0x01, 0x01, 0x00, 0x48,
    0x00, 0x48, 0x00, 0x00, 0xff, 0xd9
  ]);

  before(async () => {
    await connectDB();
    await User.deleteMany({ email: /@docstorage\.local$/ });
    await Document.deleteMany({ originalFilename: /test_/ });

    const passwordHash = await User.hashPassword('DocTestSecret123!');

    ownerUser = await User.create({
      name: 'Document Owner',
      email: 'owner@docstorage.local',
      passwordHash,
      role: 'USER',
      status: 'ACTIVE'
    });
    ownerToken = generateToken(ownerUser);

    otherUser = await User.create({
      name: 'Unrelated User',
      email: 'other@docstorage.local',
      passwordHash,
      role: 'USER',
      status: 'ACTIVE'
    });
    otherToken = generateToken(otherUser);

    adminUser = await User.create({
      name: 'Storage Admin',
      email: 'admin@docstorage.local',
      passwordHash,
      role: 'ADMIN',
      status: 'ACTIVE'
    });
    adminToken = generateToken(adminUser);

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
      await User.deleteMany({ email: /@docstorage\.local$/ });
      await Document.deleteMany({ originalFilename: /test_/ });
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

  let uploadedPdfId;

  // ==========================================
  // 1. Valid File Upload Tests (PDF, PNG, JPG)
  // ==========================================
  describe('Document Uploads & Magic Bytes Verification', () => {
    test('PDF upload succeeds with valid %PDF magic bytes and authoritative SHA-256', async () => {
      const formData = new FormData();
      formData.append(
        'file',
        new Blob([validPdfBuffer], { type: 'application/pdf' }),
        'test_degree_certificate.pdf'
      );
      formData.append('representationType', 'ORIGINAL_DIGITAL_FILE');

      const res = await fetch(`${baseUrl}/api/documents/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${ownerToken}` },
        body: formData
      });

      assert.strictEqual(res.status, 201);
      const body = await res.json();
      assert.strictEqual(body.success, true);

      const doc = body.data.document;
      uploadedPdfId = doc.documentId;

      assert.strictEqual(doc.mimeType, 'application/pdf');
      assert.strictEqual(doc.originalFilename, 'test_degree_certificate.pdf');
      assert.strictEqual(doc.fileSize, validPdfBuffer.length);
      assert.strictEqual(doc.representationType, 'ORIGINAL_DIGITAL_FILE');

      // Server-side SHA-256 consistency assertion
      const expectedHash = sha256(validPdfBuffer);
      assert.strictEqual(doc.sha256Hash, expectedHash);
      assert.strictEqual(doc.uploadedBy, ownerUser.userId);
    });

    test('PNG upload succeeds with valid PNG magic bytes', async () => {
      const formData = new FormData();
      formData.append(
        'file',
        new Blob([validPngBuffer], { type: 'image/png' }),
        'test_badge_icon.png'
      );
      formData.append('representationType', 'IMAGE');

      const res = await fetch(`${baseUrl}/api/documents/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${ownerToken}` },
        body: formData
      });

      assert.strictEqual(res.status, 201);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.document.mimeType, 'image/png');
      assert.strictEqual(body.data.document.sha256Hash, sha256(validPngBuffer));
    });

    test('JPG upload succeeds with valid JPEG magic bytes', async () => {
      const formData = new FormData();
      formData.append(
        'file',
        new Blob([validJpgBuffer], { type: 'image/jpeg' }),
        'test_transcript_scan.jpg'
      );
      formData.append('representationType', 'SCAN');

      const res = await fetch(`${baseUrl}/api/documents/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${ownerToken}` },
        body: formData
      });

      assert.strictEqual(res.status, 201);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.document.mimeType, 'image/jpeg');
      assert.strictEqual(body.data.document.sha256Hash, sha256(validJpgBuffer));
    });
  });

  // ==========================================
  // 2. Security Rejections (Type, Executable, Oversized)
  // ==========================================
  describe('File Security & Characteristic Rejections', () => {
    test('invalid type: plain text masquerading as PDF is rejected', async () => {
      const fakePdfBuffer = Buffer.from('Plain text content that is not a valid PDF file.');
      const formData = new FormData();
      formData.append(
        'file',
        new Blob([fakePdfBuffer], { type: 'application/pdf' }),
        'test_fake.pdf'
      );

      const res = await fetch(`${baseUrl}/api/documents/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${ownerToken}` },
        body: formData
      });

      assert.strictEqual(res.status, 400);
      const body = await res.json();
      assert.strictEqual(body.success, false);
      assert.strictEqual(body.error.code, 'UNSUPPORTED_FILE_TYPE');
    });

    test('executable upload: Windows PE executable header (MZ) is strictly rejected', async () => {
      // Buffer starting with MZ (0x4D 0x5A)
      const exeBuffer = Buffer.from([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00]);
      const formData = new FormData();
      formData.append(
        'file',
        new Blob([exeBuffer], { type: 'application/pdf' }),
        'test_trojan.pdf'
      );

      const res = await fetch(`${baseUrl}/api/documents/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${ownerToken}` },
        body: formData
      });

      assert.strictEqual(res.status, 400);
      const body = await res.json();
      assert.strictEqual(body.success, false);
      assert.strictEqual(body.error.code, 'EXECUTABLE_PROHIBITED');
    });

    test('oversized file: buffer exceeding 10 MB is rejected', async () => {
      // 10 MB + 50 KB buffer
      const oversizedBuffer = Buffer.alloc(10 * 1024 * 1024 + 50 * 1024, 0x25); // '%...'
      const formData = new FormData();
      formData.append(
        'file',
        new Blob([oversizedBuffer], { type: 'application/pdf' }),
        'test_huge.pdf'
      );

      const res = await fetch(`${baseUrl}/api/documents/upload`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${ownerToken}` },
        body: formData
      });

      assert.strictEqual(res.status, 400);
      const body = await res.json();
      assert.strictEqual(body.success, false);
      assert.strictEqual(body.error.code, 'FILE_TOO_LARGE');
    });
  });

  // ==========================================
  // 3. Storage Abstraction & Path Traversal Protection
  // ==========================================
  describe('Storage Adapter Abstraction & Path Traversal Security', () => {
    test('LocalStorageAdapter uploadFile, getFile, getDownloadPath, and deleteFile works directly', async () => {
      const customAdapter = new LocalStorageAdapter();
      const testBuffer = Buffer.from('%PDF-1.4 test binary stream');

      const uploadResult = await customAdapter.uploadFile(testBuffer, 'direct_test.pdf', 'application/pdf');
      assert.ok(uploadResult.storagePath);
      assert.strictEqual(uploadResult.fileSize, testBuffer.length);
      assert.strictEqual(uploadResult.sha256Hash, sha256(testBuffer));

      // Retrieve file buffer
      const retrieved = await customAdapter.getFile(uploadResult.storagePath);
      assert.deepStrictEqual(retrieved, testBuffer);

      // Download path
      const downloadPath = await customAdapter.getDownloadPath(uploadResult.storagePath);
      assert.ok(downloadPath.includes(uploadResult.storagePath));

      // Clean up
      const deleted = await customAdapter.deleteFile(uploadResult.storagePath);
      assert.strictEqual(deleted, true);
    });

    test('path traversal in storage key is strictly blocked', async () => {
      const customAdapter = new LocalStorageAdapter();

      await assert.rejects(async () => {
        await customAdapter.getFile('../../../etc/passwd');
      }, { code: 'PATH_TRAVERSAL_PROHIBITED' });

      await assert.rejects(async () => {
        await customAdapter.getDownloadPath('..\\..\\Windows\\System32\\cmd.exe');
      }, { code: 'PATH_TRAVERSAL_PROHIBITED' });
    });
  });

  // ==========================================
  // 4. Download & Integrity Verification Tests
  // ==========================================
  describe('Document Download & Integrity Verification', () => {
    test('GET /api/documents/:id retrieves document metadata', async () => {
      const res = await fetch(`${baseUrl}/api/documents/${uploadedPdfId}`, {
        headers: { Authorization: `Bearer ${ownerToken}` }
      });

      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.document.documentId, uploadedPdfId);
    });

    test('GET /api/documents/:id/download streams exact binary matching original SHA-256', async () => {
      const res = await fetch(`${baseUrl}/api/documents/${uploadedPdfId}/download`, {
        headers: { Authorization: `Bearer ${ownerToken}` }
      });

      assert.strictEqual(res.status, 200);
      const arrayBuffer = await res.arrayBuffer();
      const downloadedBuffer = Buffer.from(arrayBuffer);

      assert.deepStrictEqual(downloadedBuffer, validPdfBuffer);
      assert.strictEqual(sha256(downloadedBuffer), sha256(validPdfBuffer));
    });

    test('documentService.verifyDocumentIntegrity confirms on-disk hash consistency', async () => {
      const integrity = await documentService.verifyDocumentIntegrity(uploadedPdfId);
      assert.strictEqual(integrity.matches, true);
      assert.strictEqual(integrity.calculatedHash, integrity.expectedHash);
    });
  });

  // ==========================================
  // 5. RBAC & Access Boundary Tests
  // ==========================================
  describe('RBAC & Document Privacy', () => {
    test('unauthorized user cannot access another user document metadata (403 FORBIDDEN)', async () => {
      const res = await fetch(`${baseUrl}/api/documents/${uploadedPdfId}`, {
        headers: { Authorization: `Bearer ${otherToken}` } // Different regular USER
      });

      assert.strictEqual(res.status, 403);
      const body = await res.json();
      assert.strictEqual(body.success, false);
      assert.strictEqual(body.error.code, 'FORBIDDEN');
    });

    test('unauthorized user cannot download another user document binary (403 FORBIDDEN)', async () => {
      const res = await fetch(`${baseUrl}/api/documents/${uploadedPdfId}/download`, {
        headers: { Authorization: `Bearer ${otherToken}` } // Different regular USER
      });

      assert.strictEqual(res.status, 403);
      const body = await res.json();
      assert.strictEqual(body.success, false);
      assert.strictEqual(body.error.code, 'FORBIDDEN');
    });

    test('ADMIN can access any document for platform verification', async () => {
      const res = await fetch(`${baseUrl}/api/documents/${uploadedPdfId}`, {
        headers: { Authorization: `Bearer ${adminToken}` }
      });

      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.success, true);
      assert.strictEqual(body.data.document.documentId, uploadedPdfId);
    });
  });
});

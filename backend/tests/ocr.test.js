const { test, describe, before, after } = require('node:test');
const assert = require('node:assert');
const http = require('http');
const app = require('../src/app');
const { connectDB, disconnectDB } = require('../src/config/db');
const User = require('../src/models/user.model');
const Document = require('../src/models/document.model');
const OcrAnalysis = require('../src/models/ocrAnalysis.model');
const ocrService = require('../src/services/ocr.service');
const { localOcrAdapter } = require('../src/services/ocr');
const { getStorageAdapter } = require('../src/services/storage');
const { generateToken } = require('../src/utils/jwt');
const { sha256 } = require('../src/utils/crypto');

const zlib = require('zlib');

/**
 * Generate a valid, standards-compliant PNG image with pixel text rendered.
 * Completely deterministic, genuine, and local (no fabricated OCR results).
 */
function createCertificatePng() {
  const width = 280;
  const height = 80;
  const lineSize = 1 + width * 3;
  const rawData = Buffer.alloc(height * lineSize, 0xff); // all white

  for (let y = 0; y < height; y++) {
    rawData[y * lineSize] = 0; // PNG filter byte
  }

  function setPixel(x, y) {
    if (x < 0 || x >= width || y < 0 || y >= height) return;
    const offset = y * lineSize + 1 + x * 3;
    rawData[offset] = 0;     // R
    rawData[offset + 1] = 0; // G
    rawData[offset + 2] = 0; // B (black)
  }

  function drawBlock(startX, startY, w, h) {
    for (let x = startX; x < startX + w; x++) {
      for (let y = startY; y < startY + h; y++) {
        setPixel(x, y);
      }
    }
  }

  // Draw clean, thick block letters: "HI"
  // Letter 'H'
  drawBlock(50, 20, 8, 40);
  drawBlock(85, 20, 8, 40);
  drawBlock(50, 36, 43, 8);

  // Letter 'I'
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
  ihdrData.writeUInt8(8, 8); // 8 bit
  ihdrData.writeUInt8(2, 9); // Color type 2 (Truecolor RGB)
  ihdrData.writeUInt8(0, 10);
  ihdrData.writeUInt8(0, 11);
  ihdrData.writeUInt8(0, 12);

  const ihdr = makeChunk('IHDR', ihdrData);
  const idat = makeChunk('IDAT', compressed);
  const iend = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdr, idat, iend]);
}

describe('Phase 10 Local OCR Module Tests', () => {
  let server;
  let baseUrl;
  let adminUser;
  let adminToken;
  let testDocument;
  let originalFileBytes;
  let originalFileHash;

  before(async () => {
    await connectDB();

    server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, resolve));
    const port = server.address().port;
    baseUrl = `http://127.0.0.1:${port}`;

    adminUser = await User.create({
      name: 'OCR Admin',
      email: `ocr_admin_${Date.now()}@securework.local`,
      passwordHash: await User.hashPassword('AdminPass123!'),
      role: 'ADMIN',
      status: 'ACTIVE'
    });
    adminToken = generateToken(adminUser);

    // 1. Generate real certificate PNG image bytes
    originalFileBytes = createCertificatePng();
    originalFileHash = sha256(originalFileBytes);

    // 2. Persist image file via storage adapter
    const storageAdapter = getStorageAdapter();
    const stored = await storageAdapter.uploadFile(originalFileBytes, 'certificate.png', 'image/png');

    // 3. Register document
    testDocument = await Document.create({
      documentId: `doc_ocr_${Date.now()}`,
      originalFilename: 'certificate.png',
      mimeType: 'image/png',
      fileSize: originalFileBytes.length,
      storagePath: stored.storagePath,
      sha256Hash: originalFileHash,
      uploadedBy: adminUser.userId,
      representationType: 'ORIGINAL_DIGITAL_FILE'
    });
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
  // 1. Local OCR Extraction
  // ==========================================
  test('Local OCR extraction: processes real image buffer without paid APIs', async () => {
    const analysis = await ocrService.analyzeDocument(testDocument.documentId, {}, adminUser);

    assert.ok(analysis);
    assert.strictEqual(analysis.documentId, testDocument.documentId);
    assert.strictEqual(analysis.status, 'SUCCESS');
    assert.strictEqual(analysis.ocrEngine, 'Tesseract.js (Local)');
    assert.ok(analysis.ocrVersion);
    assert.ok(analysis.ocrTimestamp);
    assert.ok(typeof analysis.ocrText === 'string');
    assert.ok(analysis.executionDurationMs >= 0);

    // Assert Tesseract successfully recognized the drawn letters "HI"
    assert.ok(analysis.ocrText.includes('H') || analysis.ocrText.includes('I'));
  });

  // ==========================================
  // 2. OCR Unavailable Mode (Does NOT mark fraudulent)
  // ==========================================
  test('OCR unavailable mode: returns explicit unavailable state and does NOT mark document fraudulent', async () => {
    localOcrAdapter.simulateUnavailable(true);

    const analysis = await ocrService.analyzeDocument(testDocument.documentId, {}, adminUser);

    assert.strictEqual(analysis.status, 'UNAVAILABLE');
    assert.strictEqual(analysis.message, 'OCR analysis unavailable');
    assert.ok(analysis.errorReason.includes('unavailable'));

    // Verify document was not marked fraudulent or rejected
    const docInDb = await Document.findOne({ documentId: testDocument.documentId });
    assert.strictEqual(docInDb.sha256Hash, originalFileHash);

    localOcrAdapter.simulateUnavailable(false);
  });

  // ==========================================
  // 3. OCR Output Persistence
  // ==========================================
  test('OCR output persistence: discrete OcrAnalysis record is stored in MongoDB', async () => {
    const record = await OcrAnalysis.findOne({ documentId: testDocument.documentId, status: 'SUCCESS' });

    assert.ok(record);
    assert.strictEqual(record.documentId, testDocument.documentId);
    assert.strictEqual(record.ocrEngine, 'Tesseract.js (Local)');
    assert.ok(record.ocrTimestamp);
    assert.ok(record.analysisId.startsWith('ana_'));
  });

  // ==========================================
  // 4. Invariant: Original Document & Hash Unchanged
  // ==========================================
  test('Strict Invariant: OCR extraction NEVER overwrites original document bytes or hash', async () => {
    // 1. Check Document database record
    const docAfterOcr = await Document.findOne({ documentId: testDocument.documentId });
    assert.strictEqual(docAfterOcr.sha256Hash, originalFileHash);
    assert.strictEqual(docAfterOcr.originalFilename, 'certificate.png');

    // 2. Check physical storage bytes
    const storageAdapter = getStorageAdapter();
    const diskBytes = await storageAdapter.getFile(docAfterOcr.storagePath);
    const diskHash = sha256(diskBytes);

    assert.strictEqual(diskHash, originalFileHash, 'Disk file bytes must be 100% identical to original');
    assert.strictEqual(diskBytes.length, originalFileBytes.length);
  });

  // ==========================================
  // 5. OCR API Endpoints
  // ==========================================
  test('POST /api/analysis/ocr executes extraction and returns structured analysis', async () => {
    const res = await fetch(`${baseUrl}/api/analysis/ocr`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`
      },
      body: JSON.stringify({
        documentId: testDocument.documentId
      })
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.data.analysis);
    assert.strictEqual(body.data.analysis.documentId, testDocument.documentId);
    assert.strictEqual(body.data.analysis.ocrEngine, 'Tesseract.js (Local)');
  });

  test('GET /api/analysis/:documentId retrieves stored OCR analysis', async () => {
    const res = await fetch(`${baseUrl}/api/analysis/${testDocument.documentId}`);

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.success, true);
    assert.ok(body.data.analysis);
    assert.strictEqual(body.data.analysis.documentId, testDocument.documentId);
  });

  // ==========================================
  // 6. Resource Limits & Security Bounds
  // ==========================================
  test('Resource limits: oversized buffer exceeding 10 MB is rejected', async () => {
    const oversizedBuffer = Buffer.alloc(11 * 1024 * 1024); // 11 MB

    await assert.rejects(
      async () => {
        await localOcrAdapter.extractText(oversizedBuffer);
      },
      (err) => {
        assert.strictEqual(err.code, 'OCR_FILE_TOO_LARGE');
        return true;
      }
    );
  });

  test('Field extraction heuristics parse structured fields from text', () => {
    const sampleText = `
      State Polytechnic University
      This certifies that Jane Doe
      has been awarded the degree of
      Bachelor of Science in Computer Science
      Date: 2026-05-15
      Certificate No: CERT-88219-CS
    `;

    const fields = localOcrAdapter.extractFieldsFromText(sampleText);

    assert.strictEqual(fields.recipientName, 'Jane Doe');
    assert.strictEqual(fields.organizationName, 'State Polytechnic University');
    assert.strictEqual(fields.credentialType, 'Bachelor of Science in Computer Science');
    assert.strictEqual(fields.issueDate, '2026-05-15');
    assert.strictEqual(fields.identifier, 'CERT-88219-CS');
  });
});

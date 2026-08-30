const Document = require('../models/document.model');
const OcrAnalysis = require('../models/ocrAnalysis.model');
const { getStorageAdapter } = require('./storage');
const { getOcrAdapter } = require('./ocr');
const { sha256 } = require('../utils/crypto');
const auditService = require('./audit.service');
const { NotFoundError, ValidationError } = require('../utils/errors');
const logger = require('../utils/logger');

/**
 * OCR Analysis Service
 * Manages local, resource-bounded OCR extraction.
 * Invariant: OCR output is evidence extraction only and NEVER overwrites:
 * - original document
 * - document hash
 * - cryptographic evidence
 */
class OcrService {
  /**
   * Run OCR analysis on a registered document.
   * @param {string} documentId
   * @param {object} [options]
   * @param {object} [user]
   * @returns {Promise<object>}
   */
  async analyzeDocument(documentId, options = {}, user = null) {
    if (!documentId) {
      throw new ValidationError('documentId is required for OCR analysis');
    }

    // 1. Locate registered Document record
    const document = await Document.findOne({ documentId });
    if (!document) {
      throw new NotFoundError(`Document "${documentId}" not found`, 'DOCUMENT_NOT_FOUND');
    }

    // Invariant Guard: Record original document hash before OCR
    const originalHash = document.sha256Hash;
    const originalFilename = document.originalFilename;

    // 2. Retrieve file bytes from storage abstraction
    const storageAdapter = getStorageAdapter();
    let fileBuffer;
    try {
      fileBuffer = await storageAdapter.getFile(document.storagePath);
    } catch (err) {
      throw new NotFoundError(`Underlying document file not found in storage: ${err.message}`, 'STORAGE_FILE_NOT_FOUND');
    }

    // 3. Verify file integrity before OCR
    const preCheckHash = sha256(fileBuffer);
    if (preCheckHash !== originalHash) {
      throw new ValidationError('Document file on disk does not match database record', 'INTEGRITY_MISMATCH');
    }

    // 4. Delegate to OCR adapter (bounded execution)
    const ocrAdapter = getOcrAdapter();
    const ocrResult = await ocrAdapter.extractText(fileBuffer, options);

    // 5. Invariant Guard: Strictly verify original document and hash were NOT overwritten!
    const postCheckHash = sha256(fileBuffer);
    if (postCheckHash !== originalHash || document.sha256Hash !== originalHash) {
      throw new Error('FATAL SECURITY INVARIANT VIOLATION: OCR extraction modified original document bytes or hash!');
    }

    // 6. Store discrete OCR analysis record
    const analysisRecord = await OcrAnalysis.create({
      documentId: document.documentId,
      status: ocrResult.status,
      ocrText: ocrResult.ocrText || '',
      ocrEngine: ocrResult.ocrEngine || 'Tesseract.js (Local)',
      ocrVersion: ocrResult.ocrVersion || '5.x',
      ocrTimestamp: new Date(),
      extractedFields: ocrResult.extractedFields || {},
      confidence: ocrResult.confidence || 0,
      executionDurationMs: ocrResult.durationMs || 0,
      errorReason: ocrResult.errorReason || null
    });

    // 7. Audit log
    await auditService.recordEvent(
      user ? user.userId : 'SYSTEM_OCR',
      user ? user.role : 'USER',
      'OCR_ANALYSIS_PERFORMED',
      document.documentId,
      {
        analysisId: analysisRecord.analysisId,
        status: ocrResult.status,
        engine: ocrResult.ocrEngine,
        durationMs: ocrResult.durationMs
      }
    );

    // 8. Handle Unavailable Mode Gracefully
    if (ocrResult.status === 'UNAVAILABLE') {
      logger.info('OCR analysis completed with UNAVAILABLE status', {
        documentId: document.documentId,
        errorReason: ocrResult.errorReason
      });

      return {
        analysisId: analysisRecord.analysisId,
        documentId: document.documentId,
        status: 'UNAVAILABLE',
        message: 'OCR analysis unavailable',
        ocrEngine: ocrResult.ocrEngine,
        ocrTimestamp: analysisRecord.ocrTimestamp,
        errorReason: ocrResult.errorReason,
        extractedFields: {}
      };
    }

    return analysisRecord.toJSON();
  }

  /**
   * Retrieve latest OCR analysis for a document.
   * @param {string} documentId
   * @returns {Promise<object>}
   */
  async getAnalysisByDocumentId(documentId) {
    if (!documentId) throw new ValidationError('documentId is required');

    const analysis = await OcrAnalysis.findOne({ documentId }).sort({ ocrTimestamp: -1 });
    if (!analysis) {
      throw new NotFoundError(`No OCR analysis found for document "${documentId}"`, 'ANALYSIS_NOT_FOUND');
    }

    return analysis.toJSON();
  }
}

module.exports = new OcrService();

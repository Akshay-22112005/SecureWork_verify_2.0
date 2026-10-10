const Document = require('../models/document.model');
const OcrAnalysis = require('../models/ocrAnalysis.model');
const AIAnalysis = require('../models/aiAnalysis.model');
const { getAiAdapter } = require('./ai');
const { getStorageAdapter } = require('./storage');
const auditService = require('./audit.service');
const { NotFoundError, ValidationError } = require('../utils/errors');
const logger = require('../utils/logger');

/**
 * AI Analysis Service.
 * Manages local supplementary AI/ML risk classification and anomaly detection.
 * Enforces strict trust rules: AI evidence is supplementary and NEVER overrides
 * cryptographic truth, revocation, or organization trust.
 */
class AIService {
  /**
   * Run local AI analysis on a document.
   * @param {string} documentId
   * @param {object} [options]
   * @param {object} [user]
   * @returns {Promise<object>}
   */
  async analyzeDocument(documentId, options = {}, user = null) {
    if (!documentId) {
      throw new ValidationError('documentId is required for AI analysis');
    }

    // 1. Locate Document
    const document = await Document.findOne({ documentId });
    if (!document) {
      throw new NotFoundError(`Document "${documentId}" not found`, 'DOCUMENT_NOT_FOUND');
    }

    // 2. Fetch latest OCR text and extracted fields for context
    const ocrAnalysis = await OcrAnalysis.findOne({ documentId }).sort({ ocrTimestamp: -1 });
    const ocrText = ocrAnalysis ? ocrAnalysis.ocrText : '';
    const extractedFields = ocrAnalysis ? ocrAnalysis.extractedFields : {};

    // 3. Load file buffer from storage for binary/metadata heuristic inspection
    const storageAdapter = getStorageAdapter();
    let fileBuffer = null;
    try {
      fileBuffer = await storageAdapter.getFile(document.storagePath);
    } catch (err) {
      logger.warn('Storage file retrieval warning during AI analysis', { error: err.message });
    }

    // 4. Execute AI analysis via active adapter (FULL_LOCAL by default)
    const aiAdapter = getAiAdapter();
    const result = await aiAdapter.analyze({
      document,
      fileBuffer,
      ocrText,
      extractedFields,
      pdfMetadata: (ocrAnalysis && ocrAnalysis.pdfMetadata) ? ocrAnalysis.pdfMetadata : {}
    }, options);

    // 5. Persist AIAnalysis record
    const analysisRecord = await AIAnalysis.create({
      documentId: document.documentId,
      status: result.status,
      ocrTextReference: (ocrText || '').slice(0, 1000),
      extractedFields: extractedFields || {},
      modelName: result.modelName || 'SecureWork Heuristic Tamper Classifier',
      modelVersion: result.modelVersion || '2.1.0',
      riskLevel: result.riskLevel || 'LOW',
      riskScore: result.score !== undefined ? result.score : 0,
      findings: result.findings || [],
      executionDurationMs: result.durationMs || 0,
      errorReason: result.errorReason || null,
      createdAt: new Date()
    });

    // 6. Record Audit event
    await auditService.recordEvent(
      user ? user.userId : 'SYSTEM_AI',
      user ? user.role : 'USER',
      'AI_ANALYSIS_PERFORMED',
      document.documentId,
      {
        analysisId: analysisRecord.analysisId,
        status: result.status,
        modelName: result.modelName,
        riskLevel: result.riskLevel,
        riskScore: result.score
      }
    );

    // 7. Unavailable Mode Handling
    if (result.status === 'UNAVAILABLE') {
      logger.info('AI analysis completed with UNAVAILABLE status', {
        documentId: document.documentId,
        errorReason: result.errorReason
      });

      return {
        analysisId: analysisRecord.analysisId,
        documentId: document.documentId,
        status: 'UNAVAILABLE',
        message: 'AI analysis unavailable',
        modelName: result.modelName,
        riskLevel: 'LOW',
        score: 0,
        riskScore: 0,
        tamperingDetected: false,
        findings: [],
        errorReason: result.errorReason,
        isAdvisory: true,
        advisoryNotice: 'AI Tamper Analysis is supplementary and heuristic. It cannot override cryptographic verification.',
        createdAt: analysisRecord.createdAt
      };
    }

    return {
      analysisId: analysisRecord.analysisId,
      documentId: analysisRecord.documentId,
      status: analysisRecord.status,
      ocrTextReference: analysisRecord.ocrTextReference,
      extractedFields: analysisRecord.extractedFields,
      modelName: analysisRecord.modelName,
      modelVersion: analysisRecord.modelVersion,
      riskLevel: analysisRecord.riskLevel,
      riskScore: analysisRecord.riskScore,
      score: analysisRecord.riskScore,
      tamperingDetected: result.tamperingDetected || (analysisRecord.riskScore >= 0.50),
      findings: analysisRecord.findings,
      isAdvisory: true,
      advisoryNotice: 'AI Tamper Analysis is supplementary and heuristic. It cannot override cryptographic verification.',
      createdAt: analysisRecord.createdAt
    };
  }

  /**
   * Retrieve latest AI analysis for a document.
   * @param {string} documentId
   * @returns {Promise<object>}
   */
  async getAnalysisByDocumentId(documentId) {
    if (!documentId) throw new ValidationError('documentId is required');

    const analysis = await AIAnalysis.findOne({ documentId }).sort({ createdAt: -1 });
    if (!analysis) {
      throw new NotFoundError(`No AI analysis found for document "${documentId}"`, 'ANALYSIS_NOT_FOUND');
    }

    return {
      analysisId: analysis.analysisId,
      documentId: analysis.documentId,
      status: analysis.status,
      ocrTextReference: analysis.ocrTextReference,
      extractedFields: analysis.extractedFields,
      modelName: analysis.modelName,
      modelVersion: analysis.modelVersion,
      riskLevel: analysis.riskLevel,
      riskScore: analysis.riskScore,
      score: analysis.riskScore,
      tamperingDetected: analysis.riskScore >= 0.50 || (analysis.findings && analysis.findings.some(f => f.severity === 'HIGH' || f.severity === 'CRITICAL')),
      findings: analysis.findings,
      isAdvisory: true,
      advisoryNotice: 'AI Tamper Analysis is supplementary and heuristic. It cannot override cryptographic verification.',
      createdAt: analysis.createdAt
    };
  }
}

module.exports = new AIService();

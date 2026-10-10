const ocrService = require('../services/ocr.service');
const aiService = require('../services/ai.service');
const documentService = require('../services/document.service');
const { successResponse } = require('../utils/response');
const { ValidationError } = require('../utils/errors');

/**
 * Upload document and immediately execute both OCR extraction and AI tamper analysis.
 * (POST /api/analysis/upload)
 */
async function uploadAndAnalyze(req, res, next) {
  try {
    if (!req.file) {
      throw new ValidationError('No document file uploaded');
    }

    // 1. Ingest document
    const document = await documentService.ingestDocument(
      {
        file: req.file,
        representationType: req.body.representationType || 'ORIGINAL_PDF'
      },
      req.user
    );

    // 2. Execute OCR analysis
    let ocrAnalysis = null;
    try {
      ocrAnalysis = await ocrService.analyzeDocument(document.documentId, req.body.options || {}, req.user);
    } catch (err) {
      ocrAnalysis = { status: 'FAILED', errorReason: err.message };
    }

    // 3. Execute AI tamper analysis
    let aiAnalysis = null;
    try {
      aiAnalysis = await aiService.analyzeDocument(document.documentId, req.body.options || {}, req.user);
    } catch (err) {
      aiAnalysis = { status: 'FAILED', errorReason: err.message };
    }

    return successResponse(
      res,
      {
        document,
        documentId: document.documentId,
        ocrAnalysis,
        aiAnalysis,
        analysis: {
          ocr: ocrAnalysis,
          ai: aiAnalysis
        }
      },
      201
    );
  } catch (err) {
    next(err);
  }
}

/**
 * Execute AI document analysis (POST /api/analysis/document).
 */
async function performDocumentAnalysis(req, res, next) {
  try {
    const { documentId, options } = req.body;
    const analysis = await aiService.analyzeDocument(documentId, options, req.user);
    return successResponse(res, { analysis }, 200);
  } catch (err) {
    next(err);
  }
}

/**
 * Execute OCR text extraction on a document (POST /api/analysis/ocr).
 */
async function performOcrAnalysis(req, res, next) {
  try {
    const { documentId, options } = req.body;
    const analysis = await ocrService.analyzeDocument(documentId, options, req.user);
    return successResponse(res, { analysis }, 200);
  } catch (err) {
    next(err);
  }
}

/**
 * Retrieve past analysis for a document (GET /api/analysis/:documentId).
 * Returns combined/latest document analysis.
 */
async function getDocumentAnalysis(req, res, next) {
  try {
    const { documentId } = req.params;

    let aiAnalysis = null;
    let ocrAnalysis = null;

    try {
      aiAnalysis = await aiService.getAnalysisByDocumentId(documentId);
    } catch {}

    try {
      ocrAnalysis = await ocrService.getAnalysisByDocumentId(documentId);
    } catch {}

    if (!aiAnalysis && !ocrAnalysis) {
      await ocrService.getAnalysisByDocumentId(documentId);
    }

    const primary = ocrAnalysis || aiAnalysis;
    const responseData = {
      analysis: {
        ...primary,
        ai: aiAnalysis,
        ocr: ocrAnalysis,
        ocrAnalysis,
        aiAnalysis
      }
    };

    return successResponse(res, responseData, 200);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  uploadAndAnalyze,
  performDocumentAnalysis,
  performOcrAnalysis,
  getDocumentAnalysis
};

const ocrService = require('../services/ocr.service');
const aiService = require('../services/ai.service');
const { successResponse } = require('../utils/response');

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
      // If neither exists, trigger not found
      await ocrService.getAnalysisByDocumentId(documentId);
    }

    // Default primary analysis to AI if present, else OCR
    const primary = aiAnalysis || ocrAnalysis;
    const responseData = {
      analysis: {
        ...primary,
        ai: aiAnalysis,
        ocr: ocrAnalysis
      }
    };

    return successResponse(res, responseData, 200);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  performDocumentAnalysis,
  performOcrAnalysis,
  getDocumentAnalysis
};

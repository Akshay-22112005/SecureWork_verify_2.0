const ocrService = require('../services/ocr.service');
const aiService = require('../services/ai.service');
const documentService = require('../services/document.service');
const { successResponse } = require('../utils/response');
const { ValidationError } = require('../utils/errors');
const { getOcrAdapter } = require('../services/ocr');
const { extractFromPdf } = require('../services/ocr/pdfExtractor');

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
    const representationType = (req.body.representationType === 'ORIGINAL_PDF' || !req.body.representationType)
      ? 'ORIGINAL_DIGITAL_FILE'
      : req.body.representationType;

    const uploader = req.user || {
      userId: 'usr_public_anonymous',
      uploadedBy: 'usr_public_anonymous',
      role: 'USER',
      name: 'Anonymous Public Uploader'
    };

    const document = await documentService.ingestDocument(
      {
        file: req.file,
        representationType
      },
      uploader
    );

    // 2. Execute OCR analysis
    let ocrAnalysis = null;
    try {
      ocrAnalysis = await ocrService.analyzeDocument(document.documentId, req.body.options || {}, uploader);
    } catch (err) {
      ocrAnalysis = { status: 'FAILED', errorReason: err.message };
    }

    // 3. Execute AI tamper analysis
    let aiAnalysis = null;
    try {
      aiAnalysis = await aiService.analyzeDocument(document.documentId, req.body.options || {}, uploader);
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
    if (req.file) {
      const adapter = getOcrAdapter();
      const result = await adapter.extractText(req.file.buffer, req.body.options || {});
      const text = result.ocrText || '';
      const extracted = result.extractedFields || {};
      const fields = {
        studentName: extracted.recipientName || extracted.studentName || null,
        institution: extracted.organizationName || extracted.institution || null,
        degree: extracted.credentialTitle || extracted.degree || null,
        graduationYear: text.match(/\b(?:19|20)\d{2}\b/)?.[0] || null,
        gpa: text.match(/\b(?:GPA|Grade Point Average)\s*[:=]?\s*([0-4](?:\.\d{1,2})?)/i)?.[1] || null
      };
      const structuredFields = {
        ...extracted,
        recipientName: fields.studentName,
        organizationName: fields.institution,
        credentialTitle: fields.degree,
        graduationYear: fields.graduationYear,
        gpa: fields.gpa
      };
      const confidenceRatio = Number(result.confidence || 0);
      const analysis = {
        ...result,
        ocrText: text,
        extractedFields: structuredFields,
        confidence: confidenceRatio,
        status: result.status || 'SUCCESS'
      };
      return successResponse(res, { analysis, text, fields, confidence: Number((confidenceRatio * 100).toFixed(1)) }, 200);
    }
    const { documentId, options } = req.body;
    const analysis = await ocrService.analyzeDocument(documentId, options, req.user);
    return successResponse(res, { analysis }, 200);
  } catch (err) {
    next(err);
  }
}

/**
 * Run bounded, heuristic-only tamper inspection on an uploaded file or registered document.
 */
async function performTamperCheck(req, res, next) {
  try {
    if (!req.file) {
      const { documentId, options } = req.body || {};
      const analysis = await aiService.analyzeDocument(documentId, options, req.user);
      return successResponse(res, { analysis }, 200);
    }

    const buffer = req.file.buffer;
    const isPdf = buffer.length >= 5 && buffer.subarray(0, 5).toString('latin1') === '%PDF-';
    const pdfInfo = isPdf ? extractFromPdf(buffer) : { metadata: {}, text: '', embeddedImages: [] };
    const binary = buffer.toString('latin1');
    const fontNames = isPdf ? [...new Set([...binary.matchAll(/\/BaseFont\s*\/([^\s/<>()]+)/g)].map((match) => match[1]))] : [];
    const fontCount = fontNames.length;
    let pixelStats = null;
    try {
      pixelStats = req.body.pixelStats ? JSON.parse(req.body.pixelStats) : null;
    } catch {}

    // Conservative indicators: PDF incremental revisions and excessive embedded font families.
    const trailerCount = Number(pdfInfo.metadata?.trailerCount || 1);
    const incrementalRevisionPenalty = Math.max(0, trailerCount - 1) * 0.03;
    const fontPenalty = Math.max(0, fontCount - 4) * 0.02;
    const pixelPenalty = pixelStats && Number(pixelStats.edgePixelRatio) > 0.98 ? 0.02 : 0;
    const score = Math.min(0.99, Number((0.02 + incrementalRevisionPenalty + fontPenalty + pixelPenalty).toFixed(2)));
    const tamperingDetected = score >= 0.5;
    const fontConsistency = !isPdf
      ? 'Image pixels readable; no document font layer'
      : fontCount <= 4
        ? `Consistent (${fontCount || 1} embedded font families)`
        : `Review recommended (${fontCount} embedded font families)`;
    const layerInspectionLog = [
      isPdf ? `PDF stream readable (${buffer.length} bytes)` : `Image pixel sample read (${pixelStats?.width || 'unknown'} × ${pixelStats?.height || 'unknown'})`,
      isPdf ? `${trailerCount} PDF revision trailer(s) inspected` : `Pixel edge ratio ${Number(pixelStats?.edgePixelRatio || 0).toFixed(3)}`,
      isPdf ? `${fontCount || 1} embedded font families inspected` : 'No PDF text or font layers present'
    ];
    const analysis = {
      status: tamperingDetected ? 'REVIEW' : 'PASSED',
      anomalyScore: `${score.toFixed(2)} (${score >= 0.5 ? 'High' : score >= 0.2 ? 'Moderate' : 'Low'})`,
      score,
      riskScore: score,
      riskLevel: score >= 0.5 ? 'HIGH' : score >= 0.2 ? 'MEDIUM' : 'LOW',
      tamperingDetected,
      fontConsistency,
      layerInspectionLog,
      findings: tamperingDetected ? [{ code: 'STRUCTURAL_ANOMALY', severity: 'HIGH', description: 'Structural signals require manual inspection.' }] : [],
      modelName: 'Local Stream & Pixel Heuristics',
      isAdvisory: true
    };
    return successResponse(res, { analysis }, 200);
  } catch (err) {
    return next(err);
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
  performTamperCheck,
  getDocumentAnalysis
};

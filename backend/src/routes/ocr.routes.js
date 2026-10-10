const express = require('express');
const ocrController = require('../controllers/ocr.controller');
const { optionalAuthenticateUser, authenticateUser } = require('../middleware/auth');
const { handleDocumentUpload } = require('../middleware/upload');

const router = express.Router();

// Direct document upload and end-to-end OCR + AI tamper analysis (POST /api/analysis/upload)
router.post('/upload', optionalAuthenticateUser, handleDocumentUpload, ocrController.uploadAndAnalyze);

// Execute AI document risk analysis (POST /api/analysis/document)
router.post('/document', optionalAuthenticateUser, ocrController.performDocumentAnalysis);

// Execute OCR text extraction on document (POST /api/analysis/ocr)
router.post('/ocr', optionalAuthenticateUser, ocrController.performOcrAnalysis);

// Retrieve document analysis by documentId (GET /api/analysis/:documentId)
router.get('/:documentId', optionalAuthenticateUser, ocrController.getDocumentAnalysis);

module.exports = router;

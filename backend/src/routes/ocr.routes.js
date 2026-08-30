const express = require('express');
const ocrController = require('../controllers/ocr.controller');
const { optionalAuthenticateUser } = require('../middleware/auth');

const router = express.Router();

// Execute AI document risk analysis (POST /api/analysis/document)
router.post('/document', optionalAuthenticateUser, ocrController.performDocumentAnalysis);

// Execute OCR text extraction on document (POST /api/analysis/ocr)
router.post('/ocr', optionalAuthenticateUser, ocrController.performOcrAnalysis);

// Retrieve document analysis by documentId (GET /api/analysis/:documentId)
router.get('/:documentId', optionalAuthenticateUser, ocrController.getDocumentAnalysis);

module.exports = router;

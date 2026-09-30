const express = require('express');
const documentController = require('../controllers/document.controller');
const { authenticateUser } = require('../middleware/auth');
const { handleDocumentUpload } = require('../middleware/upload');

const router = express.Router();

// All document endpoints require authentication
router.use(authenticateUser);

// Upload document with multi-part parsing and magic bytes validation
router.post('/upload', handleDocumentUpload, documentController.uploadDocument);

// List accessible documents
router.get('/', documentController.listDocuments);

// Get document metadata
router.get('/:id', documentController.getDocument);

// Download document file binary
router.get('/:id/download', documentController.downloadDocument);

module.exports = router;

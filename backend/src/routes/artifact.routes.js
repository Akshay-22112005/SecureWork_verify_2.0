const express = require('express');
const documentController = require('../controllers/document.controller');
const { authenticateUser } = require('../middleware/auth');
const { handleDocumentUpload } = require('../middleware/upload');

const router = express.Router();

router.post('/upload', authenticateUser, handleDocumentUpload, documentController.uploadDocument);

module.exports = router;

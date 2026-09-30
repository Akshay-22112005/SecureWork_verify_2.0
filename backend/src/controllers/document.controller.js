const documentService = require('../services/document.service');
const { successResponse } = require('../utils/response');

/**
 * Handle document upload (POST /api/documents/upload).
 */
async function uploadDocument(req, res, next) {
  try {
    const document = await documentService.ingestDocument(
      {
        file: req.file,
        representationType: req.body.representationType
      },
      req.user
    );
    return successResponse(res, { document }, 201);
  } catch (err) {
    next(err);
  }
}

/**
 * Get document metadata (GET /api/documents/:id).
 */
async function getDocument(req, res, next) {
  try {
    const document = await documentService.getDocumentMetadata(req.params.id, req.user);
    return successResponse(res, { document }, 200);
  } catch (err) {
    next(err);
  }
}

/**
 * Download document binary (GET /api/documents/:id/download).
 */
async function downloadDocument(req, res, next) {
  try {
    const { filePath, document } = await documentService.getDocumentDownload(req.params.id, req.user);
    res.setHeader('Content-Type', document.mimeType);
    return res.download(filePath, document.originalFilename);
  } catch (err) {
    next(err);
  }
}

/**
 * List documents (GET /api/documents).
 */
async function listDocuments(req, res, next) {
  try {
    const documents = await documentService.listDocuments(req.query, req.user);
    return successResponse(res, { documents }, 200);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  uploadDocument,
  getDocument,
  downloadDocument,
  listDocuments
};

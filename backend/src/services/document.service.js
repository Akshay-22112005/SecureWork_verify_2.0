const Document = require('../models/document.model');
const storageService = require('./storage.service');
const auditService = require('./audit.service');
const { validateFileCharacteristics } = require('../utils/fileValidator');
const { sha256 } = require('../utils/crypto');
const { ValidationError, NotFoundError, ForbiddenError } = require('../utils/errors');
const { REPRESENTATION_TYPES } = require('../models/document.model');

/**
 * Document Service
 * Manages document ingestion, cryptographic verification, metadata extraction,
 * and secure download streaming.
 */
class DocumentService {
  /**
   * Check access permissions for a document.
   * Allowed: Owner, ADMIN, AUDITOR, or ISSUER.
   * @param {object} doc
   * @param {object} user
   */
  checkDocumentAccess(doc, user) {
    if (!user) {
      throw new ForbiddenError('Authenticated user required', 'UNAUTHORIZED');
    }
    // Privileged platform roles can access for verification/audit
    if (['ADMIN', 'AUDITOR', 'ISSUER'].includes(user.role)) {
      return true;
    }
    // Document owner
    if (doc.uploadedBy === user.userId) {
      return true;
    }
    throw new ForbiddenError('Access denied: You do not have permission to view or download this document', 'FORBIDDEN');
  }

  /**
   * Ingest an uploaded document.
   * Validates file characteristics, computes server-side SHA-256, stores binary, and records metadata.
   * @param {object} params
   * @param {object} params.file - Multer file object
   * @param {string} [params.representationType]
   * @param {object} user - Authenticated user
   * @returns {Promise<object>} Created Document record
   */
  async ingestDocument({ file, representationType }, user) {
    if (!user || !user.userId) {
      throw new ForbiddenError('Authenticated user required', 'UNAUTHORIZED');
    }

    if (!file || !file.buffer) {
      throw new ValidationError('File payload is missing', 'FILE_REQUIRED');
    }

    // 1. Validate representation type if provided
    let repType = 'ORIGINAL_DIGITAL_FILE';
    if (representationType) {
      if (!REPRESENTATION_TYPES.includes(representationType)) {
        throw new ValidationError(
          `Invalid representationType. Allowed: ${REPRESENTATION_TYPES.join(', ')}`,
          'INVALID_REPRESENTATION_TYPE'
        );
      }
      repType = representationType;
    }

    // 2. Validate magic bytes, extensions, and block executables
    const { detectedMimeType, sanitizedFilename } = validateFileCharacteristics(
      file.buffer,
      file.mimetype,
      file.originalname
    );

    // 3. Store binary securely through StorageAdapter abstraction (calculates authoritative SHA-256)
    const uploadResult = await storageService.uploadFile(
      file.buffer,
      sanitizedFilename,
      detectedMimeType
    );

    // 4. Create document record in database
    const document = await Document.create({
      originalFilename: sanitizedFilename,
      mimeType: detectedMimeType,
      fileSize: uploadResult.fileSize,
      storagePath: uploadResult.storagePath,
      sha256Hash: uploadResult.sha256Hash,
      hashAlgorithm: 'SHA-256',
      uploadedBy: user.userId,
      representationType: repType
    });

    // 5. Record audit trail event
    await auditService.recordEvent(
      user.userId,
      user.role,
      'DOCUMENT_INGESTED',
      document.documentId,
      {
        originalFilename: sanitizedFilename,
        mimeType: detectedMimeType,
        fileSize: uploadResult.fileSize,
        sha256Hash: uploadResult.sha256Hash,
        representationType: repType
      }
    );

    return document.toJSON();
  }

  /**
   * Retrieve document metadata by documentId.
   * @param {string} documentId
   * @param {object} user
   * @returns {Promise<object>}
   */
  async getDocumentMetadata(documentId, user) {
    if (!documentId) {
      throw new ValidationError('Document identifier is required');
    }

    let doc = await Document.findOne({
      $or: [
        { documentId },
        { _id: documentId.match(/^[0-9a-fA-F]{24}$/) ? documentId : null }
      ]
    });

    if (!doc) {
      throw new NotFoundError('Document not found', 'DOCUMENT_NOT_FOUND');
    }

    this.checkDocumentAccess(doc, user);

    return doc.toJSON();
  }

  /**
   * Get validated download path for streaming file.
   * @param {string} documentId
   * @param {object} user
   * @returns {Promise<{ filePath: string, document: object }>}
   */
  async getDocumentDownload(documentId, user) {
    const docMeta = await this.getDocumentMetadata(documentId, user);
    const filePath = await storageService.getDownloadPath(docMeta.storagePath);
    return {
      filePath,
      document: docMeta
    };
  }

  /**
   * Verify on-disk file integrity against stored SHA-256 hash.
   * @param {string} documentId
   * @returns {Promise<{ matches: boolean, expectedHash: string, calculatedHash: string }>}
   */
  async verifyDocumentIntegrity(documentId) {
    const doc = await Document.findOne({ documentId });
    if (!doc) {
      throw new NotFoundError('Document not found', 'DOCUMENT_NOT_FOUND');
    }

    const fileBuffer = await storageService.getFile(doc.storagePath);
    const calculatedHash = sha256(fileBuffer);
    const matches = calculatedHash === doc.sha256Hash;

    return {
      matches,
      expectedHash: doc.sha256Hash,
      calculatedHash
    };
  }

  /**
   * List uploaded documents accessible to the current user.
   * @param {object} [filters={}]
   * @param {object} user
   * @returns {Promise<object[]>}
   */
  async listDocuments(filters = {}, user) {
    if (!user) {
      throw new ForbiddenError('Authenticated user required', 'UNAUTHORIZED');
    }

    const query = {};
    if (!['ADMIN', 'AUDITOR', 'ISSUER'].includes(user.role)) {
      query.uploadedBy = user.userId;
    }

    if (filters.representationType) {
      query.representationType = filters.representationType;
    }

    const limit = Math.min(Math.max(parseInt(filters.limit, 10) || 20, 1), 100);
    const documents = await Document.find(query).sort({ createdAt: -1 }).limit(limit);

    return documents.map((doc) => doc.toJSON());
  }
}

module.exports = new DocumentService();

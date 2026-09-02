const multer = require('multer');
const { ValidationError } = require('../utils/errors');
const { MAX_FILE_SIZE_BYTES } = require('../utils/fileValidator');

// Use memory storage for in-memory magic bytes and security validation
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 2
  }
});

/**
 * Middleware handling single document upload under field name "file" or "document".
 */
const documentUploadFields = upload.fields([
  { name: 'file', maxCount: 1 },
  { name: 'document', maxCount: 1 }
]);

function handleDocumentUpload(req, res, next) {
  documentUploadFields(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return next(
          new ValidationError(
            'Uploaded file exceeds the maximum permitted size of 10 MB',
            'FILE_TOO_LARGE'
          )
        );
      }
      return next(new ValidationError(err.message, 'UPLOAD_ERROR'));
    }

    // Normalize attached file from either 'file' or 'document' field
    const attachedFile = (req.files?.file && req.files.file[0]) ||
                         (req.files?.document && req.files.document[0]);

    if (!attachedFile) {
      return next(new ValidationError('No file was attached to the upload request', 'FILE_REQUIRED'));
    }

    req.file = attachedFile;
    next();
  });
}

module.exports = {
  handleDocumentUpload
};

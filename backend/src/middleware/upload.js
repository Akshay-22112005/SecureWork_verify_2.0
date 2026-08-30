const multer = require('multer');
const { ValidationError } = require('../utils/errors');
const { MAX_FILE_SIZE_BYTES } = require('../utils/fileValidator');

// Use memory storage for in-memory magic bytes and security validation
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE_BYTES,
    files: 1
  }
});

/**
 * Middleware handling single document upload under field name "file" or "document".
 */
function handleDocumentUpload(req, res, next) {
  const singleUpload = upload.single('file');

  singleUpload(req, res, (err) => {
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

    if (!req.file) {
      return next(new ValidationError('No file was attached to the upload request', 'FILE_REQUIRED'));
    }

    next();
  });
}

module.exports = {
  handleDocumentUpload
};

const path = require('path');
const { ValidationError } = require('./errors');

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

const ALLOWED_EXTENSIONS = ['.pdf', '.png', '.jpg', '.jpeg'];

/**
 * Inspect buffer magic bytes to determine actual file type.
 * @param {Buffer} buffer
 * @returns {string | null} Detected MIME type or null
 */
function detectMagicBytes(buffer) {
  if (!buffer || buffer.length < 4) return null;

  // PDF check: %PDF (0x25 0x50 0x44 0x46)
  if (
    buffer[0] === 0x25 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x44 &&
    buffer[3] === 0x46
  ) {
    return 'application/pdf';
  }

  // PNG check: 0x89 0x50 0x4E 0x47 0x0D 0x0A 0x1A 0x0A
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4E &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png';
  }

  // JPEG / JPG check: 0xFF 0xD8 0xFF
  if (
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return 'image/jpeg';
  }

  return null;
}

/**
 * Check if buffer contains executable signatures.
 * @param {Buffer} buffer
 * @returns {boolean} True if executable patterns detected
 */
function isExecutable(buffer) {
  if (!buffer || buffer.length < 2) return false;

  // Windows PE: 'MZ' (0x4D 0x5A)
  if (buffer[0] === 0x4d && buffer[1] === 0x5a) {
    return true;
  }

  // Linux ELF: 0x7F 'ELF' (0x7F 0x45 0x4C 0x46)
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x7f &&
    buffer[1] === 0x45 &&
    buffer[2] === 0x4c &&
    buffer[3] === 0x46
  ) {
    return true;
  }

  // Script shebang: '#!' (0x23 0x21)
  if (buffer[0] === 0x23 && buffer[1] === 0x21) {
    return true;
  }

  return false;
}

/**
 * Sanitize filename to prevent directory traversal and injection.
 * @param {string} rawFilename
 * @returns {string} Safe filename
 */
function sanitizeFilename(rawFilename) {
  if (!rawFilename || typeof rawFilename !== 'string') {
    return 'unnamed_document';
  }

  // Strip path traversal attempts and separators
  const basename = path.basename(rawFilename);
  const clean = basename.replace(/[^a-zA-Z0-9._-]/g, '_');
  return clean || 'unnamed_document';
}

/**
 * Comprehensive validation of uploaded file characteristics.
 * Verifies size, extension, magic bytes, and blocks executables.
 * @param {Buffer} buffer
 * @param {string} declaredMimeType
 * @param {string} originalFilename
 * @returns {{ detectedMimeType: string, sanitizedFilename: string }}
 */
function validateFileCharacteristics(buffer, declaredMimeType, originalFilename) {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new ValidationError('File payload is empty or invalid', 'INVALID_FILE');
  }

  // 1. Size Validation
  if (buffer.length === 0) {
    throw new ValidationError('Uploaded file is empty (0 bytes)', 'FILE_EMPTY');
  }

  if (buffer.length > MAX_FILE_SIZE_BYTES) {
    throw new ValidationError(
      `File exceeds maximum permitted size of 10 MB (${buffer.length} bytes)`,
      'FILE_TOO_LARGE'
    );
  }

  // 2. Executable Blocking
  if (isExecutable(buffer)) {
    throw new ValidationError(
      'Executable files and binary scripts are strictly prohibited for security',
      'EXECUTABLE_PROHIBITED'
    );
  }

  // 3. Magic Bytes Inspection (Authoritative characteristic check)
  const detectedMimeType = detectMagicBytes(buffer);
  if (!detectedMimeType) {
    throw new ValidationError(
      'Unsupported file format. Only PDF, PNG, and JPG/JPEG files are accepted.',
      'UNSUPPORTED_FILE_TYPE'
    );
  }

  // 4. Filename & Extension Sanitization
  const safeFilename = sanitizeFilename(originalFilename);
  const ext = path.extname(safeFilename).toLowerCase();
  if (ext && !ALLOWED_EXTENSIONS.includes(ext)) {
    throw new ValidationError(
      `File extension "${ext}" is not permitted. Allowed: .pdf, .png, .jpg, .jpeg`,
      'UNSUPPORTED_FILE_EXTENSION'
    );
  }

  return {
    detectedMimeType,
    sanitizedFilename: safeFilename
  };
}

module.exports = {
  detectMagicBytes,
  isExecutable,
  sanitizeFilename,
  validateFileCharacteristics,
  MAX_FILE_SIZE_BYTES
};

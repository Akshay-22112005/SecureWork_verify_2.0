const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const StorageAdapter = require('./storage.adapter');
const env = require('../../config/env');
const { sha256 } = require('../../utils/crypto');
const logger = require('../../utils/logger');
const { ValidationError, NotFoundError } = require('../../utils/errors');

/**
 * Local File System Storage Adapter
 * Stores documents within backend/storage/documents/ with full path traversal protection.
 */
class LocalStorageAdapter extends StorageAdapter {
  constructor(storageDir = env.STORAGE_PATH, tempDir = env.TEMP_STORAGE_PATH) {
    super();
    this.storageDir = path.resolve(storageDir);
    this.tempDir = path.resolve(tempDir);
    this.ensureDirectories();
  }

  /**
   * Ensure storage and temp directories exist.
   */
  ensureDirectories() {
    try {
      if (!fs.existsSync(this.storageDir)) {
        fs.mkdirSync(this.storageDir, { recursive: true, mode: 0o750 });
      }
      if (!fs.existsSync(this.tempDir)) {
        fs.mkdirSync(this.tempDir, { recursive: true, mode: 0o750 });
      }
    } catch (err) {
      logger.error('Failed to initialize storage directories', {
        error: err.message,
        storageDir: this.storageDir,
        tempDir: this.tempDir
      });
    }
  }

  /**
   * Sanitize storage key and resolve absolute path within storageDir.
   * Strictly blocks directory traversal.
   * @param {string} storageKey
   * @returns {string} Absolute path strictly inside storageDir
   */
  resolvePath(storageKey) {
    if (!storageKey || typeof storageKey !== 'string') {
      throw new ValidationError('Invalid storage path reference');
    }

    // Prohibit traversal sequences
    if (storageKey.includes('..') || storageKey.includes('/') || storageKey.includes('\\')) {
      // If it contains separators, ensure it's strictly a basename
      const base = path.basename(storageKey);
      if (base !== storageKey) {
        throw new ValidationError('Path traversal attempt detected in storage key', 'PATH_TRAVERSAL_PROHIBITED');
      }
    }

    const safeKey = path.basename(storageKey);
    const resolved = path.resolve(this.storageDir, safeKey);

    // Verify resolved path strictly starts with storageDir
    if (!resolved.startsWith(this.storageDir)) {
      throw new ValidationError('Path traversal attempt detected', 'PATH_TRAVERSAL_PROHIBITED');
    }

    return resolved;
  }

  /**
   * Store file buffer.
   * Computes authoritative SHA-256 hash server-side.
   * @param {Buffer} fileBuffer
   * @param {string} originalFilename
   * @param {string} mimeType
   * @returns {Promise<{ storagePath: string, fileSize: number, sha256Hash: string }>}
   */
  async uploadFile(fileBuffer, originalFilename, mimeType) {
    this.ensureDirectories();

    if (!fileBuffer || !Buffer.isBuffer(fileBuffer)) {
      throw new ValidationError('Invalid file buffer provided');
    }

    // 1. Calculate authoritative server-side SHA-256
    const sha256Hash = sha256(fileBuffer);
    const fileSize = fileBuffer.length;

    // 2. Generate random unique stored filename to prevent collisions and execution
    const ext = path.extname(originalFilename).toLowerCase() || (mimeType === 'application/pdf' ? '.pdf' : '.bin');
    const storageKey = `${sha256Hash.slice(0, 16)}_${crypto.randomBytes(8).toString('hex')}${ext}`;
    const destinationPath = path.join(this.storageDir, storageKey);

    // 3. Write file
    await fs.promises.writeFile(destinationPath, fileBuffer, { mode: 0o640 });

    return {
      storagePath: storageKey,
      fileSize,
      sha256Hash
    };
  }

  /**
   * Read file buffer.
   * @param {string} storagePath
   * @returns {Promise<Buffer>}
   */
  async getFile(storagePath) {
    const filePath = this.resolvePath(storagePath);
    try {
      return await fs.promises.readFile(filePath);
    } catch (err) {
      if (err.code === 'ENOENT') {
        throw new NotFoundError('Stored document file not found on disk', 'FILE_NOT_FOUND');
      }
      throw err;
    }
  }

  /**
   * Get validated local filesystem path for Express download streaming.
   * @param {string} storagePath
   * @returns {Promise<string>} Validated absolute filesystem path
   */
  async getDownloadPath(storagePath) {
    const filePath = this.resolvePath(storagePath);
    try {
      await fs.promises.access(filePath, fs.constants.R_OK);
      return filePath;
    } catch {
      throw new NotFoundError('Stored document file not found for download', 'FILE_NOT_FOUND');
    }
  }

  /**
   * Delete file from storage.
   * @param {string} storagePath
   * @returns {Promise<boolean>}
   */
  async deleteFile(storagePath) {
    try {
      const filePath = this.resolvePath(storagePath);
      await fs.promises.unlink(filePath);
      return true;
    } catch (err) {
      if (err.code === 'ENOENT') return false;
      throw err;
    }
  }
}

module.exports = LocalStorageAdapter;

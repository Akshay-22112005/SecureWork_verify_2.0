const { storageAdapter } = require('./storage');

/**
 * Storage Service Facade
 * Provides high-level interface for document binary management.
 * Strictly encapsulates filesystem operations behind the StorageAdapter abstraction.
 */
class StorageService {
  /**
   * Save file buffer to storage.
   * @param {Buffer} fileBuffer
   * @param {string} originalFilename
   * @param {string} mimeType
   * @returns {Promise<{ storagePath: string, fileSize: number, sha256Hash: string }>}
   */
  async uploadFile(fileBuffer, originalFilename, mimeType) {
    return storageAdapter.uploadFile(fileBuffer, originalFilename, mimeType);
  }

  /**
   * Retrieve file buffer.
   * @param {string} storagePath
   * @returns {Promise<Buffer>}
   */
  async getFile(storagePath) {
    return storageAdapter.getFile(storagePath);
  }

  /**
   * Delete file from storage.
   * @param {string} storagePath
   * @returns {Promise<boolean>}
   */
  async deleteFile(storagePath) {
    return storageAdapter.deleteFile(storagePath);
  }

  /**
   * Get validated local filesystem path for Express download streaming.
   * @param {string} storagePath
   * @returns {Promise<string>}
   */
  async getDownloadPath(storagePath) {
    return storageAdapter.getDownloadPath(storagePath);
  }
}

module.exports = new StorageService();

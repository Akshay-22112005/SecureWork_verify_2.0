/**
 * Storage Adapter Interface
 * Abstract contract for storing and retrieving document binaries.
 * Enables zero-coupling transition between local filesystem, MinIO, S3, or Azure Blob Storage.
 */
class StorageAdapter {
  /**
   * Store a file payload.
   * @param {Buffer} fileBuffer - File binary buffer
   * @param {string} originalFilename - Sanitized original filename
   * @param {string} mimeType - Validated MIME type
   * @returns {Promise<{ storagePath: string, fileSize: number, sha256Hash: string }>}
   */
  async uploadFile(fileBuffer, originalFilename, mimeType) {
    throw new Error('uploadFile must be implemented by storage adapter');
  }

  /**
   * Retrieve file buffer.
   * @param {string} storagePath - Relative storage pointer
   * @returns {Promise<Buffer>}
   */
  async getFile(storagePath) {
    throw new Error('getFile must be implemented by storage adapter');
  }

  /**
   * Delete file from storage.
   * @param {string} storagePath - Relative storage pointer
   * @returns {Promise<boolean>}
   */
  async deleteFile(storagePath) {
    throw new Error('deleteFile must be implemented by storage adapter');
  }

  /**
   * Get validated local filesystem path for download streaming.
   * @param {string} storagePath - Relative storage pointer
   * @returns {Promise<string>} Validated absolute filesystem path
   */
  async getDownloadPath(storagePath) {
    throw new Error('getDownloadPath must be implemented by storage adapter');
  }
}

module.exports = StorageAdapter;

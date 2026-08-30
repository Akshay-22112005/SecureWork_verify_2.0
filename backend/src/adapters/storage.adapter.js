/**
 * Storage Adapter Interface
 * Enables zero-cost local filesystem storage in development
 * and swappable MinIO/S3 object storage in production.
 */

class StorageAdapter {
  async save(key, data, options = {}) {
    throw new Error('Method not implemented');
  }

  async get(key) {
    throw new Error('Method not implemented');
  }

  async delete(key) {
    throw new Error('Method not implemented');
  }

  async exists(key) {
    throw new Error('Method not implemented');
  }
}

class LocalStorageAdapter extends StorageAdapter {
  constructor(basePath) {
    super();
    this.basePath = basePath;
  }
  // Detailed implementation planned for Phase 2
}

module.exports = {
  StorageAdapter,
  LocalStorageAdapter
};

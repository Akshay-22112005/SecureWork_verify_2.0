const fs = require('fs');
const path = require('path');
const KeyStorageAdapter = require('./keyStorage.adapter');
const env = require('../../config/env');
const logger = require('../../utils/logger');

/**
 * Local File System Key Storage Adapter
 * Implements protected local key-storage abstraction for development and on-premise deployments.
 */
class LocalKeyStorageAdapter extends KeyStorageAdapter {
  constructor(storageDir = env.KEY_STORAGE_PATH) {
    super();
    this.storageDir = path.resolve(storageDir);
    this.ensureStorageDirectory();
  }

  /**
   * Ensure directory exists with secure permissions.
   */
  ensureStorageDirectory() {
    try {
      if (!fs.existsSync(this.storageDir)) {
        fs.mkdirSync(this.storageDir, { recursive: true, mode: 0o700 });
      }
    } catch (err) {
      logger.error('Failed to initialize key storage directory', {
        error: err.message,
        path: this.storageDir
      });
    }
  }

  /**
   * Sanitize and resolve secure path for key file.
   * Protects against directory traversal.
   * @param {string} keyId
   * @returns {string} Absolute path to key file
   */
  resolveKeyPath(keyId) {
    if (!keyId || typeof keyId !== 'string') {
      throw new Error('Invalid key identifier');
    }

    // Strict validation: keyId must be alphanumeric, dashes, or underscores only
    if (!/^[a-zA-Z0-9_-]+$/.test(keyId)) {
      throw new Error('Access denied: invalid key identifier or path traversal attempt');
    }

    const keyPath = path.resolve(this.storageDir, `${keyId}.key`);
    // Ensure resolved path is strictly within storageDir
    if (!keyPath.startsWith(this.storageDir)) {
      throw new Error('Access denied: key path traversal attempt');
    }

    return keyPath;
  }

  /**
   * Store private key in local storage.
   * @param {string} keyId
   * @param {string} privateKeyPem
   * @returns {Promise<string>} Reference pointer
   */
  async storePrivateKey(keyId, privateKeyPem) {
    this.ensureStorageDirectory();
    const keyPath = this.resolveKeyPath(keyId);

    // Save with restrictive permissions (0600: read/write by owner only)
    await fs.promises.writeFile(keyPath, privateKeyPem.trim() + '\n', {
      encoding: 'utf8',
      mode: 0o600
    });

    return `local:${keyId}`;
  }

  /**
   * Retrieve private key from local storage.
   * @param {string} keyId
   * @returns {Promise<string>}
   */
  async getPrivateKey(keyId) {
    const keyPath = this.resolveKeyPath(keyId);
    try {
      return await fs.promises.readFile(keyPath, 'utf8');
    } catch (err) {
      if (err.code === 'ENOENT') {
        throw new Error(`Private key reference not found for key: ${keyId}`);
      }
      throw new Error(`Failed to read private key for key: ${keyId}`);
    }
  }

  /**
   * Check if private key exists in local storage.
   * @param {string} keyId
   * @returns {Promise<boolean>}
   */
  async hasPrivateKey(keyId) {
    try {
      const keyPath = this.resolveKeyPath(keyId);
      await fs.promises.access(keyPath, fs.constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Delete private key from local storage.
   * @param {string} keyId
   * @returns {Promise<boolean>}
   */
  async deletePrivateKey(keyId) {
    try {
      const keyPath = this.resolveKeyPath(keyId);
      await fs.promises.unlink(keyPath);
      return true;
    } catch {
      return false;
    }
  }
}

module.exports = LocalKeyStorageAdapter;

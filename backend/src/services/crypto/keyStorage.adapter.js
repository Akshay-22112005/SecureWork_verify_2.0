/**
 * Key Storage Adapter Interface
 * Abstract contract for storing and retrieving private cryptographic keys.
 * Enables seamless portability between local filesystem, AWS KMS, HashiCorp Vault, and HSMs.
 */
class KeyStorageAdapter {
  /**
   * Store a private key.
   * @param {string} keyId - Unique key identifier
   * @param {string} privateKeyPem - Private key in PEM format
   * @returns {Promise<string>} Reference pointer to the stored key
   */
  async storePrivateKey(keyId, privateKeyPem) {
    throw new Error('storePrivateKey must be implemented by adapter');
  }

  /**
   * Retrieve a private key.
   * @param {string} keyId - Unique key identifier
   * @returns {Promise<string>} Private key in PEM format
   */
  async getPrivateKey(keyId) {
    throw new Error('getPrivateKey must be implemented by adapter');
  }

  /**
   * Check if a private key exists.
   * @param {string} keyId - Unique key identifier
   * @returns {Promise<boolean>}
   */
  async hasPrivateKey(keyId) {
    throw new Error('hasPrivateKey must be implemented by adapter');
  }

  /**
   * Delete a private key (for emergency shredding if requested).
   * @param {string} keyId - Unique key identifier
   * @returns {Promise<boolean>}
   */
  async deletePrivateKey(keyId) {
    throw new Error('deletePrivateKey must be implemented by adapter');
  }
}

module.exports = KeyStorageAdapter;

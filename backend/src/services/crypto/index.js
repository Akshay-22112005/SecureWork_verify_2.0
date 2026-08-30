const LocalKeyStorageAdapter = require('./localKeyStorage.adapter');
const cryptoUtils = require('../../utils/crypto');

// Singleton instance of key storage adapter for the application
const defaultKeyStorage = new LocalKeyStorageAdapter();

module.exports = {
  keyStorage: defaultKeyStorage,
  LocalKeyStorageAdapter,
  ...cryptoUtils
};

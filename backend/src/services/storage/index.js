const LocalStorageAdapter = require('./localStorage.adapter');

// Singleton instance of active storage adapter
const defaultStorageAdapter = new LocalStorageAdapter();

function getStorageAdapter() {
  return defaultStorageAdapter;
}

module.exports = {
  storageAdapter: defaultStorageAdapter,
  getStorageAdapter,
  LocalStorageAdapter
};

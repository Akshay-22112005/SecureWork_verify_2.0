const StorageAdapter = require('../services/storage/storage.adapter');
const LocalStorageAdapter = require('../services/storage/localStorage.adapter');
const CloudinaryAdapter = require('../services/storage/cloudinary.adapter');

module.exports = {
  StorageAdapter,
  LocalStorageAdapter,
  CloudinaryAdapter
};

const LocalStorageAdapter = require('./localStorage.adapter');
const CloudinaryAdapter = require('./cloudinary.adapter');
const env = require('../../config/env');

let activeStorageAdapter;
if (env.STORAGE_DRIVER === 'cloudinary') {
  activeStorageAdapter = new CloudinaryAdapter();
} else {
  activeStorageAdapter = new LocalStorageAdapter();
}

function getStorageAdapter() {
  return activeStorageAdapter;
}

module.exports = {
  storageAdapter: activeStorageAdapter,
  getStorageAdapter,
  LocalStorageAdapter,
  CloudinaryAdapter
};

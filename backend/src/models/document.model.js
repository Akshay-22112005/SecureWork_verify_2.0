const crypto = require('crypto');
const mongoose = require('mongoose');
const baseModelPlugin = require('./plugins/baseModel.plugin');

const SUPPORTED_MIME_TYPES = ['application/pdf', 'image/png', 'image/jpeg'];
const REPRESENTATION_TYPES = [
  'ORIGINAL_DIGITAL_FILE',
  'PDF',
  'IMAGE',
  'SCAN',
  'SCREENSHOT',
  'OTHER'
];

const DocumentSchema = new mongoose.Schema({
  documentId: {
    type: String,
    required: true,
    unique: true,
    index: true,
    default: () => `doc_${crypto.randomBytes(8).toString('hex')}`
  },
  originalFilename: {
    type: String,
    required: [true, 'Original filename is required'],
    trim: true
  },
  mimeType: {
    type: String,
    enum: SUPPORTED_MIME_TYPES,
    required: [true, 'Valid MIME type is required'],
    index: true
  },
  fileSize: {
    type: Number,
    required: [true, 'File size is required'],
    max: [10 * 1024 * 1024, 'File size cannot exceed 10 MB']
  },
  storagePath: {
    type: String,
    required: [true, 'Storage path reference is required']
  },
  sha256Hash: {
    type: String,
    required: [true, 'SHA-256 hash is required'],
    match: [/^[a-f0-9]{64}$/, 'Invalid SHA-256 hash format'],
    index: true
  },
  hashAlgorithm: {
    type: String,
    default: 'SHA-256'
  },
  uploadedBy: {
    type: String,
    required: [true, 'Uploader user ID is required'],
    index: true
  },
  representationType: {
    type: String,
    enum: REPRESENTATION_TYPES,
    default: 'ORIGINAL_DIGITAL_FILE',
    index: true
  }
});

DocumentSchema.pre('validate', function (next) {
  if (!this.documentId) {
    this.documentId = `doc_${crypto.randomBytes(8).toString('hex')}`;
  }
  next();
});

DocumentSchema.plugin(baseModelPlugin);

const Document = mongoose.models.Document || mongoose.model('Document', DocumentSchema);

module.exports = Document;
module.exports.SUPPORTED_MIME_TYPES = SUPPORTED_MIME_TYPES;
module.exports.REPRESENTATION_TYPES = REPRESENTATION_TYPES;

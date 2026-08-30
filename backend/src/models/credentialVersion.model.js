const crypto = require('crypto');
const mongoose = require('mongoose');
const baseModelPlugin = require('./plugins/baseModel.plugin');

const VERSION_STATUSES = ['ACTIVE', 'SUPERSEDED', 'REVOKED'];

const CredentialVersionSchema = new mongoose.Schema({
  versionId: {
    type: String,
    required: true,
    unique: true,
    index: true,
    default: () => `ver_${crypto.randomBytes(8).toString('hex')}`
  },
  credentialId: {
    type: String,
    required: [true, 'Credential ID is required'],
    index: true
  },
  versionNumber: {
    type: Number,
    required: [true, 'Version number is required'],
    default: 1
  },
  documentId: {
    type: String,
    required: [true, 'Document ID is required'],
    index: true
  },
  documentHash: {
    type: String,
    required: [true, 'Document SHA-256 hash is required']
  },
  signature: {
    type: String,
    required: [true, 'Cryptographic signature is required']
  },
  issuerKeyId: {
    type: String,
    required: [true, 'Issuer key ID is required'],
    index: true
  },
  signedPayload: {
    type: mongoose.Schema.Types.Mixed,
    required: [true, 'Canonical signed payload is required']
  },
  issuedAt: {
    type: Date,
    default: Date.now
  },
  supersedesVersionId: {
    type: String,
    default: null
  },
  changeReason: {
    type: String,
    default: null
  },
  status: {
    type: String,
    enum: VERSION_STATUSES,
    default: 'ACTIVE',
    index: true
  }
});

CredentialVersionSchema.pre('validate', function (next) {
  if (!this.versionId) {
    this.versionId = `ver_${crypto.randomBytes(8).toString('hex')}`;
  }
  next();
});

CredentialVersionSchema.plugin(baseModelPlugin);

const CredentialVersion =
  mongoose.models.CredentialVersion ||
  mongoose.model('CredentialVersion', CredentialVersionSchema);

module.exports = CredentialVersion;
module.exports.VERSION_STATUSES = VERSION_STATUSES;

const crypto = require('crypto');
const mongoose = require('mongoose');
const baseModelPlugin = require('./plugins/baseModel.plugin');

const CREDENTIAL_STATUSES = ['ACTIVE', 'REVOKED', 'EXPIRED', 'SUPERSEDED'];
const CREDENTIAL_TYPES = [
  'DEGREE',
  'EMPLOYMENT_VERIFICATION',
  'CERTIFICATION',
  'LICENSE',
  'SECURITY_CLEARANCE',
  'OTHER'
];

const CredentialSchema = new mongoose.Schema({
  credentialId: {
    type: String,
    required: true,
    unique: true,
    index: true,
    default: () => `crd_${crypto.randomBytes(8).toString('hex')}`
  },
  organizationId: {
    type: String,
    required: [true, 'Organization ID is required'],
    index: true
  },
  issuerId: {
    type: String,
    required: [true, 'Issuer ID is required'],
    index: true
  },
  recipientId: {
    type: String,
    required: [true, 'Recipient ID is required'],
    index: true
  },
  credentialType: {
    type: String,
    enum: CREDENTIAL_TYPES,
    required: [true, 'Credential type is required'],
    index: true
  },
  title: {
    type: String,
    trim: true,
    default: 'Workforce Credential'
  },
  currentVersionId: {
    type: String,
    default: null,
    index: true
  },
  currentVersionNumber: {
    type: Number,
    default: 1
  },
  issuedAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    default: null
  },
  status: {
    type: String,
    enum: CREDENTIAL_STATUSES,
    default: 'ACTIVE',
    index: true
  },
  revokedAt: {
    type: Date,
    default: null
  },
  revocationReason: {
    type: String,
    default: null
  }
});

CredentialSchema.pre('validate', function (next) {
  if (!this.credentialId) {
    this.credentialId = `crd_${crypto.randomBytes(8).toString('hex')}`;
  }
  next();
});

CredentialSchema.plugin(baseModelPlugin);

const Credential = mongoose.models.Credential || mongoose.model('Credential', CredentialSchema);

module.exports = Credential;
module.exports.CREDENTIAL_STATUSES = CREDENTIAL_STATUSES;
module.exports.CREDENTIAL_TYPES = CREDENTIAL_TYPES;

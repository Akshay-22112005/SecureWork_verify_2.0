const crypto = require('crypto');
const mongoose = require('mongoose');
const baseModelPlugin = require('./plugins/baseModel.plugin');

const KEY_STATUSES = ['ACTIVE', 'RETIRED', 'COMPROMISED', 'REVOKED'];
const SUPPORTED_ALGORITHMS = ['ED25519'];

const IssuerKeySchema = new mongoose.Schema({
  issuerId: {
    type: String,
    required: [true, 'Issuer ID is required'],
    index: true
  },
  keyId: {
    type: String,
    required: true,
    unique: true,
    index: true,
    default: () => `key_${crypto.randomBytes(8).toString('hex')}`
  },
  algorithm: {
    type: String,
    enum: SUPPORTED_ALGORITHMS,
    default: 'ED25519',
    required: true
  },
  publicKey: {
    type: String,
    required: [true, 'Public key (PEM) is required']
  },
  // Private key pointer: NEVER contains raw private key material!
  privateKeyReference: {
    type: String,
    required: [true, 'Private key reference is required'],
    select: false // Do not include by default in queries
  },
  status: {
    type: String,
    enum: KEY_STATUSES,
    default: 'ACTIVE',
    index: true
  },
  activatedAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    default: () => new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
    index: true
  },
  retiredAt: {
    type: Date,
    default: null
  },
  compromisedAt: {
    type: Date,
    default: null
  },
  revokedAt: {
    type: Date,
    default: null
  },
  statusReason: {
    type: String,
    default: null
  }
});

IssuerKeySchema.pre('validate', function (next) {
  if (!this.keyId) {
    this.keyId = `key_${crypto.randomBytes(8).toString('hex')}`;
  }
  next();
});

IssuerKeySchema.plugin(baseModelPlugin);

const IssuerKey = mongoose.models.IssuerKey || mongoose.model('IssuerKey', IssuerKeySchema);

module.exports = IssuerKey;
module.exports.KEY_STATUSES = KEY_STATUSES;
module.exports.SUPPORTED_ALGORITHMS = SUPPORTED_ALGORITHMS;

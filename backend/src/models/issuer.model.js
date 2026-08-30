const crypto = require('crypto');
const mongoose = require('mongoose');
const baseModelPlugin = require('./plugins/baseModel.plugin');

const ISSUER_STATUSES = ['PENDING', 'ACTIVE', 'SUSPENDED', 'REVOKED'];

const IssuerSchema = new mongoose.Schema({
  issuerId: {
    type: String,
    required: true,
    unique: true,
    index: true,
    default: () => `iss_${crypto.randomBytes(8).toString('hex')}`
  },
  issuerCode: {
    type: String,
    required: [true, 'Issuer code is required'],
    unique: true,
    uppercase: true,
    trim: true,
    index: true
  },
  userId: {
    type: String,
    required: [true, 'User ID is required'],
    unique: true, // Exactly one issuer profile per user
    index: true
  },
  organizationId: {
    type: String,
    required: [true, 'Organization ID is required'],
    index: true
  },
  authorizationEvidence: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  status: {
    type: String,
    enum: ISSUER_STATUSES,
    default: 'PENDING',
    index: true
  },
  approvedBy: {
    type: String,
    default: null
  },
  approvedAt: {
    type: Date,
    default: null
  }
});

IssuerSchema.pre('validate', function (next) {
  if (!this.issuerId) {
    this.issuerId = `iss_${crypto.randomBytes(8).toString('hex')}`;
  }
  if (!this.issuerCode) {
    this.issuerCode = `ISS_${crypto.randomBytes(6).toString('hex').toUpperCase()}`;
  }
  next();
});

IssuerSchema.plugin(baseModelPlugin);

const Issuer = mongoose.models.Issuer || mongoose.model('Issuer', IssuerSchema);

module.exports = Issuer;
module.exports.ISSUER_STATUSES = ISSUER_STATUSES;

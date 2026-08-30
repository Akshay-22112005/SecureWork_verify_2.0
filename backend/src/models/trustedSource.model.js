const mongoose = require('mongoose');
const baseModelPlugin = require('./plugins/baseModel.plugin');

const SOURCE_TYPES = ['OFFICIAL_WEBSITE', 'VERIFICATION_PORTAL', 'API', 'DOCUMENT_REPOSITORY'];
const SOURCE_STATUSES = ['PENDING', 'ACTIVE', 'SUSPENDED', 'REVOKED'];
const VERIFICATION_STATUSES = ['PENDING', 'VERIFIED', 'FAILED'];

const TrustedSourceSchema = new mongoose.Schema({
  sourceCode: {
    type: String,
    required: [true, 'Source code is required'],
    unique: true,
    uppercase: true,
    trim: true,
    index: true
  },
  organizationId: {
    type: String,
    required: [true, 'Organization ID is required'],
    index: true
  },
  name: {
    type: String,
    required: [true, 'Source name is required'],
    trim: true
  },
  sourceType: {
    type: String,
    enum: SOURCE_TYPES,
    required: [true, 'Source type is required'],
    index: true
  },
  baseUrl: {
    type: String,
    required: [true, 'Base URL is required'],
    trim: true
  },
  verificationEndpoint: {
    type: String,
    default: '/verify',
    trim: true
  },
  domain: {
    type: String,
    required: [true, 'Domain is required'],
    lowercase: true,
    trim: true,
    index: true
  },
  verificationMethod: {
    type: String,
    default: 'ADMIN_REVIEW'
  },
  verificationStatus: {
    type: String,
    enum: VERIFICATION_STATUSES,
    default: 'PENDING',
    index: true
  },
  verifiedBy: {
    type: String,
    default: null
  },
  verifiedAt: {
    type: Date,
    default: null
  },
  lastCheckedAt: {
    type: Date,
    default: null
  },
  status: {
    type: String,
    enum: SOURCE_STATUSES,
    default: 'PENDING',
    index: true
  }
});

// Auto-extract and normalize canonical domain from baseUrl before saving
TrustedSourceSchema.pre('validate', function (next) {
  if (this.baseUrl) {
    try {
      const parsed = new URL(this.baseUrl);
      if (!this.domain) {
        this.domain = parsed.hostname.toLowerCase();
      }
    } catch {
      // Allow fallback if not full URL
    }
  }
  next();
});

TrustedSourceSchema.plugin(baseModelPlugin);

const TrustedSource = mongoose.models.TrustedSource || mongoose.model('TrustedSource', TrustedSourceSchema);

module.exports = TrustedSource;
module.exports.SOURCE_TYPES = SOURCE_TYPES;
module.exports.SOURCE_STATUSES = SOURCE_STATUSES;
module.exports.VERIFICATION_STATUSES = VERIFICATION_STATUSES;

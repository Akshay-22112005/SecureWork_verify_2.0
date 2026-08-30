const crypto = require('crypto');
const mongoose = require('mongoose');
const baseModelPlugin = require('./plugins/baseModel.plugin');
const { TRUST_LEVELS, RESULT_TYPES } = require('../services/verification/verificationConstants');

const CRYPTOGRAPHIC_STATUSES = ['PASSED', 'FAILED', 'NOT_APPLICABLE'];
const HUMAN_VERIFICATION_STATUSES = ['PENDING', 'CONFIRMED', 'REJECTED', 'INCONCLUSIVE'];

const VerificationSchema = new mongoose.Schema({
  verificationId: {
    type: String,
    required: true,
    unique: true,
    index: true,
    default: () => `vrf_${crypto.randomBytes(8).toString('hex')}`
  },
  credentialId: {
    type: String,
    default: null,
    index: true
  },
  documentId: {
    type: String,
    default: null,
    index: true
  },
  documentHash: {
    type: String,
    default: null
  },
  requestedBy: {
    type: String,
    default: 'PUBLIC',
    index: true
  },
  result: {
    type: String,
    enum: Object.values(RESULT_TYPES),
    required: true,
    index: true
  },
  trustLevel: {
    type: String,
    enum: Object.values(TRUST_LEVELS),
    required: true,
    index: true
  },
  // Phase 9: Cryptographic vs. Human Review Status Differentiation
  cryptographicStatus: {
    type: String,
    enum: CRYPTOGRAPHIC_STATUSES,
    default: 'NOT_APPLICABLE',
    index: true
  },
  humanVerificationStatus: {
    type: String,
    enum: HUMAN_VERIFICATION_STATUSES,
    default: 'PENDING',
    index: true
  },
  finalResult: {
    type: String,
    enum: Object.values(RESULT_TYPES),
    required: true,
    index: true
  },
  manualReviewNotes: {
    type: String,
    default: null
  },
  reviewedBy: {
    type: String,
    default: null,
    index: true
  },
  reviewedAt: {
    type: Date,
    default: null
  },
  checks: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  evidence: {
    type: [mongoose.Schema.Types.Mixed],
    default: []
  },
  warnings: {
    type: [String],
    default: []
  },
  explanation: {
    type: String,
    required: true
  },
  verifiedAt: {
    type: Date,
    default: Date.now
  }
});

VerificationSchema.pre('validate', function (next) {
  if (!this.verificationId) {
    this.verificationId = `vrf_${crypto.randomBytes(8).toString('hex')}`;
  }
  if (!this.finalResult && this.result) {
    this.finalResult = this.result;
  }
  next();
});

VerificationSchema.plugin(baseModelPlugin);

const Verification = mongoose.models.Verification || mongoose.model('Verification', VerificationSchema);

module.exports = Verification;
module.exports.CRYPTOGRAPHIC_STATUSES = CRYPTOGRAPHIC_STATUSES;
module.exports.HUMAN_VERIFICATION_STATUSES = HUMAN_VERIFICATION_STATUSES;

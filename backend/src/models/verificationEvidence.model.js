const crypto = require('crypto');
const mongoose = require('mongoose');
const baseModelPlugin = require('./plugins/baseModel.plugin');

const EVIDENCE_TYPES = [
  'OFFICIAL_DOCUMENT',
  'OFFICIAL_RECORD',
  'DIGITAL_SIGNATURE',
  'HASH_MATCH',
  'ISSUER_STATUS',
  'CREDENTIAL_STATUS',
  'DOMAIN_VERIFICATION',
  'IDENTITY_EVIDENCE',
  'AI_ANALYSIS',
  'OCR_EVIDENCE',
  'MANUAL_REVIEW',
  'TIMESTAMP_EVIDENCE'
];

const EVIDENCE_STATUSES = ['CONFIRMED', 'CONTRADICTED', 'INCONCLUSIVE', 'PENDING'];

const VerificationEvidenceSchema = new mongoose.Schema({
  evidenceId: {
    type: String,
    required: true,
    unique: true,
    index: true,
    default: () => `evi_${crypto.randomBytes(8).toString('hex')}`
  },
  verificationId: {
    type: String,
    required: [true, 'verificationId is required'],
    index: true
  },
  evidenceType: {
    type: String,
    enum: EVIDENCE_TYPES,
    required: [true, 'evidenceType is required'],
    index: true
  },
  sourceId: {
    type: String,
    default: null,
    index: true
  },
  credentialIdentifier: {
    type: String,
    default: null
  },
  sourceUrl: {
    type: String,
    default: null
  },
  retrievedAt: {
    type: Date,
    default: Date.now
  },
  documentHash: {
    type: String,
    default: null
  },
  responseHash: {
    type: String,
    default: null
  },
  signaturePresent: {
    type: Boolean,
    default: false
  },
  signatureValid: {
    type: Boolean,
    default: false
  },
  sourceResponseSummary: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  evidenceStatus: {
    type: String,
    enum: EVIDENCE_STATUSES,
    default: 'CONFIRMED',
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    immutable: true
  }
});

VerificationEvidenceSchema.pre('validate', function (next) {
  if (!this.evidenceId) {
    this.evidenceId = `evi_${crypto.randomBytes(8).toString('hex')}`;
  }
  next();
});

// Enforce strict immutability: Evidence is historical and can never be rewritten!
VerificationEvidenceSchema.pre('save', function (next) {
  if (!this.isNew) {
    return next(new Error('VerificationEvidence is historical and immutable. Old evidence cannot be rewritten.'));
  }
  next();
});

VerificationEvidenceSchema.pre(['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne'], function (next) {
  next(new Error('VerificationEvidence records are immutable historical artifacts and cannot be modified.'));
});

VerificationEvidenceSchema.plugin(baseModelPlugin);

const VerificationEvidence = mongoose.models.VerificationEvidence || mongoose.model('VerificationEvidence', VerificationEvidenceSchema);

module.exports = VerificationEvidence;
module.exports.EVIDENCE_TYPES = EVIDENCE_TYPES;
module.exports.EVIDENCE_STATUSES = EVIDENCE_STATUSES;

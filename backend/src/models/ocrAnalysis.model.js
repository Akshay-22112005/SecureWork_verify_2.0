const crypto = require('crypto');
const mongoose = require('mongoose');
const baseModelPlugin = require('./plugins/baseModel.plugin');

const OCR_STATUSES = ['SUCCESS', 'UNAVAILABLE', 'FAILED'];

const OcrAnalysisSchema = new mongoose.Schema({
  analysisId: {
    type: String,
    required: true,
    unique: true,
    index: true,
    default: () => `ana_${crypto.randomBytes(8).toString('hex')}`
  },
  documentId: {
    type: String,
    required: [true, 'documentId is required'],
    index: true
  },
  status: {
    type: String,
    enum: OCR_STATUSES,
    default: 'SUCCESS',
    index: true
  },
  ocrText: {
    type: String,
    default: ''
  },
  ocrEngine: {
    type: String,
    default: 'Tesseract.js (Local)'
  },
  ocrVersion: {
    type: String,
    default: '5.x'
  },
  ocrTimestamp: {
    type: Date,
    default: Date.now,
    index: true
  },
  extractedFields: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  confidence: {
    type: Number,
    default: 0
  },
  executionDurationMs: {
    type: Number,
    default: 0
  },
  errorReason: {
    type: String,
    default: null
  }
});

OcrAnalysisSchema.pre('validate', function (next) {
  if (!this.analysisId) {
    this.analysisId = `ana_${crypto.randomBytes(8).toString('hex')}`;
  }
  next();
});

OcrAnalysisSchema.plugin(baseModelPlugin);

const OcrAnalysis = mongoose.models.OcrAnalysis || mongoose.model('OcrAnalysis', OcrAnalysisSchema);

module.exports = OcrAnalysis;
module.exports.OCR_STATUSES = OCR_STATUSES;

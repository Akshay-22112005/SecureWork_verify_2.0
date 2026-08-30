const crypto = require('crypto');
const mongoose = require('mongoose');
const baseModelPlugin = require('./plugins/baseModel.plugin');

const RISK_LEVELS = ['LOW', 'MEDIUM', 'HIGH'];
const AI_STATUSES = ['SUCCESS', 'UNAVAILABLE', 'FAILED'];

const FindingSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true
  },
  severity: {
    type: String,
    enum: ['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
    default: 'INFO'
  },
  description: {
    type: String,
    required: true
  }
}, { _id: false });

const AIAnalysisSchema = new mongoose.Schema({
  analysisId: {
    type: String,
    required: true,
    unique: true,
    index: true,
    default: () => `ai_${crypto.randomBytes(8).toString('hex')}`
  },
  documentId: {
    type: String,
    required: [true, 'documentId is required'],
    index: true
  },
  status: {
    type: String,
    enum: AI_STATUSES,
    default: 'SUCCESS',
    index: true
  },
  ocrTextReference: {
    type: String,
    default: ''
  },
  extractedFields: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  modelName: {
    type: String,
    default: 'SecureWork Local Classifier'
  },
  modelVersion: {
    type: String,
    default: '1.0.0'
  },
  riskLevel: {
    type: String,
    enum: RISK_LEVELS,
    default: 'LOW',
    index: true
  },
  riskScore: {
    type: Number,
    min: 0,
    max: 1,
    default: 0
  },
  findings: {
    type: [FindingSchema],
    default: []
  },
  executionDurationMs: {
    type: Number,
    default: 0
  },
  errorReason: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

AIAnalysisSchema.pre('validate', function (next) {
  if (!this.analysisId) {
    this.analysisId = `ai_${crypto.randomBytes(8).toString('hex')}`;
  }
  next();
});

AIAnalysisSchema.plugin(baseModelPlugin);

const AIAnalysis = mongoose.models.AIAnalysis || mongoose.model('AIAnalysis', AIAnalysisSchema);

module.exports = AIAnalysis;
module.exports.RISK_LEVELS = RISK_LEVELS;
module.exports.AI_STATUSES = AI_STATUSES;

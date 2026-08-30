const crypto = require('crypto');
const mongoose = require('mongoose');
const baseModelPlugin = require('./plugins/baseModel.plugin');

const AuditCheckpointSchema = new mongoose.Schema({
  checkpointId: {
    type: String,
    required: true,
    unique: true,
    index: true,
    default: () => `chk_${crypto.randomBytes(8).toString('hex')}`
  },
  sequenceStart: {
    type: Number,
    required: true,
    index: true
  },
  sequenceEnd: {
    type: Number,
    required: true,
    index: true
  },
  chainHeadHash: {
    type: String,
    required: true,
    index: true
  },
  externalAnchorType: {
    type: String,
    enum: ['INTERNAL_LOCAL', 'EXTERNAL_LOG', 'BLOCKCHAIN', 'PUBLIC_BULLETIN'],
    default: 'INTERNAL_LOCAL'
  },
  externalReference: {
    type: String,
    default: null
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

AuditCheckpointSchema.pre('validate', function (next) {
  if (!this.checkpointId) {
    this.checkpointId = `chk_${crypto.randomBytes(8).toString('hex')}`;
  }
  next();
});

AuditCheckpointSchema.plugin(baseModelPlugin);

const AuditCheckpoint = mongoose.models.AuditCheckpoint || mongoose.model('AuditCheckpoint', AuditCheckpointSchema);

module.exports = AuditCheckpoint;

const mongoose = require('mongoose');
const baseModelPlugin = require('./plugins/baseModel.plugin');

const AuditLogSchema = new mongoose.Schema({
  sequenceNumber: {
    type: Number,
    required: true,
    unique: true,
    index: true
  },
  action: {
    type: String,
    required: [true, 'Action is required'],
    index: true
  },
  performedBy: {
    type: String,
    required: [true, 'performedBy is required'],
    index: true
  },
  targetType: {
    type: String,
    required: [true, 'targetType is required'],
    index: true
  },
  targetId: {
    type: String,
    required: [true, 'targetId is required'],
    index: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  previousHash: {
    type: String,
    required: [true, 'previousHash is required'],
    index: true
  },
  currentHash: {
    type: String,
    required: [true, 'currentHash is required'],
    unique: true,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

// Guard against accidental Mongoose-level updates
AuditLogSchema.pre(['updateOne', 'updateMany', 'findOneAndUpdate', 'replaceOne'], function (next) {
  const err = new Error('AuditLog records are historical and append-only. Modification is prohibited.');
  err.code = 'AUDIT_LOG_IMMUTABLE';
  next(err);
});

AuditLogSchema.pre('save', function (next) {
  if (!this.isNew) {
    const err = new Error('Existing AuditLog records cannot be modified once saved.');
    err.code = 'AUDIT_LOG_IMMUTABLE';
    return next(err);
  }
  next();
});

AuditLogSchema.plugin(baseModelPlugin);

const AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', AuditLogSchema);

module.exports = AuditLog;

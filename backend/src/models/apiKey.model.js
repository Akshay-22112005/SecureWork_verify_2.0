const mongoose = require('mongoose');
const baseModelPlugin = require('./plugins/baseModel.plugin');

const API_KEY_STATUSES = ['ACTIVE', 'REVOKED'];

const ApiKeySchema = new mongoose.Schema({
  keyId: {
    type: String,
    unique: true,
    index: true
  },
  userId: {
    type: String,
    required: [true, 'User ID is required'],
    index: true
  },
  organizationId: {
    type: String,
    default: null,
    index: true
  },
  name: {
    type: String,
    required: [true, 'Key name is required'],
    trim: true,
    maxlength: 100
  },
  keyPrefix: {
    type: String,
    required: true
  },
  keyHash: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  rateLimitPerMin: {
    type: Number,
    default: 60,
    min: 1,
    max: 1000
  },
  totalUses: {
    type: Number,
    default: 0
  },
  lastUsedAt: {
    type: Date,
    default: null
  },
  expiresAt: {
    type: Date,
    default: null
  },
  status: {
    type: String,
    enum: API_KEY_STATUSES,
    default: 'ACTIVE',
    index: true
  }
});

ApiKeySchema.pre('validate', function (next) {
  if (!this.keyId) {
    const crypto = require('crypto');
    this.keyId = `apk_${crypto.randomBytes(8).toString('hex')}`;
  }
  next();
});

ApiKeySchema.plugin(baseModelPlugin);

const ApiKey = mongoose.models.ApiKey || mongoose.model('ApiKey', ApiKeySchema);

module.exports = ApiKey;
module.exports.API_KEY_STATUSES = API_KEY_STATUSES;

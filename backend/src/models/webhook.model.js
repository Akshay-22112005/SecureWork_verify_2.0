const mongoose = require('mongoose');
const baseModelPlugin = require('./plugins/baseModel.plugin');

const WEBHOOK_EVENTS = [
  'CREDENTIAL_ISSUED',
  'CREDENTIAL_VERIFIED',
  'CREDENTIAL_REVOKED',
  'DOCUMENT_INGESTED',
  '*'
];

const WebhookSchema = new mongoose.Schema({
  webhookId: {
    type: String,
    unique: true,
    index: true
  },
  userId: {
    type: String,
    required: [true, 'User ID is required'],
    index: true
  },
  url: {
    type: String,
    required: [true, 'Target webhook URL is required'],
    trim: true
  },
  secret: {
    type: String,
    required: true
  },
  events: {
    type: [String],
    default: ['*']
  },
  status: {
    type: String,
    enum: ['ACTIVE', 'INACTIVE'],
    default: 'ACTIVE'
  },
  failureCount: {
    type: Number,
    default: 0
  },
  lastDeliveredAt: {
    type: Date,
    default: null
  }
});

WebhookSchema.pre('validate', function (next) {
  if (!this.webhookId) {
    const crypto = require('crypto');
    this.webhookId = `whk_${crypto.randomBytes(8).toString('hex')}`;
  }
  next();
});

WebhookSchema.plugin(baseModelPlugin);

const Webhook = mongoose.models.Webhook || mongoose.model('Webhook', WebhookSchema);

module.exports = Webhook;
module.exports.WEBHOOK_EVENTS = WEBHOOK_EVENTS;

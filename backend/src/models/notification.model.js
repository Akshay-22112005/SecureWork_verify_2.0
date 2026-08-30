const crypto = require('crypto');
const mongoose = require('mongoose');
const baseModelPlugin = require('./plugins/baseModel.plugin');

const NOTIFICATION_TYPES = [
  'ORGANIZATION_VERIFIED',
  'ORGANIZATION_SUSPENDED',
  'ORGANIZATION_REVOKED',
  'ISSUER_APPROVED',
  'ISSUER_SUSPENDED',
  'ISSUER_REVOKED',
  'KEY_ROTATED',
  'KEY_COMPROMISED',
  'KEY_REVOKED',
  'CREDENTIAL_ISSUED',
  'CREDENTIAL_REVOKED',
  'VERIFICATION_PERFORMED',
  'MANUAL_REVIEW_COMPLETED',
  'SECURITY_ALERT',
  'GENERAL'
];

const SEVERITY_LEVELS = ['INFO', 'SUCCESS', 'WARNING', 'CRITICAL'];

const NotificationSchema = new mongoose.Schema({
  notificationId: {
    type: String,
    required: true,
    unique: true,
    index: true,
    default: () => `notif_${crypto.randomBytes(8).toString('hex')}`
  },
  recipientUserId: {
    type: String,
    required: [true, 'recipientUserId is required'],
    index: true
  },
  type: {
    type: String,
    enum: NOTIFICATION_TYPES,
    default: 'GENERAL',
    index: true
  },
  title: {
    type: String,
    required: [true, 'title is required']
  },
  message: {
    type: String,
    required: [true, 'message is required']
  },
  severity: {
    type: String,
    enum: SEVERITY_LEVELS,
    default: 'INFO',
    index: true
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  read: {
    type: Boolean,
    default: false,
    index: true
  },
  readAt: {
    type: Date,
    default: null
  },
  channel: {
    type: String,
    default: 'IN_APP'
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
});

NotificationSchema.pre('validate', function (next) {
  if (!this.notificationId) {
    this.notificationId = `notif_${crypto.randomBytes(8).toString('hex')}`;
  }
  next();
});

NotificationSchema.plugin(baseModelPlugin);

const Notification = mongoose.models.Notification || mongoose.model('Notification', NotificationSchema);

module.exports = Notification;
module.exports.NOTIFICATION_TYPES = NOTIFICATION_TYPES;
module.exports.SEVERITY_LEVELS = SEVERITY_LEVELS;

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const baseModelPlugin = require('./plugins/baseModel.plugin');

const ROLES = ['ADMIN', 'ISSUER', 'HR', 'USER', 'AUDITOR'];
const STATUSES = ['ACTIVE', 'SUSPENDED', 'INACTIVE'];

const UserSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
    index: true,
    default: () => `usr_${crypto.randomBytes(8).toString('hex')}`
  },
  name: {
    type: String,
    required: [true, 'Name is required'],
    trim: true
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    index: true
  },
  passwordHash: {
    type: String,
    required: [true, 'Password hash is required'],
    select: false // Never return passwordHash in queries by default
  },
  role: {
    type: String,
    enum: ROLES,
    default: 'USER',
    index: true
  },
  status: {
    type: String,
    enum: STATUSES,
    default: 'ACTIVE',
    index: true
  },
  organizationId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    default: null,
    index: true
  }
});

// Ensure userId is always generated before validation if not already set
UserSchema.pre('validate', function (next) {
  if (!this.userId) {
    this.userId = `usr_${crypto.randomBytes(8).toString('hex')}`;
  }
  next();
});

// Instance method to verify password
UserSchema.methods.comparePassword = async function (candidatePassword) {
  if (!this.passwordHash) {
    throw new Error('Password hash not loaded on user model');
  }
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

// Static helper to hash passwords
UserSchema.statics.hashPassword = async function (plainPassword) {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(plainPassword, salt);
};

// Apply standard base model plugin (timestamps, id mapping, secret stripping)
UserSchema.plugin(baseModelPlugin);

const User = mongoose.models.User || mongoose.model('User', UserSchema);

module.exports = User;
module.exports.ROLES = ROLES;
module.exports.STATUSES = STATUSES;

const crypto = require('crypto');
const mongoose = require('mongoose');
const baseModelPlugin = require('./plugins/baseModel.plugin');

const ORGANIZATION_TYPES = [
  'UNIVERSITY',
  'COMPANY',
  'CERTIFICATION_BODY',
  'GOVERNMENT',
  'INSTITUTION',
  'OTHER',
  // Backward compatibility types for Phase 1 tests
  'EMPLOYER',
  'ISSUER_INSTITUTION',
  'VERIFIER_ORG'
];

const VERIFICATION_STATUSES = ['PENDING', 'VERIFIED', 'SUSPENDED', 'REVOKED'];
const ORGANIZATION_STATUSES = ['ACTIVE', 'PENDING', 'SUSPENDED', 'REVOKED'];

const OrganizationSchema = new mongoose.Schema({
  organizationId: {
    type: String,
    required: true,
    unique: true,
    index: true,
    default: () => `org_${crypto.randomBytes(8).toString('hex')}`
  },
  organizationCode: {
    type: String,
    required: [true, 'Organization code is required'],
    unique: true,
    uppercase: true,
    trim: true,
    index: true
  },
  code: {
    type: String,
    uppercase: true,
    trim: true,
    index: true,
    sparse: true
  },
  name: {
    type: String,
    required: [true, 'Organization name is required'],
    trim: true
  },
  type: {
    type: String,
    enum: ORGANIZATION_TYPES,
    required: [true, 'Organization type is required'],
    index: true
  },
  officialDomain: {
    type: String,
    required: [true, 'Official domain is required'],
    lowercase: true,
    trim: true,
    index: true
  },
  organizationVerificationStatus: {
    type: String,
    enum: VERIFICATION_STATUSES,
    default: 'PENDING',
    index: true
  },
  verificationMethods: {
    type: [String],
    default: ['ADMIN_REVIEW']
  },
  verificationEvidence: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  verifiedBy: {
    type: String,
    default: null
  },
  verifiedAt: {
    type: Date,
    default: null
  },
  status: {
    type: String,
    enum: ORGANIZATION_STATUSES,
    default: 'PENDING',
    index: true
  },
  contactEmail: {
    type: String,
    lowercase: true,
    trim: true
  },
  createdBy: {
    type: String,
    default: null
  }
});

// Pre-validate hook for identifiers and backward compatibility
OrganizationSchema.pre('validate', function (next) {
  if (!this.organizationId) {
    this.organizationId = `org_${crypto.randomBytes(8).toString('hex')}`;
  }

  // Synchronize code and organizationCode
  if (!this.organizationCode && this.code) {
    this.organizationCode = this.code;
  }
  if (!this.code && this.organizationCode) {
    this.code = this.organizationCode;
  }

  // Provide default officialDomain if missing (from contactEmail or generated)
  if (!this.officialDomain) {
    if (this.contactEmail && this.contactEmail.includes('@')) {
      this.officialDomain = this.contactEmail.split('@')[1].toLowerCase();
    } else {
      this.officialDomain = `${(this.organizationCode || 'org').toLowerCase()}.local`;
    }
  }

  next();
});

OrganizationSchema.plugin(baseModelPlugin);

const Organization = mongoose.models.Organization || mongoose.model('Organization', OrganizationSchema);

module.exports = Organization;
module.exports.ORGANIZATION_TYPES = ORGANIZATION_TYPES;
module.exports.VERIFICATION_STATUSES = VERIFICATION_STATUSES;
module.exports.ORGANIZATION_STATUSES = ORGANIZATION_STATUSES;

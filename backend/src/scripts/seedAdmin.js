const crypto = require('crypto');
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const env = require('../config/env');
const { connectDB, disconnectDB } = require('../config/db');
const User = require('../models/user.model');
const logger = require('../utils/logger');

/**
 * Development seed utility to create initial ADMIN account.
 * Guarantees that admin accounts are NEVER created through public registration.
 */
async function seedAdmin(options = {}) {
  await connectDB();

  try {
    const adminEmail = (options.email || process.env.ADMIN_EMAIL || 'admin@securework.local').toLowerCase().trim();
    const adminName = options.name || process.env.ADMIN_NAME || 'System Administrator';

    let adminPassword = options.password || process.env.ADMIN_PASSWORD;

    // 1. Ensure primary ADMIN account exists
    let adminUser = await User.findOne({ email: adminEmail });
    if (!adminUser) {
      if (!adminPassword) {
        adminPassword = process.env.NODE_ENV === 'production'
          ? crypto.randomBytes(12).toString('base64')
          : 'AdminSecurePass123!';
      }
      const passwordHash = await User.hashPassword(adminPassword);
      adminUser = await User.create({
        name: adminName,
        email: adminEmail,
        passwordHash,
        role: 'ADMIN',
        status: 'ACTIVE'
      });
      logger.info(`Created ADMIN user: ${adminEmail} (${adminUser.userId})`);
      console.log(`[Seed] Created ADMIN user: ${adminEmail}`);
    } else {
      adminUser.role = 'ADMIN';
      adminUser.status = 'ACTIVE';
      if (adminPassword) {
        adminUser.passwordHash = await User.hashPassword(adminPassword);
      }
      await adminUser.save();
      console.log(`[Seed] Updated ADMIN user: ${adminEmail}`);
    }

    // 2. Ensure standard Demo Personas exist for frontend persona switcher
    const demoPersonas = [
      { name: 'Chief Compliance Auditor', email: 'auditor@securework.local', password: 'AdminSecurePass123!', role: 'AUDITOR' },
      { name: 'Stanford Registrar Office', email: 'issuer_auth@stanford.edu', password: 'SecureUserPass123!', role: 'ISSUER' },
      { name: 'Lead HR Talent Verifier', email: 'hr_lead@enterprise.local', password: 'SecureUserPass123!', role: 'HR' },
      { name: 'Dr. Katherine Bell', email: 'scholar@stanford.edu', password: 'SecureUserPass123!', role: 'USER' }
    ];

    for (const p of demoPersonas) {
      let existing = await User.findOne({ email: p.email });
      if (!existing) {
        const hash = await User.hashPassword(p.password);
        existing = await User.create({
          name: p.name,
          email: p.email,
          passwordHash: hash,
          role: p.role,
          status: 'ACTIVE'
        });
        console.log(`[Seed] Created ${p.role} demo user: ${p.email}`);
      } else {
        existing.role = p.role;
        existing.status = 'ACTIVE';
        existing.passwordHash = await User.hashPassword(p.password);
        await existing.save();
      }
    }

    // 3. Ensure Issuer persona has an active Organization and Issuer Profile and Key
    const Organization = require('../models/organization.model');
    const Issuer = require('../models/issuer.model');
    const issuerKeyService = require('../services/issuerKey.service');

    let org = await Organization.findOne({ officialDomain: 'stanford.edu' });
    if (!org) {
      org = await Organization.create({
        name: 'Stanford University',
        organizationCode: 'STANFORD',
        type: 'UNIVERSITY',
        officialDomain: 'stanford.edu',
        status: 'ACTIVE',
        organizationVerificationStatus: 'VERIFIED',
        verifiedBy: adminUser.userId,
        verifiedAt: new Date()
      });
      console.log(`[Seed] Created Organization for demo issuer: Stanford University`);
    }

    const issuerUser = await User.findOne({ email: 'issuer_auth@stanford.edu' });
    if (issuerUser) {
      let issuerProf = await Issuer.findOne({ userId: issuerUser.userId });
      if (!issuerProf) {
        issuerProf = await Issuer.create({
          issuerCode: 'STANFORD_REGISTRAR',
          userId: issuerUser.userId,
          organizationId: org.organizationId,
          status: 'ACTIVE',
          approvedBy: adminUser.userId,
          approvedAt: new Date()
        });
        console.log(`[Seed] Created Issuer profile: STANFORD_REGISTRAR`);
      }

      // Generate active key if none exists
      const IssuerKey = require('../models/issuerKey.model');
      const existingKey = await IssuerKey.findOne({ issuerId: issuerProf.issuerId, status: 'ACTIVE' });
      if (!existingKey) {
        await issuerKeyService.generateKeyForIssuer(issuerProf.issuerId, adminUser);
        console.log(`[Seed] Generated Ed25519 cryptographic keypair for STANFORD_REGISTRAR`);
      }
    }

    console.log(`==================================================`);
    console.log(`  All Test Personas & Admin Successfully Seeded!`);
    console.log(`  Admin:    admin@securework.local (AdminSecurePass123!)`);
    console.log(`  Auditor:  auditor@securework.local (AdminSecurePass123!)`);
    console.log(`  Issuer:   issuer_auth@stanford.edu (SecureUserPass123!)`);
    console.log(`  HR:       hr_lead@enterprise.local (SecureUserPass123!)`);
    console.log(`  User:     scholar@stanford.edu (SecureUserPass123!)`);
    console.log(`==================================================`);

    return adminUser.toJSON();
  } finally {
    if (options.disconnect !== false) {
      await disconnectDB();
    }
  }
}

if (require.main === module) {
  seedAdmin()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[Seed Error]:', err.message);
      process.exit(1);
    });
}

module.exports = seedAdmin;

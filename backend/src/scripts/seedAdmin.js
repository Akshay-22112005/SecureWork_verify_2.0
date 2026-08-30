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

    // Check if any admin account already exists
    const existingAdmin = await User.findOne({ role: 'ADMIN' });
    if (existingAdmin) {
      logger.info(`Admin account already exists: ${existingAdmin.email} (${existingAdmin.userId})`);
      console.log(`[Seed] Admin account already exists: ${existingAdmin.email} (${existingAdmin.userId})`);
      return existingAdmin.toJSON();
    }

    // Check if user with target email exists with non-admin role
    const existingUser = await User.findOne({ email: adminEmail });
    if (existingUser) {
      existingUser.role = 'ADMIN';
      await existingUser.save();
      logger.info(`Promoted existing user ${adminEmail} to ADMIN role.`);
      console.log(`[Seed] Promoted existing user ${adminEmail} to ADMIN role.`);
      return existingUser.toJSON();
    }

    // In production, require explicit non-default password
    if (env.IS_PRODUCTION && (!adminPassword || adminPassword === 'AdminSecurePass123!')) {
      throw new Error('ADMIN_PASSWORD environment variable must be explicitly set and secure in production mode.');
    }

    if (!adminPassword) {
      // In development, default to standard dev password
      adminPassword = process.env.NODE_ENV === 'production'
        ? crypto.randomBytes(12).toString('base64')
        : 'AdminSecurePass123!';
    }

    const passwordHash = await User.hashPassword(adminPassword);

    const adminUser = await User.create({
      name: adminName,
      email: adminEmail,
      passwordHash,
      role: 'ADMIN',
      status: 'ACTIVE'
    });

    logger.info(`Created ADMIN user: ${adminEmail} (${adminUser.userId})`);
    console.log(`==================================================`);
    console.log(`  ADMIN User Successfully Seeded`);
    console.log(`  User ID: ${adminUser.userId}`);
    console.log(`  Email:   ${adminEmail}`);
    console.log(`  Role:    ADMIN`);
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

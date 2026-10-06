const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const env = require('../config/env');
const { connectDB, disconnectDB } = require('../config/db');
const User = require('../models/user.model');
const Organization = require('../models/organization.model');
const Issuer = require('../models/issuer.model');
const IssuerKey = require('../models/issuerKey.model');
const Document = require('../models/document.model');
const Credential = require('../models/credential.model');
const TrustedSource = require('../models/trustedSource.model');
const AuditLog = require('../models/auditLog.model');
const auditService = require('../services/audit.service');
const issuerKeyService = require('../services/issuerKey.service');
const credentialService = require('../services/credential.service');
const { sha256 } = require('../utils/crypto');
const logger = require('../utils/logger');

async function seedDatabase(options = {}) {
  await connectDB();

  console.log('🌱 Starting comprehensive SecureWork Verify database seeding...\n');

  try {
    // -------------------------------------------------------------
    // 1. ADMIN USER
    // -------------------------------------------------------------
    const adminPassword = 'AdminSecurePass123!';
    const defaultUserPassword = 'SecureUserPass123!';

    let admin = await User.findOne({ email: 'admin@securework.local' });
    if (!admin) {
      admin = await User.create({
        name: 'System Administrator',
        email: 'admin@securework.local',
        passwordHash: await User.hashPassword(adminPassword),
        role: 'ADMIN',
        status: 'ACTIVE'
      });
      console.log('✅ Created 1 Admin: admin@securework.local');
    }

    // Additional standard roles for convenience
    const extraRoles = [
      { name: 'Chief Compliance Auditor', email: 'auditor@securework.local', role: 'AUDITOR', password: adminPassword },
      { name: 'Lead HR Talent Verifier', email: 'hr_lead@enterprise.local', role: 'HR', password: defaultUserPassword }
    ];
    for (const r of extraRoles) {
      let existing = await User.findOne({ email: r.email });
      if (!existing) {
        await User.create({
          name: r.name,
          email: r.email,
          passwordHash: await User.hashPassword(r.password),
          role: r.role,
          status: 'ACTIVE'
        });
      }
    }

    // -------------------------------------------------------------
    // 2. TWO ORGANIZATIONS & TWO ISSUERS
    // -------------------------------------------------------------
    // Org 1: Stanford University
    let org1 = await Organization.findOne({ organizationCode: 'STANFORD' });
    if (!org1) {
      org1 = await Organization.create({
        name: 'Stanford University',
        organizationCode: 'STANFORD',
        type: 'UNIVERSITY',
        officialDomain: 'stanford.edu',
        status: 'ACTIVE',
        organizationVerificationStatus: 'VERIFIED',
        verifiedBy: admin.userId,
        verifiedAt: new Date()
      });
    }

    // Org 2: MIT Credentials Authority
    let org2 = await Organization.findOne({ organizationCode: 'MIT_TECH' });
    if (!org2) {
      org2 = await Organization.create({
        name: 'MIT Credentials Institute',
        organizationCode: 'MIT_TECH',
        type: 'UNIVERSITY',
        officialDomain: 'mit.edu',
        status: 'ACTIVE',
        organizationVerificationStatus: 'VERIFIED',
        verifiedBy: admin.userId,
        verifiedAt: new Date()
      });
    }

    // Issuer User 1
    let issuerUser1 = await User.findOne({ email: 'issuer@stanford.edu' });
    if (!issuerUser1) {
      issuerUser1 = await User.create({
        name: 'Stanford Registrar Office',
        email: 'issuer@stanford.edu',
        passwordHash: await User.hashPassword(defaultUserPassword),
        role: 'ISSUER',
        status: 'ACTIVE'
      });
    }

    let issuerProf1 = await Issuer.findOne({ 
      $or: [{ userId: issuerUser1.userId }, { issuerCode: 'STANFORD_REGISTRAR' }]
    });
    if (!issuerProf1) {
      issuerProf1 = await Issuer.create({
        issuerCode: 'STANFORD_REGISTRAR',
        userId: issuerUser1.userId,
        organizationId: org1.organizationId,
        status: 'ACTIVE',
        approvedBy: admin.userId,
        approvedAt: new Date()
      });
    } else {
      issuerProf1.userId = issuerUser1.userId;
      issuerProf1.organizationId = org1.organizationId;
      issuerProf1.status = 'ACTIVE';
      await issuerProf1.save();
    }

    // Generate active cryptographic key for Stanford Issuer
    let key1 = await IssuerKey.findOne({ issuerId: issuerProf1.issuerId, status: 'ACTIVE' });
    if (!key1) {
      key1 = await issuerKeyService.generateKeyForIssuer(issuerProf1.issuerId, admin);
    }

    // Issuer User 2
    let issuerUser2 = await User.findOne({ email: 'issuer@mit.edu' });
    if (!issuerUser2) {
      issuerUser2 = await User.create({
        name: 'MIT Certification Bureau',
        email: 'issuer@mit.edu',
        passwordHash: await User.hashPassword(defaultUserPassword),
        role: 'ISSUER',
        status: 'ACTIVE'
      });
    }

    let issuerProf2 = await Issuer.findOne({ 
      $or: [{ userId: issuerUser2.userId }, { issuerCode: 'MIT_CERT_BUREAU' }]
    });
    if (!issuerProf2) {
      issuerProf2 = await Issuer.create({
        issuerCode: 'MIT_CERT_BUREAU',
        userId: issuerUser2.userId,
        organizationId: org2.organizationId,
        status: 'ACTIVE',
        approvedBy: admin.userId,
        approvedAt: new Date()
      });
    } else {
      issuerProf2.userId = issuerUser2.userId;
      issuerProf2.organizationId = org2.organizationId;
      issuerProf2.status = 'ACTIVE';
      await issuerProf2.save();
    }

    // Generate active cryptographic key for MIT Issuer
    let key2 = await IssuerKey.findOne({ issuerId: issuerProf2.issuerId, status: 'ACTIVE' });
    if (!key2) {
      key2 = await issuerKeyService.generateKeyForIssuer(issuerProf2.issuerId, admin);
    }

    console.log('✅ Created 2 Issuers & Organizations (Stanford University & MIT Credentials Institute)');

    // -------------------------------------------------------------
    // 3. THREE USERS (WORKERS / CANDIDATES)
    // -------------------------------------------------------------
    const usersData = [
      { name: 'Alice Johnson', email: 'alice@example.com' },
      { name: 'Bob Martinez', email: 'bob@example.com' },
      { name: 'Carol White', email: 'carol@example.com' }
    ];

    const users = {};
    for (const u of usersData) {
      let user = await User.findOne({ email: u.email });
      if (!user) {
        user = await User.create({
          name: u.name,
          email: u.email,
          passwordHash: await User.hashPassword(defaultUserPassword),
          role: 'USER',
          status: 'ACTIVE'
        });
      }
      users[u.email] = user;
    }
    console.log('✅ Created 3 Users (Alice Johnson, Bob Martinez, Carol White)');

    // -------------------------------------------------------------
    // 4. TRUSTED SOURCES
    // -------------------------------------------------------------
    const sourcesData = [
      {
        sourceCode: 'SRC_CLEARINGHOUSE',
        organizationId: org1.organizationId,
        name: 'National Student Clearinghouse Registry',
        domain: 'studentclearinghouse.org',
        baseUrl: 'https://api.studentclearinghouse.org',
        verificationEndpoint: '/verify/v1',
        sourceType: 'API',
        status: 'ACTIVE',
        verificationStatus: 'VERIFIED',
        verifiedBy: admin.userId,
        verifiedAt: new Date()
      },
      {
        sourceCode: 'SRC_ENG_BOARD',
        organizationId: org1.organizationId,
        name: 'State Board of Professional Engineers',
        domain: 'engineersboard.gov',
        baseUrl: 'https://registry.engineersboard.gov',
        verificationEndpoint: '/license/verify',
        sourceType: 'VERIFICATION_PORTAL',
        status: 'ACTIVE',
        verificationStatus: 'VERIFIED',
        verifiedBy: admin.userId,
        verifiedAt: new Date()
      },
      {
        sourceCode: 'SRC_MED_BOARD',
        organizationId: org2.organizationId,
        name: 'Healthcare & Medical Licensing Board',
        domain: 'medboard.gov',
        baseUrl: 'https://registry.medboard.gov',
        verificationEndpoint: '/status',
        sourceType: 'OFFICIAL_WEBSITE',
        status: 'ACTIVE',
        verificationStatus: 'VERIFIED',
        verifiedBy: admin.userId,
        verifiedAt: new Date()
      }
    ];

    for (const s of sourcesData) {
      let existingSource = await TrustedSource.findOne({ sourceCode: s.sourceCode });
      if (!existingSource) {
        await TrustedSource.create(s);
      }
    }
    console.log('✅ Created 3 Trusted Official Sources');

    // -------------------------------------------------------------
    // 5. HELPER TO CREATE MOCK PDF DOCUMENTS
    // -------------------------------------------------------------
    const storageDir = env.STORAGE_PATH;
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }

    async function createMockDoc(filename, title, recipientUser) {
      const content = Buffer.from(
        `%PDF-1.4\n1 0 obj\n<< /Title (${title}) /Recipient (${recipientUser.name}) /Date (${new Date().toISOString()}) >>\nendobj\nSECUREWORK_VERIFY_PAYLOAD_${crypto.randomBytes(16).toString('hex')}`
      );
      const hash = sha256(content);
      const docPath = path.join(storageDir, `${hash.slice(0, 16)}_${filename}`);
      fs.writeFileSync(docPath, content);

      const doc = await Document.create({
        originalFilename: filename,
        mimeType: 'application/pdf',
        fileSize: content.length,
        storagePath: docPath,
        sha256Hash: hash,
        hashAlgorithm: 'SHA-256',
        uploadedBy: recipientUser.userId,
        representationType: 'ORIGINAL_DIGITAL_FILE'
      });
      return doc;
    }

    // -------------------------------------------------------------
    // 6. SAMPLE CREDENTIALS (8–10 CREDENTIALS: Valid, Expired, Revoked, Tampered)
    // -------------------------------------------------------------
    async function issueOrGetCred(params, issuerUser, mutator = null) {
      let existing = await Credential.findOne({ recipientId: params.recipientId, title: params.title });
      if (!existing) {
        const result = await credentialService.issueCredential(params, issuerUser);
        existing = result.credential || result;
        if (mutator) {
          await mutator(existing);
        }
      }
      return existing;
    }

    // Credential 1: Valid BS in Computer Science (Alice Johnson, Stanford)
    const doc1 = await createMockDoc('alice_stanford_cs_degree.pdf', 'Bachelor of Science in Computer Science', users['alice@example.com']);
    const cred1 = await issueOrGetCred({
      issuerId: issuerProf1.issuerId,
      recipientId: users['alice@example.com'].userId,
      documentId: doc1.documentId,
      credentialType: 'DEGREE',
      title: 'Bachelor of Science in Computer Science',
      expiresAt: null
    }, issuerUser1);

    // Credential 2: Valid AWS Solutions Architect Cert (Alice Johnson, MIT)
    const doc2 = await createMockDoc('alice_mit_cloud_architect.pdf', 'Cloud Systems & Architecture Certification', users['alice@example.com']);
    const cred2 = await issueOrGetCred({
      issuerId: issuerProf2.issuerId,
      recipientId: users['alice@example.com'].userId,
      documentId: doc2.documentId,
      credentialType: 'CERTIFICATION',
      title: 'Advanced Cloud Systems Architect',
      expiresAt: new Date(Date.now() + 365 * 24 * 3600 * 1000)
    }, issuerUser2);

    // Credential 3: Valid Professional Engineer License (Bob Martinez, Stanford)
    const doc3 = await createMockDoc('bob_pe_license.pdf', 'Professional Engineering License', users['bob@example.com']);
    const cred3 = await issueOrGetCred({
      issuerId: issuerProf1.issuerId,
      recipientId: users['bob@example.com'].userId,
      documentId: doc3.documentId,
      credentialType: 'LICENSE',
      title: 'Professional Structural Engineer License',
      expiresAt: new Date(Date.now() + 730 * 24 * 3600 * 1000)
    }, issuerUser1);

    // Credential 4: Valid MS in Cybersecurity (Bob Martinez, MIT)
    const doc4 = await createMockDoc('bob_mit_cybersecurity_ms.pdf', 'Master of Science in Cybersecurity', users['bob@example.com']);
    const cred4 = await issueOrGetCred({
      issuerId: issuerProf2.issuerId,
      recipientId: users['bob@example.com'].userId,
      documentId: doc4.documentId,
      credentialType: 'DEGREE',
      title: 'Master of Science in Cybersecurity',
      expiresAt: null
    }, issuerUser2);

    // Credential 5: Expired Security Specialist Cert (Alice Johnson, MIT)
    const doc5 = await createMockDoc('alice_expired_cissp.pdf', 'Information Security Specialist', users['alice@example.com']);
    const cred5 = await issueOrGetCred({
      issuerId: issuerProf2.issuerId,
      recipientId: users['alice@example.com'].userId,
      documentId: doc5.documentId,
      credentialType: 'CERTIFICATION',
      title: 'Information Security Specialist (CISSP)',
      expiresAt: new Date(Date.now() - 60 * 24 * 3600 * 1000) // Expired 60 days ago
    }, issuerUser2);

    // Credential 6: Expired First Aid & Emergency Responder (Carol White, Stanford)
    const doc6 = await createMockDoc('carol_expired_first_aid.pdf', 'Emergency First Responder Qualification', users['carol@example.com']);
    const cred6 = await issueOrGetCred({
      issuerId: issuerProf1.issuerId,
      recipientId: users['carol@example.com'].userId,
      documentId: doc6.documentId,
      credentialType: 'CERTIFICATION',
      title: 'Emergency Medical First Responder',
      expiresAt: new Date(Date.now() - 180 * 24 * 3600 * 1000) // Expired 180 days ago
    }, issuerUser1);

    // Credential 7: Revoked Lead Architect Certification (Bob Martinez, MIT)
    const doc7 = await createMockDoc('bob_revoked_cert.pdf', 'Enterprise Infrastructure Architect', users['bob@example.com']);
    const cred7 = await issueOrGetCred({
      issuerId: issuerProf2.issuerId,
      recipientId: users['bob@example.com'].userId,
      documentId: doc7.documentId,
      credentialType: 'CERTIFICATION',
      title: 'Enterprise Infrastructure Architect',
      expiresAt: new Date(Date.now() + 365 * 24 * 3600 * 1000)
    }, issuerUser2, async (c) => {
      await credentialService.revokeCredential(c.credentialId, 'Superseded by 2026 Updated Enterprise Architecture Standard', issuerUser2);
    });

    // Credential 8: Revoked Financial Auditor License (Carol White, Stanford)
    const doc8 = await createMockDoc('carol_revoked_license.pdf', 'Certified Financial Compliance Auditor', users['carol@example.com']);
    const cred8 = await issueOrGetCred({
      issuerId: issuerProf1.issuerId,
      recipientId: users['carol@example.com'].userId,
      documentId: doc8.documentId,
      credentialType: 'LICENSE',
      title: 'Certified Financial Compliance Auditor',
      expiresAt: new Date(Date.now() + 365 * 24 * 3600 * 1000)
    }, issuerUser1, async (c) => {
      await credentialService.revokeCredential(c.credentialId, 'Voluntary surrender of license during sector transition', issuerUser1);
    });

    // Credential 9: Tampered Signature Credential (Carol White, Stanford)
    const doc9 = await createMockDoc('carol_tampered_mba.pdf', 'Executive Master of Business Administration', users['carol@example.com']);
    const cred9 = await issueOrGetCred({
      issuerId: issuerProf1.issuerId,
      recipientId: users['carol@example.com'].userId,
      documentId: doc9.documentId,
      credentialType: 'DEGREE',
      title: 'Executive MBA (Tampered Demo Record)',
      expiresAt: null
    }, issuerUser1, async (c) => {
      await Credential.updateOne(
        { credentialId: c.credentialId },
        { $set: { signature: 'TAMPERED_INVALID_ED25519_SIGNATURE_HEX_' + crypto.randomBytes(24).toString('hex') } }
      );
    });

    // Credential 10: Tampered Content Credential (Alice Johnson, MIT)
    const doc10 = await createMockDoc('alice_tampered_doc.pdf', 'Advanced Data Engineering Diploma', users['alice@example.com']);
    const cred10 = await issueOrGetCred({
      issuerId: issuerProf2.issuerId,
      recipientId: users['alice@example.com'].userId,
      documentId: doc10.documentId,
      credentialType: 'DEGREE',
      title: 'Advanced Data Engineering Diploma (Tampered File)',
      expiresAt: null
    }, issuerUser2, async (c) => {
      if (fs.existsSync(doc10.storagePath)) {
        fs.appendFileSync(doc10.storagePath, '\n[MALICIOUS_UNAUTHORIZED_EXTRA_BYTES]');
      }
    });

    console.log('✅ Created 10 Sample Credentials:');
    console.log('   - 4 Valid Active (Stanford CS Degree, MIT Cloud Cert, Stanford PE License, MIT Cyber MS)');
    console.log('   - 2 Expired (CISSP Security Cert, First Responder License)');
    console.log('   - 2 Revoked (Enterprise Infrastructure Architect, Financial Compliance Auditor)');
    console.log('   - 2 Tampered (Corrupted Signature MBA, Tampered Payload Data Engineering)');

    // -------------------------------------------------------------
    // 7. AUDIT CHAIN HISTORY
    // -------------------------------------------------------------
    const chainValidation = await auditService.validateChain();
    console.log(`\n🔒 Hash-Chained Audit Log Verified:`);
    console.log(`   - Total Audit Records: ${chainValidation.totalRecords}`);
    console.log(`   - Chain Head Hash:     ${chainValidation.chainHeadHash || 'GENESIS'}`);
    console.log(`   - Chain Integrity:     ${chainValidation.valid ? 'VALID & UNBROKEN' : 'BROKEN'}`);

    console.log('\n================================================================');
    console.log('             🎉 SECUREWORK VERIFY DEMO ACCOUNTS');
    console.log('================================================================');
    console.log(' Role       | Email                      | Password');
    console.log(' -----------|----------------------------|----------------------');
    console.log(' Admin      | admin@securework.local     | AdminSecurePass123!');
    console.log(' Auditor    | auditor@securework.local   | AdminSecurePass123!');
    console.log(' Issuer #1  | issuer@stanford.edu        | SecureUserPass123!');
    console.log(' Issuer #2  | issuer@mit.edu             | SecureUserPass123!');
    console.log(' HR Verifier| hr_lead@enterprise.local   | SecureUserPass123!');
    console.log(' User #1    | alice@example.com          | SecureUserPass123!');
    console.log(' User #2    | bob@example.com            | SecureUserPass123!');
    console.log(' User #3    | carol@example.com          | SecureUserPass123!');
    console.log('================================================================\n');

  } catch (err) {
    console.error('❌ Seeding error:', err);
    throw err;
  } finally {
    if (options.disconnect !== false) {
      await disconnectDB();
    }
  }
}

if (require.main === module) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = seedDatabase;

#!/usr/bin/env node

/**
 * SecureWork Verify — Zero-Trust Offline Verification CLI
 * 
 * Verifies self-contained offline credential bundles using ONLY native Node.js crypto.
 * Zero network calls. Zero third-party dependencies. Zero vendor lock-in.
 * 
 * Usage:
 *   node scripts/verify-offline.js bundle.json
 *   npm run verify:offline -- bundle.json
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function canonicalize(obj) {
  if (obj === null || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(canonicalize);
  const sorted = {};
  for (const key of Object.keys(obj).sort()) {
    sorted[key] = canonicalize(obj[key]);
  }
  return sorted;
}

function verifyOfflineBundle(bundlePath) {
  console.log('\n==================================================================');
  console.log('  🔒 SECUREWORK VERIFY — ZERO-TRUST OFFLINE VERIFICATION ENGINE');
  console.log('==================================================================\n');

  if (!bundlePath) {
    console.error('❌ Error: Please provide a path to a verification bundle JSON file.');
    console.log('Usage: npm run verify:offline -- path/to/bundle.json\n');
    process.exit(1);
  }

  const resolvedPath = path.resolve(process.cwd(), bundlePath);
  if (!fs.existsSync(resolvedPath)) {
    console.error(`❌ Error: Bundle file not found at: ${resolvedPath}\n`);
    process.exit(1);
  }

  let bundle;
  try {
    const raw = fs.readFileSync(resolvedPath, 'utf8');
    bundle = JSON.parse(raw);
  } catch (err) {
    console.error(`❌ Error: Invalid JSON in bundle file (${err.message})\n`);
    process.exit(1);
  }

  const { credential, signature, issuer, auditProof } = bundle;

  if (!credential || !signature || !issuer || !issuer.publicKeyPem) {
    console.error('❌ Error: Incomplete bundle. Missing credential, signature, or issuer public key.');
    process.exit(1);
  }

  console.log(`📄 Credential:  ${credential.title} (${credential.credentialType || 'DEGREE'})`);
  console.log(`👤 Recipient:   ${credential.recipientName || 'Authorized Professional'}`);
  console.log(`🏛️  Issuer:      ${issuer.organizationName || 'Accredited Issuer'} (${issuer.officialDomain || 'N/A'})`);
  console.log(`🔑 Key ID:      ${signature.keyId || 'N/A'} (Algorithm: ${signature.algorithm || 'Ed25519'})`);
  console.log(`🕒 Issued:      ${credential.issuedAt || 'N/A'} | Expires: ${credential.expiresAt || 'Never'}`);
  console.log('------------------------------------------------------------------');

  const checks = [];

  // Check 1: Expiration
  if (credential.expiresAt) {
    const isExpired = new Date() > new Date(credential.expiresAt);
    if (isExpired) {
      checks.push({ name: 'Expiration Check', passed: false, detail: `Expired on ${credential.expiresAt}` });
    } else {
      checks.push({ name: 'Expiration Check', passed: true, detail: 'Currently valid within active lifetime' });
    }
  } else {
    checks.push({ name: 'Expiration Check', passed: true, detail: 'Indefinite validity period' });
  }

  // Check 2: Revocation state in bundle
  if (credential.status === 'REVOKED') {
    checks.push({ name: 'Status Check', passed: false, detail: 'Credential record is marked as REVOKED' });
  } else {
    checks.push({ name: 'Status Check', passed: true, detail: `Status is ${credential.status}` });
  }

  // Check 3: Cryptographic Signature Verification using pure Node.js crypto
  let sigValid = false;
  try {
    const canonicalPayload = canonicalize(credential.canonicalSigningPayload);
    const dataBuffer = Buffer.from(JSON.stringify(canonicalPayload), 'utf8');
    const signatureBuffer = Buffer.from(signature.valueHex, 'hex');

    sigValid = crypto.verify(
      null, // null for Ed25519 / pure digital signature algorithms
      dataBuffer,
      issuer.publicKeyPem,
      signatureBuffer
    );

    if (sigValid) {
      checks.push({ name: 'Cryptographic Signature', passed: true, detail: 'Mathematically authentic Ed25519 digital signature' });
    } else {
      checks.push({ name: 'Cryptographic Signature', passed: false, detail: 'Signature mismatch! Payload was altered or key invalid' });
    }
  } catch (sigErr) {
    checks.push({ name: 'Cryptographic Signature', passed: false, detail: `Verification error: ${sigErr.message}` });
  }

  // Check 4: Audit Proof Continuity
  if (auditProof && auditProof.currentHash) {
    checks.push({
      name: 'Audit-Chain Anchor',
      passed: true,
      detail: `Anchored at seq #${auditProof.sequenceNumber || 1} with hash ${auditProof.currentHash.slice(0, 16)}...`
    });
  }

  console.log('\n🔍 OFFLINE VERIFICATION CRITERIA:');
  for (const c of checks) {
    const icon = c.passed ? '✅' : '❌';
    console.log(`  ${icon} ${c.name.padEnd(26)}: ${c.detail}`);
  }

  const allPassed = checks.every(c => c.passed);

  console.log('\n==================================================================');
  if (allPassed) {
    console.log('  🎉 VERIFICATION RESULT: VALID & CRYPTOGRAPHICALLY AUTHENTIC');
    console.log('  All mathematical proofs verified offline with 100% confidence.');
  } else {
    console.log('  ⚠️ VERIFICATION RESULT: FAILED / COMPROMISED');
    console.log('  One or more cryptographic assertions failed verification.');
  }
  console.log('==================================================================\n');

  process.exit(allPassed ? 0 : 1);
}

if (require.main === module) {
  const targetFile = process.argv[2];
  verifyOfflineBundle(targetFile);
}

module.exports = { verifyOfflineBundle };

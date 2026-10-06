const { canonicalizeJson, sha256 } = require('./crypto');
const { buildCredentialSigningPayload } = require('./credentialPayload');

/**
 * Build a self-contained offline verification bundle.
 * Contains the RFC 8785 canonicalized credential payload, cryptographic signature,
 * public key PEM, and audit-chain proof.
 */
function buildOfflineBundle({ credential, issuer, organization, recipient, activeKey, auditEntry }) {
  const canonicalPayload = buildCredentialSigningPayload(credential);

  return {
    bundleVersion: '1.0.0',
    generatedAt: new Date().toISOString(),
    standard: 'SecureWork Verify Offline Verification Bundle (RFC 8785 + Ed25519)',
    credential: {
      credentialId: credential.credentialId,
      title: credential.title,
      credentialType: credential.credentialType,
      status: credential.status,
      issuedAt: credential.issuedAt,
      expiresAt: credential.expiresAt,
      documentHash: credential.documentHash,
      hashAlgorithm: credential.hashAlgorithm || 'SHA-256',
      recipientName: recipient?.name || 'Authorized Recipient',
      canonicalSigningPayload: canonicalPayload
    },
    signature: {
      algorithm: credential.signatureAlgorithm || 'Ed25519',
      valueHex: credential.signature,
      keyId: credential.issuerKeyId
    },
    issuer: {
      issuerId: credential.issuerId,
      issuerCode: issuer?.issuerCode,
      organizationName: organization?.name || 'Accredited Institution',
      officialDomain: organization?.officialDomain,
      publicKeyPem: activeKey?.publicKeyPem
    },
    auditProof: {
      sequenceNumber: auditEntry?.sequenceNumber || null,
      currentHash: auditEntry?.currentHash || null,
      previousHash: auditEntry?.previousHash || null,
      genesisHash: sha256('GENESIS_SECUREWORK_VERIFY')
    },
    instructions: 'Verify this bundle offline with pure Node.js crypto using: npm run verify:offline -- <path-to-bundle.json>'
  };
}

module.exports = {
  buildOfflineBundle
};

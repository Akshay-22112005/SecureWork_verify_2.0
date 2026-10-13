const { canonicalizeJson, sha256 } = require('./crypto');

/**
 * Build a self-contained offline verification bundle.
 * Contains the RFC 8785 canonicalized credential payload, cryptographic signature,
 * public key PEM, and audit-chain proof.
 */
function buildOfflineBundle({ credential, activeVersion, issuer, organization, recipient, activeKey, auditEntry, documentRecord, documentBase64 }) {
  const canonicalPayload = activeVersion?.signedPayload || {
    credentialId: credential?.credentialId || '',
    documentHash: activeVersion?.documentHash || '',
    organizationId: credential?.organizationId || '',
    issuerId: credential?.issuerId || '',
    recipientId: credential?.recipientId || '',
    credentialType: credential?.credentialType || '',
    issuedAt: credential?.issuedAt || null,
    expiresAt: credential?.expiresAt || null
  };

  return {
    bundleVersion: '1.0.0',
    generatedAt: new Date().toISOString(),
    standard: 'SecureWork Verify Offline Verification Bundle (RFC 8785 + Ed25519)',
    credential: {
      credentialId: credential?.credentialId || null,
      title: credential?.title || 'Workforce Credential',
      credentialType: credential?.credentialType || null,
      status: credential?.status || 'UNKNOWN',
      issuedAt: credential?.issuedAt || null,
      expiresAt: credential?.expiresAt || null,
      documentHash: activeVersion?.documentHash || '',
      hashAlgorithm: documentRecord?.hashAlgorithm || 'SHA-256',
      recipientName: recipient?.name || 'Authorized Recipient',
      canonicalSigningPayload: canonicalPayload,
      document: documentRecord ? {
        documentId: documentRecord.documentId || null,
        originalFilename: documentRecord.originalFilename || null,
        mimeType: documentRecord.mimeType || null,
        sha256Hash: documentRecord.sha256Hash || activeVersion?.documentHash || null,
        contentBase64: documentBase64 || null
      } : null
    },
    signature: {
      algorithm: activeVersion?.signatureAlgorithm || credential?.signatureAlgorithm || 'Ed25519',
      valueHex: activeVersion?.signature || credential?.signature || null,
      keyId: activeVersion?.issuerKeyId || credential?.issuerKeyId || null
    },
    issuer: {
      issuerId: credential?.issuerId || null,
      issuerCode: issuer?.issuerCode,
      organizationName: organization?.name || 'Accredited Institution',
      officialDomain: organization?.officialDomain,
      publicKeyPem: activeKey?.publicKey || null
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

/**
 * Format a SecureWork Verify Credential into a W3C Verifiable Credential standard JSON-LD representation.
 * Standard: W3C Verifiable Credentials Data Model v1.1 / v2.0
 */
function formatToW3cVerifiableCredential({ credential, issuer, organization, recipient, activeKey }) {
  const domain = organization?.officialDomain || 'securework.io';
  const issuerDid = `did:web:${domain}:issuers:${issuer?.issuerCode || credential.issuerId}`;
  const subjectDid = `did:key:z6Mkw${credential.recipientId.replace(/[^a-zA-Z0-9]/g, '')}`;

  return {
    '@context': [
      'https://www.w3.org/2018/credentials/v1',
      'https://schema.org',
      'https://w3id.org/security/suites/ed25519-2020/v1'
    ],
    id: `urn:uuid:${credential.credentialId}`,
    type: ['VerifiableCredential', 'WorkforceCredential', `${credential.credentialType || 'General'}Credential`],
    issuer: {
      id: issuerDid,
      name: organization?.name || issuer?.organizationName || 'Accredited Institution',
      domain: domain
    },
    issuanceDate: credential.issuedAt ? new Date(credential.issuedAt).toISOString() : new Date().toISOString(),
    expirationDate: credential.expiresAt ? new Date(credential.expiresAt).toISOString() : undefined,
    credentialSubject: {
      id: subjectDid,
      name: recipient?.name || 'Authorized Professional',
      qualification: credential.title,
      credentialType: credential.credentialType,
      status: credential.status
    },
    evidence: [
      {
        id: `urn:securework:evidence:${credential.credentialId}`,
        type: ['DocumentIntegrityEvidence', 'CryptographicSignatureProof'],
        documentHash: credential.documentHash,
        hashAlgorithm: credential.hashAlgorithm || 'SHA-256',
        canonicalization: 'RFC 8785 JSON Canonicalization Scheme (JCS)'
      }
    ],
    proof: {
      type: 'Ed25519Signature2020',
      created: credential.issuedAt ? new Date(credential.issuedAt).toISOString() : new Date().toISOString(),
      verificationMethod: `${issuerDid}#${credential.issuerKeyId || 'key-1'}`,
      proofPurpose: 'assertionMethod',
      proofValue: credential.signature
    }
  };
}

module.exports = {
  formatToW3cVerifiableCredential
};

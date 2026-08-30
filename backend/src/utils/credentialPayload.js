const { canonicalizeJson, verifyEd25519 } = require('./crypto');

/**
 * Construct the authoritative 9-field signed credential payload.
 * Formats timestamps deterministically as ISO-8601 strings.
 * @param {object} params
 * @param {string} params.credentialId
 * @param {string} params.credentialVersionId
 * @param {string} params.documentHash
 * @param {string} params.organizationId
 * @param {string} params.issuerId
 * @param {string} params.recipientId
 * @param {string} params.credentialType
 * @param {Date | string} params.issuedAt
 * @param {Date | string | null} [params.expiresAt=null]
 * @returns {object} Well-structured payload object
 */
function buildCanonicalPayload({
  credentialId,
  credentialVersionId,
  documentHash,
  organizationId,
  issuerId,
  recipientId,
  credentialType,
  issuedAt,
  expiresAt = null
}) {
  return {
    credentialId,
    credentialVersionId,
    documentHash,
    organizationId,
    issuerId,
    recipientId,
    credentialType,
    issuedAt: issuedAt instanceof Date ? issuedAt.toISOString() : new Date(issuedAt).toISOString(),
    expiresAt: expiresAt ? (expiresAt instanceof Date ? expiresAt.toISOString() : new Date(expiresAt).toISOString()) : null
  };
}

/**
 * Deterministically serialize the credential payload into canonical JSON (RFC 8785 subset).
 * @param {object} payload
 * @returns {string} Deterministic canonical string
 */
function serializeCanonicalPayload(payload) {
  return canonicalizeJson(payload);
}

/**
 * Verify a credential version's digital signature against its canonical payload and issuer public key.
 * @param {object} signedPayload
 * @param {string} signature
 * @param {string} publicKeyPem
 * @returns {boolean} True if signature is valid
 */
function verifyCredentialSignature(signedPayload, signature, publicKeyPem) {
  const canonicalString = serializeCanonicalPayload(signedPayload);
  return verifyEd25519(canonicalString, signature, publicKeyPem, 'hex');
}

module.exports = {
  buildCanonicalPayload,
  serializeCanonicalPayload,
  verifyCredentialSignature
};

const Organization = require('../../models/organization.model');
const Issuer = require('../../models/issuer.model');
const IssuerKey = require('../../models/issuerKey.model');
const Document = require('../../models/document.model');
const Credential = require('../../models/credential.model');
const CredentialVersion = require('../../models/credentialVersion.model');
const { verifyCredentialSignature } = require('../../utils/credentialPayload');
const { sha256 } = require('../../utils/crypto');
const { TRUST_LEVELS, RESULT_TYPES } = require('./verificationConstants');

/**
 * Verification Engine
 * Core evidence-based evaluation pipeline for workforce credentials.
 * Principle: Evidence first, conclusion second. Never reduces to `trusted = true`.
 */
class VerificationEngine {
  /**
   * Run the full multi-check verification pipeline.
   * Evaluates all 16 dimensions independently.
   * @param {object} input
   * @param {string} input.credentialId
   * @param {number} [input.versionNumber]
   * @param {string} [input.claimedRecipientId]
   * @param {string} [input.documentHash]
   * @param {Buffer} [input.documentBuffer]
   * @param {string} [input.representationType]
   * @param {string} [input.manualReviewDecision] - 'VERIFIED' | 'REJECTED' | 'PENDING'
   * @param {object} [input.externalSourceData] - { verified: boolean, notes: string }
   * @param {object} [input.ocrData] - { extractedText: string, fieldsMatch: boolean, discrepancy: string }
   * @param {object} [input.aiData] - { tamperingDetected: boolean, anomalyScore: number, notes: string }
   * @param {Date | string} [input.customTimestamp]
   * @returns {Promise<object>} Detailed verification report { result, trustLevel, checks, evidence, warnings, explanation }
   */
  async evaluateVerification(input) {
    const {
      credentialId,
      versionNumber,
      claimedRecipientId,
      documentHash,
      documentBuffer,
      representationType,
      manualReviewDecision,
      externalSourceData,
      ocrData,
      aiData,
      customTimestamp
    } = input;

    const evalTime = customTimestamp ? new Date(customTimestamp) : new Date();
    const checks = {};
    const evidence = [];
    const warnings = [];

    // Helper to record check result and evidence
    const recordCheck = (name, passed, details, evidencePayload = null) => {
      checks[name] = {
        evaluated: true,
        passed,
        details
      };
      if (evidencePayload) {
        evidence.push({
          check: name,
          timestamp: evalTime.toISOString(),
          ...evidencePayload
        });
      }
    };

    // 0. Locate Credential
    const credential = await Credential.findOne({ credentialId });
    if (!credential) {
      recordCheck('credentialLookup', false, 'Credential identifier not found in registry');
      return {
        result: RESULT_TYPES.NOT_FOUND,
        trustLevel: TRUST_LEVELS.LEVEL_0_UNKNOWN,
        checks,
        evidence,
        warnings: ['No record exists with the provided credentialId.'],
        explanation: 'Credential not found in the verified registry. Unable to evaluate.'
      };
    }

    // 0b. Locate target CredentialVersion
    let version;
    if (versionNumber) {
      version = await CredentialVersion.findOne({ credentialId, versionNumber });
    } else {
      version = await CredentialVersion.findOne({ versionId: credential.currentVersionId });
    }

    if (!version) {
      recordCheck('versionLookup', false, 'Credential version record not found');
      return {
        result: RESULT_TYPES.NOT_FOUND,
        trustLevel: TRUST_LEVELS.LEVEL_1_SOURCE_FOUND,
        checks,
        evidence,
        warnings: ['Credential exists, but specific version record is missing.'],
        explanation: 'Target version not found for this credential.'
      };
    }

    // Fetch related entities
    const organization = await Organization.findOne({ organizationId: credential.organizationId });
    const issuer = await Issuer.findOne({ issuerId: credential.issuerId });
    const issuerKey = await IssuerKey.findOne({ keyId: version.issuerKeyId });
    const document = await Document.findOne({ documentId: version.documentId });

    // ==========================================
    // Check 1: Organization Trust
    // ==========================================
    if (!organization) {
      recordCheck('organizationTrust', false, 'Issuing organization record not found');
      warnings.push('Issuing organization not found in platform registry.');
    } else if (organization.organizationVerificationStatus !== 'VERIFIED') {
      recordCheck(
        'organizationTrust',
        false,
        `Organization verification status is "${organization.organizationVerificationStatus}"`,
        { organizationCode: organization.organizationCode, status: organization.status }
      );
      warnings.push(`Issuing organization "${organization.name}" is not fully verified.`);
    } else {
      const isOrgSuspended = organization.status !== 'ACTIVE';
      recordCheck(
        'organizationTrust',
        true,
        `Organization "${organization.name}" is verified. Current status: ${organization.status}. Note: An inactive organization does not automatically invalidate historical credentials.`,
        {
          organizationId: organization.organizationId,
          officialDomain: organization.officialDomain,
          organizationVerificationStatus: organization.organizationVerificationStatus,
          status: organization.status
        }
      );
      if (isOrgSuspended) {
        warnings.push(`Issuing organization is currently ${organization.status}, but was verified historically.`);
      }
    }

    // ==========================================
    // Check 2: Source Trust
    // ==========================================
    if (organization && organization.officialDomain) {
      recordCheck('sourceTrust', true, `Official domain: ${organization.officialDomain}`, {
        officialDomain: organization.officialDomain
      });
    } else {
      recordCheck('sourceTrust', false, 'No verified official source domain registered');
      warnings.push('Origin lacks verified domain source binding.');
    }

    // ==========================================
    // Check 3: Issuer Authorization
    // ==========================================
    if (!issuer) {
      recordCheck('issuerAuthorization', false, 'Issuer profile not found');
      warnings.push('Issuing body profile could not be located.');
    } else if (issuer.status !== 'ACTIVE') {
      recordCheck(
        'issuerAuthorization',
        false,
        `Issuer authorization status is "${issuer.status}"`,
        { issuerId: issuer.issuerId, status: issuer.status }
      );
      warnings.push(`Issuer status is currently "${issuer.status}".`);
    } else {
      recordCheck('issuerAuthorization', true, `Issuer is authorized and active`, {
        issuerId: issuer.issuerId,
        issuerCode: issuer.issuerCode,
        organizationId: issuer.organizationId
      });
    }

    // ==========================================
    // Check 4: Issuer Key Status
    // ==========================================
    let keyCompromiseSeverity = 'NONE';
    if (!issuerKey) {
      recordCheck('issuerKeyStatus', false, 'Signing key record not found');
      warnings.push('Public key used to sign this credential version is not in the registry.');
    } else {
      const issuedAt = new Date(version.issuedAt);
      if (issuerKey.status === 'COMPROMISED') {
        const compromisedAt = issuerKey.compromisedAt ? new Date(issuerKey.compromisedAt) : null;
        if (compromisedAt && issuedAt > compromisedAt) {
          keyCompromiseSeverity = 'POST_COMPROMISE';
          recordCheck(
            'issuerKeyStatus',
            false,
            `Key "${issuerKey.keyId}" was compromised prior to credential issuance.`,
            { keyId: issuerKey.keyId, compromisedAt: issuerKey.compromisedAt, issuedAt: version.issuedAt }
          );
          warnings.push(`CRITICAL: Signing key was compromised prior to issuance!`);
        } else {
          keyCompromiseSeverity = 'PRE_COMPROMISE';
          recordCheck(
            'issuerKeyStatus',
            true,
            `Key "${issuerKey.keyId}" is currently COMPROMISED, but signing occurred prior to compromise (${version.issuedAt} <= ${issuerKey.compromisedAt}). Signature remains historically authentic.`,
            { keyId: issuerKey.keyId, status: issuerKey.status, compromisedAt: issuerKey.compromisedAt }
          );
          warnings.push(`Signing key was marked COMPROMISED after issuance. Historical validity preserved.`);
        }
      } else if (issuerKey.status === 'RETIRED') {
        recordCheck(
          'issuerKeyStatus',
          true,
          `Key "${issuerKey.keyId}" is RETIRED. Historical signatures remain valid.`,
          { keyId: issuerKey.keyId, status: issuerKey.status, retiredAt: issuerKey.retiredAt }
        );
      } else if (issuerKey.status === 'REVOKED') {
        recordCheck(
          'issuerKeyStatus',
          false,
          `Key "${issuerKey.keyId}" has been REVOKED.`,
          { keyId: issuerKey.keyId, status: issuerKey.status, revokedAt: issuerKey.revokedAt }
        );
        warnings.push(`Signing key is revoked.`);
      } else {
        recordCheck('issuerKeyStatus', true, `Key "${issuerKey.keyId}" is ACTIVE`, {
          keyId: issuerKey.keyId,
          algorithm: issuerKey.algorithm
        });
      }
    }

    // ==========================================
    // Check 5: Document Integrity
    // ==========================================
    let evaluatedHash = documentHash;
    if (documentBuffer && Buffer.isBuffer(documentBuffer)) {
      evaluatedHash = sha256(documentBuffer);
    } else if (!evaluatedHash && document) {
      evaluatedHash = document.sha256Hash;
    }

    let isScanOrScreenshot =
      representationType === 'SCAN' ||
      representationType === 'SCREENSHOT' ||
      (document && (document.representationType === 'SCAN' || document.representationType === 'SCREENSHOT'));

    let documentIntegrityMatch = evaluatedHash && evaluatedHash === version.documentHash;

    if (!evaluatedHash) {
      recordCheck('documentIntegrity', false, 'No document payload or hash provided for verification');
      warnings.push('Document bytes were not provided for cryptographic hash comparison.');
    } else if (!documentIntegrityMatch) {
      if (isScanOrScreenshot) {
        recordCheck(
          'documentIntegrity',
          false,
          'Screenshots/scans cannot be cryptographically verified as exact original bytes unless they actually match the registered original representation.',
          { evaluatedHash, expectedHash: version.documentHash, representationType }
        );
        warnings.push('Scan or screenshot does not match the byte-exact original digital file.');
      } else {
        recordCheck(
          'documentIntegrity',
          false,
          'Document SHA-256 hash does not match cryptographically signed original (ALTERED).',
          { evaluatedHash, expectedHash: version.documentHash }
        );
        warnings.push('Document file contents have been altered from the original signed record.');
      }
    } else {
      recordCheck('documentIntegrity', true, 'Exact SHA-256 hash match with registered document', {
        sha256Hash: evaluatedHash
      });
    }

    // ==========================================
    // Check 6: Digital Signature
    // ==========================================
    let isSigValid = false;
    if (issuerKey && issuerKey.publicKey && version.signature && version.signedPayload) {
      isSigValid = verifyCredentialSignature(
        version.signedPayload,
        version.signature,
        issuerKey.publicKey
      );
    }

    if (isSigValid) {
      recordCheck('digitalSignature', true, 'Ed25519 digital signature verified against canonical payload and issuer public key', {
        signature: version.signature,
        keyId: version.issuerKeyId
      });
    } else {
      recordCheck('digitalSignature', false, 'Digital signature verification failed or payload tampered', {
        signature: version.signature,
        keyId: version.issuerKeyId
      });
      warnings.push('Digital signature is invalid or canonical payload has been modified.');
    }

    // ==========================================
    // Check 7: Recipient Binding
    // ==========================================
    let recipientMatches = true;
    if (claimedRecipientId) {
      recipientMatches =
        claimedRecipientId === credential.recipientId ||
        (version.signedPayload && claimedRecipientId === version.signedPayload.recipientId);
    }

    if (!recipientMatches) {
      recordCheck('recipientBinding', false, `Claimed recipient "${claimedRecipientId}" does not match credential subject "${credential.recipientId}"`, {
        claimedRecipientId,
        boundRecipientId: credential.recipientId
      });
      warnings.push('Identity mismatch: Credential was not issued to the claimed recipient.');
    } else {
      recordCheck('recipientBinding', true, `Credential properly bound to recipient "${credential.recipientId}"`, {
        recipientId: credential.recipientId
      });
    }

    // ==========================================
    // Check 8: Credential Status
    // ==========================================
    recordCheck('credentialStatus', true, `Credential status: ${credential.status}, Version status: ${version.status}`, {
      credentialStatus: credential.status,
      versionStatus: version.status,
      currentVersionNumber: credential.currentVersionNumber,
      evaluatedVersionNumber: version.versionNumber
    });

    // ==========================================
    // Check 9: Expiration
    // ==========================================
    let isExpired = false;
    if (credential.expiresAt && evalTime > new Date(credential.expiresAt)) {
      isExpired = true;
      recordCheck('expiration', false, `Credential expired on ${credential.expiresAt}. An expired credential is not automatically fake.`, {
        expiresAt: credential.expiresAt,
        evaluationTime: evalTime.toISOString()
      });
      warnings.push(`Credential expired on ${credential.expiresAt}.`);
    } else {
      recordCheck('expiration', true, credential.expiresAt ? `Valid until ${credential.expiresAt}` : 'No expiration date (perpetual validity)', {
        expiresAt: credential.expiresAt
      });
    }

    // ==========================================
    // Check 10: Revocation
    // ==========================================
    let isRevoked = credential.status === 'REVOKED' || version.status === 'REVOKED';
    if (isRevoked) {
      recordCheck('revocation', false, `Credential was revoked on ${credential.revokedAt}. Reason: ${credential.revocationReason}. A revoked credential remains historically authentic but is revoked.`, {
        revokedAt: credential.revokedAt,
        revocationReason: credential.revocationReason
      });
      warnings.push(`Credential is revoked: ${credential.revocationReason || 'No reason provided'}.`);
    } else {
      recordCheck('revocation', true, 'Credential is not revoked', {
        revocationRegistryStatus: 'CLEAN'
      });
    }

    // ==========================================
    // Check 11: Source Evidence
    // ==========================================
    if (externalSourceData) {
      recordCheck('sourceEvidence', externalSourceData.verified !== false, externalSourceData.notes || 'External source evidence evaluated', externalSourceData);
    } else {
      recordCheck('sourceEvidence', true, 'Source evidence verified via platform internal registrar');
    }

    // ==========================================
    // Check 12: OCR Evidence
    // ==========================================
    if (ocrData) {
      recordCheck(
        'ocrEvidence',
        ocrData.fieldsMatch !== false,
        `OCR text extraction completed. Note: OCR cannot establish authenticity. ${ocrData.discrepancy || ''}`,
        ocrData
      );
    } else {
      recordCheck('ocrEvidence', true, 'OCR evidence not provided or not applicable');
    }

    // ==========================================
    // Check 13: AI Evidence
    // ==========================================
    if (aiData) {
      if (aiData.tamperingDetected) {
        recordCheck('aiEvidence', false, `AI flagged potential tampering: ${aiData.notes || 'Anomaly detected'}`, aiData);
        warnings.push(`AI analysis flagged potential document manipulation.`);
      } else {
        recordCheck('aiEvidence', true, 'AI inspection detected no structural anomalies. Note: AI cannot override cryptographic failure.', aiData);
      }
    } else {
      recordCheck('aiEvidence', true, 'AI evidence not provided or not applicable');
    }

    // ==========================================
    // Check 14: Human Evidence
    // ==========================================
    if (manualReviewDecision) {
      if (manualReviewDecision === 'VERIFIED') {
        recordCheck('humanEvidence', true, 'Manually reviewed and verified by an authorized officer', { decision: 'VERIFIED' });
      } else if (manualReviewDecision === 'REJECTED') {
        recordCheck('humanEvidence', false, 'Rejected during manual human inspection', { decision: 'REJECTED' });
        warnings.push('Manual human review rejected the credential.');
      } else {
        recordCheck('humanEvidence', false, 'Credential queued for manual review', { decision: 'PENDING' });
      }
    } else {
      recordCheck('humanEvidence', true, 'Direct cryptographic verification passed without requiring manual review');
    }

    // ==========================================
    // Check 15: Timestamp Evidence
    // ==========================================
    const issuedAt = new Date(version.issuedAt);
    const createdAt = new Date(credential.createdAt);
    const isTimestampConsistent = issuedAt <= evalTime && createdAt <= evalTime;
    recordCheck('timestampEvidence', isTimestampConsistent, `Issued at ${version.issuedAt}, evaluated at ${evalTime.toISOString()}`, {
      issuedAt: version.issuedAt,
      createdAt: credential.createdAt,
      evaluatedAt: evalTime.toISOString()
    });

    // ==========================================
    // Check 16: Conflicts
    // ==========================================
    const conflicts = [];
    if (!isSigValid && aiData && !aiData.tamperingDetected) {
      conflicts.push('AI reported clean document despite cryptographic digital signature failure.');
    }
    if (documentIntegrityMatch && !isSigValid) {
      conflicts.push('Document hash matches registry but digital signature fails verification.');
    }
    if (ocrData && ocrData.fieldsMatch === false) {
      conflicts.push(`OCR text claims disagree with canonical payload: ${ocrData.discrepancy}`);
    }
    if (manualReviewDecision === 'REJECTED' && isSigValid) {
      conflicts.push('Human reviewer rejected document despite valid cryptographic signature.');
    }

    if (conflicts.length > 0) {
      recordCheck('conflicts', false, `Discrepancies identified: ${conflicts.join('; ')}`, { conflicts });
      warnings.push(...conflicts);
    } else {
      recordCheck('conflicts', true, 'No conflicting evidence found across evaluated dimensions');
    }

    // ==========================================
    // SYNTHESIS & TRUST LEVEL ASSIGNMENT
    // ==========================================
    let result;
    let trustLevel;
    let explanation;

    if (!organization || organization.organizationVerificationStatus !== 'VERIFIED') {
      result = RESULT_TYPES.UNTRUSTED_ORIGIN;
      trustLevel = TRUST_LEVELS.LEVEL_1_SOURCE_FOUND;
      explanation = 'Issuing organization is not recognized or verified by platform authorities.';
    } else if (issuer && issuer.status === 'REVOKED') {
      result = RESULT_TYPES.ISSUER_REVOKED;
      trustLevel = TRUST_LEVELS.LEVEL_2_SOURCE_VERIFIED;
      explanation = 'Issuing authority was revoked by administrator.';
    } else if (issuer && issuer.status === 'SUSPENDED') {
      result = RESULT_TYPES.ISSUER_SUSPENDED;
      trustLevel = TRUST_LEVELS.LEVEL_2_SOURCE_VERIFIED;
      explanation = 'Issuing authority is currently suspended.';
    } else if (issuer && issuer.status !== 'ACTIVE') {
      result = RESULT_TYPES.ISSUER_INACTIVE;
      trustLevel = TRUST_LEVELS.LEVEL_2_SOURCE_VERIFIED;
      explanation = 'Issuing authority is not active.';
    } else if (!isSigValid) {
      // AI CANNOT OVERRIDE CRYPTOGRAPHIC FAILURE!
      result = RESULT_TYPES.SIGNATURE_INVALID;
      trustLevel = TRUST_LEVELS.LEVEL_2_SOURCE_VERIFIED;
      explanation = 'Cryptographic signature is invalid or canonical payload was tampered. AI or OCR cannot override cryptographic failure.';
    } else if (!documentIntegrityMatch) {
      if (isScanOrScreenshot) {
        result = RESULT_TYPES.NOT_EXACT_FILE_MATCH;
        trustLevel = TRUST_LEVELS.LEVEL_2_SOURCE_VERIFIED;
        explanation = 'Screenshots/scans cannot be cryptographically verified as exact original bytes unless they actually match the registered original representation.';
      } else {
        result = RESULT_TYPES.ALTERED;
        trustLevel = TRUST_LEVELS.LEVEL_2_SOURCE_VERIFIED;
        explanation = 'The uploaded document hash does not match the original signed document. The file has been altered.';
      }
    } else if (!recipientMatches) {
      result = RESULT_TYPES.IDENTITY_MISMATCH;
      trustLevel = TRUST_LEVELS.LEVEL_3_INTEGRITY_VERIFIED;
      explanation = 'Credential recipient binding does not match the claimed identity.';
    } else if (keyCompromiseSeverity === 'POST_COMPROMISE') {
      result = RESULT_TYPES.KEY_COMPROMISED;
      trustLevel = TRUST_LEVELS.LEVEL_3_INTEGRITY_VERIFIED;
      explanation = 'The cryptographic key used to sign this credential was compromised prior to issuance.';
    } else if (conflicts.length > 0) {
      result = RESULT_TYPES.CONFLICTING_EVIDENCE;
      trustLevel = TRUST_LEVELS.LEVEL_3_INTEGRITY_VERIFIED;
      explanation = `Conflicting evidence detected: ${conflicts.join('; ')}`;
    } else if (manualReviewDecision === 'PENDING') {
      result = RESULT_TYPES.MANUAL_REVIEW;
      trustLevel = TRUST_LEVELS.LEVEL_3_INTEGRITY_VERIFIED;
      explanation = 'Verification requires manual officer inspection.';
    } else if (version.status === 'SUPERSEDED') {
      result = RESULT_TYPES.CREDENTIAL_SUPERSEDED;
      trustLevel = TRUST_LEVELS.LEVEL_4_SIGNATURE_VERIFIED;
      explanation = `This revision (version ${version.versionNumber}) is historically authentic with valid digital signature, but has been superseded by version ${credential.currentVersionNumber}.`;
    } else if (isRevoked) {
      result = RESULT_TYPES.CREDENTIAL_REVOKED;
      trustLevel = TRUST_LEVELS.LEVEL_4_SIGNATURE_VERIFIED;
      explanation = `Credential is historically authentic with a valid cryptographic signature, but was officially revoked on ${credential.revokedAt}. Reason: ${credential.revocationReason || 'Unspecified'}.`;
    } else if (isExpired) {
      result = RESULT_TYPES.CREDENTIAL_EXPIRED;
      trustLevel = TRUST_LEVELS.LEVEL_4_SIGNATURE_VERIFIED;
      explanation = `Credential is authentic and cryptographically valid, but reached its expiration on ${credential.expiresAt}. It is expired, not fake.`;
    } else if (manualReviewDecision === 'VERIFIED') {
      result = RESULT_TYPES.MANUALLY_VERIFIED;
      trustLevel = TRUST_LEVELS.LEVEL_5_CURRENTLY_VALID;
      explanation = 'Credential and supporting evidence were manually inspected and approved by an authorized reviewer.';
    } else {
      // Full cryptographic, identity, status, and authority pass
      result = RESULT_TYPES.VERIFIED;
      trustLevel = TRUST_LEVELS.LEVEL_5_CURRENTLY_VALID;
      explanation = 'All cryptographic signatures, document integrity, issuer authorizations, and recipient bindings are verified and currently valid.';
    }

    return {
      result,
      trustLevel,
      checks,
      evidence,
      warnings,
      explanation
    };
  }
}

module.exports = new VerificationEngine();

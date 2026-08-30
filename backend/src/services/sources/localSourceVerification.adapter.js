const SourceVerificationAdapter = require('./sourceVerification.adapter');
const { sha256 } = require('../../utils/crypto');
const { ValidationError } = require('../../utils/errors');

/**
 * Local Source Verification Adapter
 * Controlled local testing adapter for verifiable records without fabricating
 * external institutional APIs.
 */
class LocalSourceVerificationAdapter extends SourceVerificationAdapter {
  constructor() {
    super();
    // In-memory test registry: Map<sourceCode, Map<identifier, record>>
    this.mockRegistries = new Map();
    this.failingSources = new Set();
  }

  /**
   * Seed a test record into the local mock registry.
   * @param {string} sourceCode
   * @param {string} identifier - e.g. student ID, license number, or certificate ID
   * @param {object} recordData
   * @param {boolean} [isCryptographicallySigned=false]
   */
  seedRecord(sourceCode, identifier, recordData, isCryptographicallySigned = false) {
    const code = sourceCode.toUpperCase();
    if (!this.mockRegistries.has(code)) {
      this.mockRegistries.set(code, new Map());
    }
    this.mockRegistries.get(code).set(identifier, {
      ...recordData,
      isCryptographicallySigned
    });
  }

  /**
   * Configure simulated offline status for a source.
   * @param {string} sourceCode
   * @param {boolean} fail
   */
  simulateFailure(sourceCode, fail = true) {
    const code = sourceCode.toUpperCase();
    if (fail) {
      this.failingSources.add(code);
    } else {
      this.failingSources.delete(code);
    }
  }

  /**
   * Query official source in local controlled environment.
   * @param {object} trustedSource
   * @param {object} queryParams
   */
  async verifyRecord(trustedSource, queryParams) {
    const code = trustedSource.sourceCode.toUpperCase();

    if (this.failingSources.has(code)) {
      throw new ValidationError(
        `Official registry "${trustedSource.name}" is currently unreachable or unavailable`,
        'SOURCE_UNAVAILABLE'
      );
    }

    const registry = this.mockRegistries.get(code);
    const idKey = queryParams.identifier || queryParams.studentId || queryParams.licenseNumber || queryParams.registrationId;

    if (!registry || !idKey || !registry.has(idKey)) {
      const emptyPayload = JSON.stringify({ found: false, queriedAt: new Date().toISOString() });
      return {
        verified: false,
        sourceState: 'NOT_FOUND',
        responseHash: sha256(emptyPayload),
        rawResponse: { found: false },
        notes: `No matching record found in ${trustedSource.name} registry`
      };
    }

    const matchedRecord = registry.get(idKey);
    const rawResponse = {
      found: true,
      record: matchedRecord,
      retrievedFrom: trustedSource.name,
      timestamp: new Date().toISOString()
    };
    const responseHash = sha256(JSON.stringify(rawResponse));

    // Distinguish SOURCE_VERIFIED (cryptographic proof) from SOURCE_FOUND (non-cryptographic confirmation)
    if (matchedRecord.isCryptographicallySigned) {
      return {
        verified: true,
        sourceState: 'SOURCE_VERIFIED',
        responseHash,
        rawResponse,
        notes: `Official cryptographic confirmation issued by ${trustedSource.name}`
      };
    }

    return {
      verified: true,
      sourceState: 'SOURCE_FOUND',
      responseHash,
      rawResponse,
      notes: `Record confirmed by ${trustedSource.name}, but provides no cryptographic proof (SOURCE FOUND / NOT CRYPTOGRAPHICALLY VERIFIED)`
    };
  }

  /**
   * Health check simulation.
   * @param {object} trustedSource
   */
  async checkHealth(trustedSource) {
    const code = trustedSource.sourceCode.toUpperCase();
    const isFailing = this.failingSources.has(code);
    return {
      reachable: !isFailing,
      latencyMs: isFailing ? 5000 : 15
    };
  }
}

module.exports = LocalSourceVerificationAdapter;

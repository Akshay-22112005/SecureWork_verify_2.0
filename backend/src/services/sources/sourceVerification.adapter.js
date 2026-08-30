/**
 * Source Verification Adapter Interface
 * Abstract contract for communicating with official trusted source registries.
 */
class SourceVerificationAdapter {
  /**
   * Query official source for credential verification evidence.
   * @param {object} trustedSource - TrustedSource model instance
   * @param {object} queryParams - Search parameters (e.g. registrationId, candidateName, degree)
   * @returns {Promise<{
   *   verified: boolean,
   *   sourceState: 'SOURCE_FOUND' | 'SOURCE_VERIFIED' | 'NOT_FOUND',
   *   responseHash: string,
   *   rawResponse: any,
   *   notes: string
   * }>}
   */
  async verifyRecord(trustedSource, queryParams) {
    throw new Error('verifyRecord must be implemented by adapter');
  }

  /**
   * Check domain and endpoint health/reachability.
   * @param {object} trustedSource
   * @returns {Promise<{ reachable: boolean, latencyMs: number }>}
   */
  async checkHealth(trustedSource) {
    throw new Error('checkHealth must be implemented by adapter');
  }
}

module.exports = SourceVerificationAdapter;

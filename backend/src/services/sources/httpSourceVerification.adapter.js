const SourceVerificationAdapter = require('./sourceVerification.adapter');
const { safeFetch } = require('../../utils/ssrfProtection');
const { ValidationError } = require('../../utils/errors');

/**
 * HTTP Source Verification Adapter
 * Production adapter for communicating with official external verification APIs
 * with full defense-in-depth SSRF protection.
 */
class HttpSourceVerificationAdapter extends SourceVerificationAdapter {
  /**
   * Query official source over HTTPS with SSRF safeguards.
   * @param {object} trustedSource
   * @param {object} queryParams
   */
  async verifyRecord(trustedSource, queryParams) {
    if (!trustedSource.baseUrl || !trustedSource.domain) {
      throw new ValidationError('Trusted source is missing baseUrl or domain configuration', 'INVALID_SOURCE_CONFIG');
    }

    const endpoint = trustedSource.verificationEndpoint || '/verify';
    const targetUrl = new URL(endpoint, trustedSource.baseUrl).toString();

    try {
      const response = await safeFetch(
        targetUrl,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(queryParams)
        },
        trustedSource.domain
      );

      let parsedData;
      try {
        parsedData = JSON.parse(response.body.toString('utf8'));
      } catch {
        parsedData = { text: response.body.toString('utf8') };
      }

      const verified = Boolean(parsedData.verified || parsedData.found);
      const isSigned = Boolean(parsedData.signature || parsedData.cryptographicallySigned);

      return {
        verified,
        sourceState: isSigned ? 'SOURCE_VERIFIED' : (verified ? 'SOURCE_FOUND' : 'NOT_FOUND'),
        responseHash: response.responseHash,
        rawResponse: parsedData,
        notes: isSigned
          ? `Cryptographically signed response from ${trustedSource.name}`
          : (verified ? `Confirmed by ${trustedSource.name} without cryptographic signature` : `Not found at ${trustedSource.name}`)
      };
    } catch (err) {
      throw new ValidationError(`Official source request failed: ${err.message}`, 'SOURCE_UNAVAILABLE');
    }
  }

  /**
   * Check domain health and SSL reachability.
   * @param {object} trustedSource
   */
  async checkHealth(trustedSource) {
    const startTime = Date.now();
    try {
      await safeFetch(trustedSource.baseUrl, { method: 'HEAD', timeout: 3000 }, trustedSource.domain);
      return {
        reachable: true,
        latencyMs: Date.now() - startTime
      };
    } catch {
      return {
        reachable: false,
        latencyMs: Date.now() - startTime
      };
    }
  }
}

module.exports = HttpSourceVerificationAdapter;

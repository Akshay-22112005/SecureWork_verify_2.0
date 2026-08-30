/**
 * AI Adapter Interface
 * Abstract contract for supplementary AI/ML document and risk analysis.
 */
class AIAdapter {
  /**
   * Analyze document, OCR text, and extracted fields for anomalies and risk.
   * @param {object} input - { document, ocrText, extractedFields }
   * @param {object} [options]
   * @returns {Promise<{
   *   status: 'SUCCESS' | 'UNAVAILABLE' | 'FAILED',
   *   riskLevel: 'LOW' | 'MEDIUM' | 'HIGH',
   *   score: number, // 0.0 - 1.0
   *   findings: Array<{ code: string, severity: string, description: string }>,
   *   modelName: string,
   *   modelVersion: string,
   *   durationMs: number,
   *   errorReason?: string
   * }>}
   */
  async analyze(input, options = {}) {
    throw new Error('analyze must be implemented by adapter');
  }

  /**
   * Check if AI model is available.
   * @returns {Promise<boolean>}
   */
  async isAvailable() {
    throw new Error('isAvailable must be implemented by adapter');
  }

  /**
   * Get operational mode ('FULL_LOCAL' | 'EXTERNAL_ADAPTER').
   * @returns {string}
   */
  getMode() {
    throw new Error('getMode must be implemented by adapter');
  }
}

module.exports = AIAdapter;

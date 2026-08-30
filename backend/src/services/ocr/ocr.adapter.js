/**
 * OCR Adapter Interface
 * Abstract contract for optical character recognition extraction engines.
 */
class OCRAdapter {
  /**
   * Extract text and structured metadata from an image buffer.
   * @param {Buffer} buffer - Raw image bytes (PNG, JPG, etc.)
   * @param {object} [options]
   * @returns {Promise<{
   *   status: 'SUCCESS' | 'UNAVAILABLE' | 'FAILED',
   *   ocrText: string,
   *   ocrEngine: string,
   *   ocrVersion: string,
   *   confidence: number,
   *   extractedFields: object,
   *   durationMs: number,
   *   errorReason?: string
   * }>}
   */
  async extractText(buffer, options = {}) {
    throw new Error('extractText must be implemented by adapter');
  }

  /**
   * Check if OCR engine is available locally.
   * @returns {Promise<boolean>}
   */
  async isAvailable() {
    throw new Error('isAvailable must be implemented by adapter');
  }

  /**
   * Get engine name and version metadata.
   * @returns {{ name: string, version: string }}
   */
  getEngineInfo() {
    throw new Error('getEngineInfo must be implemented by adapter');
  }
}

module.exports = OCRAdapter;

const OCRAdapter = require('./ocr.adapter');
const logger = require('../../utils/logger');
const { ValidationError } = require('../../utils/errors');

const MAX_OCR_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB limit
const OCR_EXECUTION_TIMEOUT_MS = 15000; // 15 seconds timeout

/**
 * Local OCR Adapter powered by Tesseract OCR (local/free).
 * Implements resource bounds, field extraction, and graceful unavailable mode.
 */
class LocalOCRAdapter extends OCRAdapter {
  constructor() {
    super();
    this.engineName = 'Tesseract.js (Local)';
    this.engineVersion = '5.1.1';
    this._forcedUnavailable = false;
  }

  getEngineInfo() {
    return {
      name: this.engineName,
      version: this.engineVersion
    };
  }

  /**
   * For testing: simulate OCR engine unavailable mode.
   * @param {boolean} unavailable
   */
  simulateUnavailable(unavailable = true) {
    this._forcedUnavailable = unavailable;
  }

  /**
   * Check if OCR engine is available.
   * @returns {Promise<boolean>}
   */
  async isAvailable() {
    if (this._forcedUnavailable) return false;
    try {
      require.resolve('tesseract.js');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Extract text from an image buffer using Tesseract OCR.
   * Bounds resource usage with file size caps and execution timeouts.
   * Never executes shell commands.
   * @param {Buffer} buffer - Image file bytes
   * @param {object} [options]
   */
  async extractText(buffer, options = {}) {
    const startTime = Date.now();

    // 1. Security Check: Enforce strict file size limits
    if (!buffer || !Buffer.isBuffer(buffer)) {
      throw new ValidationError('Invalid buffer provided for OCR analysis');
    }

    if (buffer.length > MAX_OCR_FILE_SIZE_BYTES) {
      throw new ValidationError(
        `Document size (${(buffer.length / (1024 * 1024)).toFixed(2)} MB) exceeds maximum OCR limit of 10 MB`,
        'OCR_FILE_TOO_LARGE'
      );
    }

    // 2. Unavailable Mode Check
    if (this._forcedUnavailable) {
      return {
        status: 'UNAVAILABLE',
        ocrText: '',
        ocrEngine: this.engineName,
        ocrVersion: this.engineVersion,
        confidence: 0,
        extractedFields: {},
        durationMs: Date.now() - startTime,
        errorReason: 'OCR analysis unavailable: local engine is disabled or offline'
      };
    }

    // 3. Execute Tesseract OCR with timeout bounds
    let worker;
    let timeoutId;
    try {
      const { createWorker } = require('tesseract.js');

      worker = await createWorker(options.lang || 'eng', 1, {
        errorHandler: (err) => logger.warn('Tesseract internal warning', { error: err.message })
      });

      const ocrPromise = worker.recognize(buffer);

      // Timeout race guard
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`OCR execution timed out after ${OCR_EXECUTION_TIMEOUT_MS}ms`));
        }, OCR_EXECUTION_TIMEOUT_MS);
      });

      const result = await Promise.race([ocrPromise, timeoutPromise]);
      clearTimeout(timeoutId);

      const durationMs = Date.now() - startTime;
      const rawText = (result.data && result.data.text) ? result.data.text.trim() : '';
      const confidence = (result.data && typeof result.data.confidence === 'number') ? result.data.confidence : 0;

      // Extract structured fields via heuristic parser
      const extractedFields = this.extractFieldsFromText(rawText);

      return {
        status: 'SUCCESS',
        ocrText: rawText,
        ocrEngine: this.engineName,
        ocrVersion: this.engineVersion,
        confidence,
        extractedFields,
        durationMs
      };
    } catch (err) {
      // Invariant: If Tesseract/local OCR fails or is unavailable,
      // return explicit unavailable state WITHOUT marking document as fraudulent!
      logger.warn('Local OCR execution encountered error or timeout, falling back to UNAVAILABLE mode', {
        error: err.message
      });

      return {
        status: 'UNAVAILABLE',
        ocrText: '',
        ocrEngine: this.engineName,
        ocrVersion: this.engineVersion,
        confidence: 0,
        extractedFields: {},
        durationMs: Date.now() - startTime,
        errorReason: `OCR analysis unavailable: ${err.message}`
      };
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
      if (worker) {
        await worker.terminate().catch(() => {});
      }
    }
  }

  /**
   * Deterministic regex heuristics for extracting structured fields from OCR text.
   * @param {string} text
   * @returns {object}
   */
  extractFieldsFromText(text) {
    if (!text || typeof text !== 'string') return {};

    const fields = {};
    const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

    // 1. Recipient Name Heuristics (single-line bound)
    const nameMatch = text.match(/(?:certifies that|conferred upon|awarded to|this is to certify that)[ \t]+([A-Z][a-zA-Z .-]+?)(?:\r?\n|,|$)/i)
      || text.match(/Name[ \t]*:[ \t]*([A-Z][a-zA-Z .-]+?)(?:\r?\n|,|$)/i);
    if (nameMatch && nameMatch[1]) {
      fields.recipientName = nameMatch[1].trim();
    }

    // 2. Organization / Institution Heuristics
    const orgMatch = text.match(/([A-Za-z ]+(?:University|College|Institute|Academy|Board|Department))/i);
    if (orgMatch && orgMatch[1]) {
      fields.organizationName = orgMatch[1].trim();
    }

    // 3. Credential Type Heuristics
    const credMatch = text.match(/(Bachelor of [A-Za-z ]+|Master of [A-Za-z ]+|Doctor of [A-Za-z ]+|Certificate of [A-Za-z ]+|Professional Engineer License|Diploma in [A-Za-z ]+)/i);
    if (credMatch && credMatch[1]) {
      fields.credentialType = credMatch[1].trim();
    }

    // 4. Dates
    const dateMatch = text.match(/(?:Date|Issued|Awarded|Conferred)[ \t]*:[ \t]*([A-Za-z0-9, /-]+?)(?:\r?\n|$)/i)
      || text.match(/\b(\d{4}[-/]\d{2}[-/]\d{2}|\w+ \d{1,2},? \d{4})\b/);
    if (dateMatch && dateMatch[1]) {
      fields.issueDate = dateMatch[1].trim();
    }

    // 5. Identifiers (License No, Reg No, Certificate ID)
    const idMatch = text.match(/(?:ID|License No|Reg No|Certificate No|Registration ID)[ \t]*:[ \t]*([A-Za-z0-9_-]+)/i);
    if (idMatch && idMatch[1]) {
      fields.identifier = idMatch[1].trim();
    }

    return fields;
  }
}

module.exports = LocalOCRAdapter;
module.exports.MAX_OCR_FILE_SIZE_BYTES = MAX_OCR_FILE_SIZE_BYTES;
module.exports.OCR_EXECUTION_TIMEOUT_MS = OCR_EXECUTION_TIMEOUT_MS;

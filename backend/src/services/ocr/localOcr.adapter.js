const path = require('path');
const fs = require('fs');
const OCRAdapter = require('./ocr.adapter');
const { extractFromPdf } = require('./pdfExtractor');
const logger = require('../../utils/logger');
const { ValidationError } = require('../../utils/errors');

const MAX_OCR_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB limit
const OCR_EXECUTION_TIMEOUT_MS = 15000; // 15 seconds timeout

/**
 * Locate directory containing local eng.traineddata for completely offline execution.
 */
function getTessdataPath() {
  const possiblePaths = [
    process.cwd(),
    path.resolve(process.cwd(), 'backend'),
    path.resolve(__dirname, '../../../'),
    path.resolve(__dirname, '../../'),
    path.resolve(__dirname, '../'),
    path.resolve(__dirname, './')
  ];

  for (const candidate of possiblePaths) {
    if (fs.existsSync(path.join(candidate, 'eng.traineddata'))) {
      return candidate;
    }
  }

  return process.cwd();
}

/**
 * Local OCR Adapter powered by Tesseract.js v7 (offline) and native PDF stream extraction.
 * Implements resource bounds, per-field confidence scoring, structured extraction, and timeout resilience.
 */
class LocalOCRAdapter extends OCRAdapter {
  constructor() {
    super();
    this.engineName = 'Tesseract.js (Local)';
    this.engineVersion = '7.0.0';
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
   * Extract text from image or PDF buffer.
   * Bounds resource usage with file size caps and execution timeouts.
   * @param {Buffer} buffer - File bytes
   * @param {object} [options]
   */
  async extractText(buffer, options = {}) {
    const startTime = Date.now();

    // 1. Enforce file size limit
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

    // 3. Detect file format
    const isPdf = buffer.length >= 4 && buffer.slice(0, 4).toString('utf8') === '%PDF';

    if (isPdf) {
      try {
        const pdfResult = extractFromPdf(buffer);
        let extractedText = pdfResult.text || '';

        // If direct text is found in PDF
        if (extractedText.length > 20) {
          const { fields, fieldConfidences, overallConfidence } = this.extractFieldsFromText(extractedText, 0.98);
          return {
            status: 'SUCCESS',
            ocrText: extractedText,
            ocrEngine: this.engineName,
            ocrVersion: this.engineVersion,
            confidence: overallConfidence,
            extractedFields: {
              ...fields,
              fieldConfidences
            },
            pdfMetadata: pdfResult.metadata || {},
            durationMs: Date.now() - startTime
          };
        }

        // If PDF is scanned with embedded image and text is empty
        if (pdfResult.embeddedImages && pdfResult.embeddedImages.length > 0) {
          logger.info('PDF text empty; running OCR on embedded image', {
            embeddedImagesCount: pdfResult.embeddedImages.length
          });
          const imageBuffer = pdfResult.embeddedImages[0];
          const imgOcr = await this._runTesseract(imageBuffer, options, startTime);
          return imgOcr;
        }

        // If minimal text extracted from PDF
        if (extractedText.length > 0) {
          const { fields, fieldConfidences, overallConfidence } = this.extractFieldsFromText(extractedText, 0.92);
          return {
            status: 'SUCCESS',
            ocrText: extractedText,
            ocrEngine: 'SecureWork PDF Stream Parser',
            ocrVersion: this.engineVersion,
            confidence: overallConfidence,
            extractedFields: {
              ...fields,
              fieldConfidences
            },
            pdfMetadata: pdfResult.metadata || {},
            durationMs: Date.now() - startTime
          };
        }
      } catch (pdfErr) {
        logger.warn('PDF stream extraction encountered warning, falling back to OCR recognition', {
          error: pdfErr.message
        });
      }
    }

    // 4. Run Tesseract OCR for image buffers
    return await this._runTesseract(buffer, options, startTime);
  }

  /**
   * Internal Tesseract Worker Runner with offline traineddata and strict timeout.
   */
  async _runTesseract(buffer, options, startTime) {
    let worker;
    let timeoutId;

    try {
      const { createWorker } = require('tesseract.js');
      const tessDataPath = getTessdataPath();

      worker = await createWorker(options.lang || 'eng', 1, {
        langPath: tessDataPath,
        gzip: false,
        errorHandler: (err) => logger.warn('Tesseract internal warning', { error: err.message })
      });

      const ocrPromise = worker.recognize(buffer);

      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(`OCR execution timed out after ${OCR_EXECUTION_TIMEOUT_MS}ms`));
        }, OCR_EXECUTION_TIMEOUT_MS);
      });

      const result = await Promise.race([ocrPromise, timeoutPromise]);
      clearTimeout(timeoutId);

      const durationMs = Date.now() - startTime;
      const rawText = (result.data && result.data.text) ? result.data.text.trim() : '';
      
      // Base confidence from OCR engine normalized to 0.0 - 1.0 scale
      const rawConf = (result.data && typeof result.data.confidence === 'number') ? result.data.confidence : 0;
      const ocrBaseConf = rawConf > 1 ? rawConf / 100 : rawConf;

      // Extract structured fields via heuristics
      const { fields, fieldConfidences, overallConfidence } = this.extractFieldsFromText(rawText, ocrBaseConf);

      return {
        status: 'SUCCESS',
        ocrText: rawText,
        ocrEngine: this.engineName,
        ocrVersion: this.engineVersion,
        confidence: overallConfidence,
        extractedFields: {
          ...fields,
          fieldConfidences
        },
        durationMs
      };
    } catch (err) {
      logger.warn('Local OCR execution encountered error or timeout, returning UNAVAILABLE status', {
        error: err.message
      });

      return {
        status: 'UNAVAILABLE',
        ocrText: '',
        ocrEngine: this.engineName,
        ocrVersion: this.engineVersion,
        confidence: 0,
        extractedFields: {
          fieldConfidences: {}
        },
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
   * Deterministic regex heuristics for extracting structured fields with per-field confidence scoring.
   * @param {string} text
   * @param {number} baseConfidence - Base OCR engine confidence (0.0 to 1.0)
   * @returns {{ fields: object, fieldConfidences: object, overallConfidence: number }}
   */
  extractFieldsFromText(text, baseConfidence = 0.90) {
    if (!text || typeof text !== 'string') {
      return {
        fields: {},
        fieldConfidences: {},
        overallConfidence: 0
      };
    }

    const fields = {};
    const fieldConfidences = {};

    // 1. Recipient Name
    const nameMatch = text.match(/(?:certifies that|conferred upon|awarded to|this is to certify that|presented to|granted to)[ \t]+([A-Z][a-zA-Z .-]+?)(?:\r?\n|,|$)/i)
      || text.match(/(?:Name|Recipient|Student Name)[ \t]*:[ \t]*([A-Z][a-zA-Z .-]+?)(?:\r?\n|,|$)/i)
      || text.match(/\b([A-Z][a-z]+ (?:[A-Z]\.? )?[A-Z][a-z]+)\b(?=.*(?:degree|completed|conferred|certifies))/i);

    if (nameMatch && nameMatch[1]) {
      fields.recipientName = nameMatch[1].trim();
      fieldConfidences.recipientName = Math.min(0.99, Number((baseConfidence * 0.98).toFixed(2)));
    } else {
      fieldConfidences.recipientName = 0;
    }

    // 2. Organization / Institution
    const orgMatch = text.match(/([A-Za-z ]+(?:University|College|Institute|Academy|Board|Department|School of [A-Za-z ]+|Polytechnic))/i)
      || text.match(/(?:Issued by|Issuer|Institution)[ \t]*:[ \t]*([A-Za-z0-9 .,-]+?)(?:\r?\n|$)/i);

    if (orgMatch && orgMatch[1]) {
      fields.organizationName = orgMatch[1].trim();
      fieldConfidences.organizationName = Math.min(0.99, Number((baseConfidence * 0.96).toFixed(2)));
    } else {
      fieldConfidences.organizationName = 0;
    }

    // 3. Credential Title / Degree
    const credMatch = text.match(/(Doctor of [A-Za-z ]+|Bachelor of [A-Za-z ]+|Master of [A-Za-z ]+|Certificate of [A-Za-z ]+|Certificate in [A-Za-z ]+|Professional Engineer License|Diploma in [A-Za-z ]+|Degree of [A-Za-z ]+|Certified [A-Za-z ]+ Specialist)/i)
      || text.match(/(?:Credential|Degree|Title|Program)[ \t]*:[ \t]*([A-Za-z0-9 .,-]+?)(?:\r?\n|$)/i);

    if (credMatch && credMatch[1]) {
      fields.credentialTitle = credMatch[1].trim();
      fields.credentialType = fields.credentialTitle; // backward-compatible alias
      fieldConfidences.credentialTitle = Math.min(0.99, Number((baseConfidence * 0.99).toFixed(2)));
      fieldConfidences.credentialType = fieldConfidences.credentialTitle;
    } else {
      fieldConfidences.credentialTitle = 0;
      fieldConfidences.credentialType = 0;
    }

    // 4. Issue / Conferred Date
    const dateMatch = text.match(/(?:Date|Issued|Awarded|Conferred|Date of Issue)[ \t]*:[ \t]*([A-Za-z0-9, /-]+?)(?:\r?\n|$)/i)
      || text.match(/\b((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]* \d{1,2},? \d{4}|\d{4}[-/.]\d{2}[-/.]\d{2}|\d{2}[-/.]\d{2}[-/.]\d{4})\b/i);

    if (dateMatch && dateMatch[1]) {
      fields.issueDate = dateMatch[1].trim();
      fieldConfidences.issueDate = Math.min(0.99, Number((baseConfidence * 0.95).toFixed(2)));
    } else {
      fieldConfidences.issueDate = 0;
    }

    // 5. Identifier / Certificate ID / License No
    const idMatch = text.match(/(?:Certificate No|License No|Reg No|Registration ID|Credential ID|Doc ID|ID No)[ \t]*:?[ \t]*([A-Za-z0-9_-]+)/i)
      || text.match(/\b([A-Z]{2,6}-\d{4,8}-[A-Z0-9]{2,8})\b/i);

    if (idMatch && idMatch[1]) {
      fields.identifier = idMatch[1].trim();
      fieldConfidences.identifier = Math.min(0.99, Number((baseConfidence * 0.94).toFixed(2)));
    } else {
      fieldConfidences.identifier = 0;
    }

    // Compute aggregate confidence
    const extractedCount = Object.keys(fields).length;
    const scores = Object.values(fieldConfidences).filter(s => s > 0);
    let overallConfidence = 0;

    if (scores.length > 0) {
      const avgConfidence = scores.reduce((a, b) => a + b, 0) / scores.length;
      overallConfidence = Number(((avgConfidence * 0.7) + (baseConfidence * 0.3)).toFixed(2));
    } else {
      overallConfidence = Number((baseConfidence * 0.5).toFixed(2));
    }

    return {
      fields,
      fieldConfidences,
      overallConfidence: Math.min(1.0, Math.max(0.0, overallConfidence))
    };
  }
}

module.exports = LocalOCRAdapter;
module.exports.MAX_OCR_FILE_SIZE_BYTES = MAX_OCR_FILE_SIZE_BYTES;
module.exports.OCR_EXECUTION_TIMEOUT_MS = OCR_EXECUTION_TIMEOUT_MS;

const AIAdapter = require('./ai.adapter');
const logger = require('../../utils/logger');

const MODES = {
  FULL_LOCAL: 'FULL_LOCAL',
  EXTERNAL_ADAPTER: 'EXTERNAL_ADAPTER'
};

/**
 * Local AI/ML Heuristic Tamper Analysis Adapter.
 * Inspects document bytes, PDF structure, image compression/metadata, and OCR text
 * for tampering, post-generation edits, font discrepancies, and metadata inconsistencies.
 * 
 * Invariant: Output is purely supplementary/advisory and NEVER overrides cryptographic truth.
 */
class LocalAIAdapter extends AIAdapter {
  constructor(mode = MODES.FULL_LOCAL) {
    super();
    this.mode = mode;
    this.modelName = 'SecureWork Heuristic Tamper Classifier';
    this.modelVersion = '2.1.0';
    this._forcedUnavailable = false;
  }

  getMode() {
    return this.mode;
  }

  setMode(mode) {
    if (Object.values(MODES).includes(mode)) {
      this.mode = mode;
    }
  }

  simulateUnavailable(unavailable = true) {
    this._forcedUnavailable = unavailable;
  }

  async isAvailable() {
    return !this._forcedUnavailable;
  }

  /**
   * Execute heuristic AI tamper analysis.
   * @param {object} input - { document, fileBuffer, ocrText, extractedFields, pdfMetadata }
   * @param {object} [options]
   */
  async analyze(input, options = {}) {
    const startTime = Date.now();

    if (this._forcedUnavailable) {
      return {
        status: 'UNAVAILABLE',
        riskLevel: 'LOW',
        score: 0,
        findings: [],
        modelName: this.modelName,
        modelVersion: this.modelVersion,
        durationMs: Date.now() - startTime,
        errorReason: 'AI analysis unavailable: local model is offline or disabled'
      };
    }

    try {
      const ocrText = (input && input.ocrText) ? input.ocrText : '';
      const extractedFields = (input && input.extractedFields) ? input.extractedFields : {};
      const document = (input && input.document) ? input.document : {};
      const fileBuffer = input && input.fileBuffer ? input.fileBuffer : null;
      const pdfMetadata = (input && input.pdfMetadata) ? input.pdfMetadata : {};

      const findings = [];
      let anomalyScore = 0.05; // Base clean document baseline score

      // ------------------------------------------------------------------
      // 1. Metadata Inconsistencies & Post-Creation Modification Checks
      // ------------------------------------------------------------------
      if (fileBuffer && Buffer.isBuffer(fileBuffer)) {
        const fileStr = fileBuffer.toString('latin1');
        const isPdf = fileStr.startsWith('%PDF');
        const isJpeg = fileBuffer[0] === 0xFF && fileBuffer[1] === 0xD8;
        const isPng = fileBuffer[0] === 0x89 && fileBuffer[1] === 0x50 && fileBuffer[2] === 0x4E && fileBuffer[3] === 0x47;

        // Check PDF structure
        if (isPdf) {
          // Multiple trailers (incremental updates)
          const trailerMatches = fileStr.match(/trailer\b/g);
          const xrefMatches = fileStr.match(/xref\b/g);
          if ((trailerMatches && trailerMatches.length > 1) || (xrefMatches && xrefMatches.length > 1)) {
            findings.push({
              code: 'INCREMENTAL_PDF_UPDATES',
              severity: 'MEDIUM',
              description: `PDF contains ${trailerMatches ? trailerMatches.length : 'multiple'} incremental revision trailers, indicating the document was modified after initial creation.`
            });
            anomalyScore += 0.25;
          }

          // Editing software keywords in PDF streams/producers
          const editingSoftware = [
            'photoshop', 'canva', 'gimp', 'illustrator', 'inkscape', 'coreldraw',
            'nitro pdf', 'foxit phantom', 'pdf-xchange', 'sejda', 'ilovepdf'
          ];
          const lowerStr = fileStr.toLowerCase();
          for (const soft of editingSoftware) {
            if (lowerStr.includes(soft)) {
              findings.push({
                code: 'EDITING_SOFTWARE_METADATA',
                severity: 'HIGH',
                description: `Document metadata references graphic editing/manipulation software: "${soft}".`
              });
              anomalyScore += 0.35;
              break;
            }
          }

          // CreationDate vs ModDate discrepancy
          const createMatch = fileStr.match(/\/CreationDate\s*\((?:D:)?(\d{4})(\d{2})(\d{2})([^)]*)\)/i);
          const modMatch = fileStr.match(/\/ModDate\s*\((?:D:)?(\d{4})(\d{2})(\d{2})([^)]*)\)/i);
          if (createMatch && modMatch) {
            const createDateStr = `${createMatch[1]}-${createMatch[2]}-${createMatch[3]}`;
            const modDateStr = `${modMatch[1]}-${modMatch[2]}-${modMatch[3]}`;
            if (createDateStr !== modDateStr) {
              const diffDays = Math.abs((new Date(modDateStr) - new Date(createDateStr)) / (1000 * 60 * 60 * 24));
              if (diffDays > 0) {
                findings.push({
                  code: 'METADATA_DATE_DISCREPANCY',
                  severity: 'MEDIUM',
                  description: `PDF Modification Date (${modDateStr}) differs from Creation Date (${createDateStr}) by ${Math.round(diffDays)} days.`
                });
                anomalyScore += 0.20;
              }
            }
          }
        }

        // Check JPEG ELA / Quantization Table Anomalies & Photoshop Headers
        if (isJpeg) {
          // Photoshop IRB 8BIM marker (0x38 0x42 0x49 0x4D)
          if (fileStr.includes('8BIM') || fileStr.includes('Adobe Photoshop') || fileStr.includes('Photoshop 3.0')) {
            findings.push({
              code: 'PHOTOSHOP_IMAGE_HEADER',
              severity: 'HIGH',
              description: 'Image file contains Adobe Photoshop IRB/8BIM application resource blocks.'
            });
            anomalyScore += 0.40;
          }

          // Quantization Table (DQT 0xFF 0xDB) count
          let dqtCount = 0;
          for (let i = 0; i < fileBuffer.length - 1; i++) {
            if (fileBuffer[i] === 0xFF && fileBuffer[i + 1] === 0xDB) {
              dqtCount++;
            }
          }
          if (dqtCount > 2) {
            findings.push({
              code: 'MULTIPLE_QUANTIZATION_TABLES',
              severity: 'LOW',
              description: `Image contains ${dqtCount} JPEG DQT quantization tables, suggesting re-compression or spliced elements.`
            });
            anomalyScore += 0.15;
          }
        }

        // Check PNG Text Chunk Modifiers
        if (isPng) {
          if (fileStr.includes('Software\0Adobe') || fileStr.includes('Software\0GIMP') || fileStr.includes('Software\0Canva')) {
            findings.push({
              code: 'PNG_EDITING_CHUNK',
              severity: 'HIGH',
              description: 'PNG ancillary text chunks indicate export from graphic editing software.'
            });
            anomalyScore += 0.35;
          }
        }
      }

      // ------------------------------------------------------------------
      // 2. Font & Text Inconsistency Checks
      // ------------------------------------------------------------------
      // Mixed Cyrillic / Latin Homoglyphs check (e.g. Cyrillic 'а', 'е', 'о', 'р', 'с', 'х')
      const cyrillicHomoglyphRegex = /[\u0430\u0435\u043E\u0440\u0441\u0445\u0406\u0456]/g;
      const homoglyphMatches = ocrText.match(cyrillicHomoglyphRegex);
      if (homoglyphMatches && homoglyphMatches.length >= 2) {
        findings.push({
          code: 'HOMOGLYPH_OBFUSCATION',
          severity: 'HIGH',
          description: `Detected ${homoglyphMatches.length} mixed Cyrillic/Latin homoglyph characters often used to evade automated text verification.`
        });
        anomalyScore += 0.35;
      }

      // Suspicious Tampering Terms
      const suspiciousTerms = [
        { term: 'photoshop', code: 'EDITING_SOFTWARE_DETECTED', severity: 'HIGH', desc: 'Document contains reference to photo editing software.' },
        { term: 'specimen', code: 'SPECIMEN_MARKER', severity: 'HIGH', desc: 'Document contains specimen or preview marker.' },
        { term: 'replica', code: 'REPLICA_INDICATOR', severity: 'CRITICAL', desc: 'Document labeled as replica or novelty item.' },
        { term: 'diploma mill', code: 'DIPLOMA_MILL_FLAG', severity: 'CRITICAL', desc: 'Document references unaccredited entity or diploma mill.' },
        { term: 'unofficial copy', code: 'UNOFFICIAL_COPY', severity: 'MEDIUM', desc: 'Document is watermarked as unofficial copy.' },
        { term: 'sample only', code: 'SAMPLE_MARKER', severity: 'HIGH', desc: 'Watermark or label indicates sample document.' },
        { term: 'void', code: 'VOID_MARKER', severity: 'CRITICAL', desc: 'Document contains void or canceled marker.' },
        { term: 'fake credential', code: 'EXPLICIT_TAMPER_KEYWORD', severity: 'CRITICAL', desc: 'Document contains explicit counterfeit indicator keyword.' }
      ];

      const lowerText = ocrText.toLowerCase();
      for (const item of suspiciousTerms) {
        if (lowerText.includes(item.term)) {
          findings.push({
            code: item.code,
            severity: item.severity,
            description: item.desc
          });
          anomalyScore += item.severity === 'CRITICAL' ? 0.6 : item.severity === 'HIGH' ? 0.4 : 0.2;
        }
      }

      // ------------------------------------------------------------------
      // 3. Logical & Date Inconsistencies
      // ------------------------------------------------------------------
      if (extractedFields.issueDate) {
        const parsedDate = new Date(extractedFields.issueDate);
        if (!isNaN(parsedDate.getTime())) {
          const now = new Date();
          if (parsedDate > now) {
            findings.push({
              code: 'FUTURE_ISSUE_DATE',
              severity: 'HIGH',
              description: `Credential issue date (${extractedFields.issueDate}) is set in the future.`
            });
            anomalyScore += 0.40;
          } else if (parsedDate.getFullYear() < 1920) {
            findings.push({
              code: 'ANOMALOUS_HISTORICAL_DATE',
              severity: 'MEDIUM',
              description: `Credential issue date (${extractedFields.issueDate}) precedes historical baseline (1920).`
            });
            anomalyScore += 0.25;
          }
        }
      }

      // Incomplete text check
      if (!ocrText || ocrText.trim().length < 10) {
        findings.push({
          code: 'INSUFFICIENT_TEXT_CONTENT',
          severity: 'LOW',
          description: 'Document contains minimal or no readable text; manual verification recommended.'
        });
        anomalyScore += 0.10;
      }

      // Clamp score
      anomalyScore = Math.min(1.0, Math.max(0.0, Number(anomalyScore.toFixed(2))));

      let riskLevel = 'LOW';
      if (anomalyScore >= 0.70) {
        riskLevel = 'HIGH';
      } else if (anomalyScore >= 0.35) {
        riskLevel = 'MEDIUM';
      }

      const tamperingDetected = anomalyScore >= 0.50 || findings.some(f => f.severity === 'CRITICAL' || f.severity === 'HIGH');

      return {
        status: 'SUCCESS',
        riskLevel,
        score: anomalyScore,
        riskScore: anomalyScore,
        tamperingDetected,
        findings,
        modelName: this.modelName,
        modelVersion: this.modelVersion,
        isAdvisory: true,
        advisoryNotice: 'AI Tamper Analysis is supplementary and heuristic. It cannot override cryptographic verification.',
        durationMs: Date.now() - startTime
      };
    } catch (err) {
      logger.warn('Local AI analysis encountered error, returning UNAVAILABLE status', {
        error: err.message
      });

      return {
        status: 'UNAVAILABLE',
        riskLevel: 'LOW',
        score: 0,
        riskScore: 0,
        tamperingDetected: false,
        findings: [],
        modelName: this.modelName,
        modelVersion: this.modelVersion,
        isAdvisory: true,
        durationMs: Date.now() - startTime,
        errorReason: `AI analysis unavailable: ${err.message}`
      };
    }
  }
}

module.exports = LocalAIAdapter;
module.exports.MODES = MODES;

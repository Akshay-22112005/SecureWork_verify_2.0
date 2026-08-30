const AIAdapter = require('./ai.adapter');
const logger = require('../../utils/logger');

const MODES = {
  FULL_LOCAL: 'FULL_LOCAL',
  EXTERNAL_ADAPTER: 'EXTERNAL_ADAPTER'
};

/**
 * Local AI/ML Adapter.
 * Analyzes document text and structured fields for risk and tampering indicators locally.
 * Works completely offline without external paid APIs.
 */
class LocalAIAdapter extends AIAdapter {
  constructor(mode = MODES.FULL_LOCAL) {
    super();
    this.mode = mode;
    this.modelName = 'SecureWork Local Heuristic/Classifier';
    this.modelVersion = '1.2.0';
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

  /**
   * For testing: simulate local AI model unavailable state.
   * @param {boolean} unavailable
   */
  simulateUnavailable(unavailable = true) {
    this._forcedUnavailable = unavailable;
  }

  async isAvailable() {
    return !this._forcedUnavailable;
  }

  /**
   * Execute local AI risk analysis on document text and fields.
   * @param {object} input - { document, ocrText, extractedFields }
   * @param {object} [options]
   */
  async analyze(input, options = {}) {
    const startTime = Date.now();

    // 1. Check Unavailable Mode
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
      const document = input && input.document ? input.document : {};

      const findings = [];
      let score = 0.05; // Base clean confidence score

      // Check 1: Suspicious Tampering Keywords
      const suspiciousTerms = [
        { term: 'photoshop', code: 'EDITING_SOFTWARE_DETECTED', severity: 'HIGH', desc: 'Document contains reference to photo editing software' },
        { term: 'specimen', code: 'SPECIMEN_MARKER', severity: 'HIGH', desc: 'Document contains specimen or preview marker' },
        { term: 'replica', code: 'REPLICA_INDICATOR', severity: 'CRITICAL', desc: 'Document labeled as replica or novelty' },
        { term: 'diploma mill', code: 'DIPLOMA_MILL_FLAG', severity: 'CRITICAL', desc: 'Mention of unaccredited diploma mill entity' },
        { term: 'unofficial copy', code: 'UNOFFICIAL_COPY', severity: 'MEDIUM', desc: 'Document marked as unofficial student copy' },
        { term: 'sample only', code: 'SAMPLE_MARKER', severity: 'HIGH', desc: 'Watermark or label indicates sample document' },
        { term: 'void', code: 'VOID_MARKER', severity: 'CRITICAL', desc: 'Document contains void or canceled indicator' }
      ];

      const lowerText = ocrText.toLowerCase();
      for (const item of suspiciousTerms) {
        if (lowerText.includes(item.term)) {
          findings.push({
            code: item.code,
            severity: item.severity,
            description: item.desc
          });
          score += item.severity === 'CRITICAL' ? 0.6 : item.severity === 'HIGH' ? 0.4 : 0.2;
        }
      }

      // Check 2: Date Anomalies
      if (extractedFields.issueDate) {
        const parsedDate = new Date(extractedFields.issueDate);
        if (!isNaN(parsedDate.getTime())) {
          const now = new Date();
          if (parsedDate > now) {
            findings.push({
              code: 'FUTURE_ISSUE_DATE',
              severity: 'HIGH',
              description: `Credential issue date (${extractedFields.issueDate}) is in the future`
            });
            score += 0.4;
          } else if (parsedDate.getFullYear() < 1920) {
            findings.push({
              code: 'ANOMALOUS_HISTORICAL_DATE',
              severity: 'MEDIUM',
              description: `Credential issue date (${extractedFields.issueDate}) is implausibly old`
            });
            score += 0.25;
          }
        }
      }

      // Check 3: Text & Document Completeness
      if (!ocrText || ocrText.trim().length === 0) {
        findings.push({
          code: 'INSUFFICIENT_TEXT_CONTENT',
          severity: 'LOW',
          description: 'Minimal or no readable text detected in document image'
        });
        score += 0.1;
      }

      // Check 4: Representation Type Risk
      if (document.representationType === 'SCREENSHOT' || document.representationType === 'SCAN') {
        findings.push({
          code: 'NON_ORIGINAL_REPRESENTATION',
          severity: 'INFO',
          description: `Document representation is ${document.representationType}. Visual artifacts may be present.`
        });
        score += 0.05;
      }

      // Clamp risk score to [0, 1]
      score = Math.min(1.0, Math.max(0.0, score));

      // Classify riskLevel
      let riskLevel = 'LOW';
      if (score >= 0.70) {
        riskLevel = 'HIGH';
      } else if (score >= 0.35) {
        riskLevel = 'MEDIUM';
      }

      return {
        status: 'SUCCESS',
        riskLevel,
        score: Number(score.toFixed(2)),
        findings,
        modelName: this.modelName,
        modelVersion: this.modelVersion,
        durationMs: Date.now() - startTime
      };
    } catch (err) {
      logger.warn('Local AI analysis encountered error, falling back to UNAVAILABLE mode', {
        error: err.message
      });

      return {
        status: 'UNAVAILABLE',
        riskLevel: 'LOW',
        score: 0,
        findings: [],
        modelName: this.modelName,
        modelVersion: this.modelVersion,
        durationMs: Date.now() - startTime,
        errorReason: `AI analysis unavailable: ${err.message}`
      };
    }
  }
}

module.exports = LocalAIAdapter;
module.exports.MODES = MODES;

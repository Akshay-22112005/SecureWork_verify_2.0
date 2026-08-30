/**
 * OCR Adapter Interface
 * Enables pluggable OCR engines (Local Tesseract.js / CLI) without paid cloud vision APIs.
 */

class OcrAdapter {
  async processImage(imageBuffer, options = {}) {
    throw new Error('Method not implemented');
  }

  async extractText(imageBuffer) {
    throw new Error('Method not implemented');
  }
}

class TesseractOcrAdapter extends OcrAdapter {
  constructor(config = {}) {
    super();
    this.config = config;
  }
  // Detailed implementation planned for Phase 4
}

module.exports = {
  OcrAdapter,
  TesseractOcrAdapter
};

const OcrAdapter = require('../services/ocr/ocr.adapter');
const LocalOcrAdapter = require('../services/ocr/localOcr.adapter');

module.exports = {
  OcrAdapter,
  LocalOcrAdapter,
  TesseractOcrAdapter: LocalOcrAdapter
};

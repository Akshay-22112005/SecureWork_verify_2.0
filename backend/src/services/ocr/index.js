const OCRAdapter = require('./ocr.adapter');
const LocalOCRAdapter = require('./localOcr.adapter');

const localOcrAdapter = new LocalOCRAdapter();
let activeOcrAdapter = localOcrAdapter;

function getOcrAdapter() {
  return activeOcrAdapter;
}

function setOcrAdapter(adapter) {
  activeOcrAdapter = adapter;
}

module.exports = {
  OCRAdapter,
  LocalOCRAdapter,
  localOcrAdapter,
  getOcrAdapter,
  setOcrAdapter
};

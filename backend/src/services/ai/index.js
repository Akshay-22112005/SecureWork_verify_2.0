const AIAdapter = require('./ai.adapter');
const LocalAIAdapter = require('./localAi.adapter');

const localAiAdapter = new LocalAIAdapter();
let activeAiAdapter = localAiAdapter;

function getAiAdapter() {
  return activeAiAdapter;
}

function setAiAdapter(adapter) {
  activeAiAdapter = adapter;
}

module.exports = {
  AIAdapter,
  LocalAIAdapter,
  localAiAdapter,
  getAiAdapter,
  setAiAdapter
};

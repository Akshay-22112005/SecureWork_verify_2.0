const SourceVerificationAdapter = require('./sourceVerification.adapter');
const LocalSourceVerificationAdapter = require('./localSourceVerification.adapter');
const HttpSourceVerificationAdapter = require('./httpSourceVerification.adapter');

// Default active adapter: LocalSourceVerificationAdapter for local development & testing
const localAdapter = new LocalSourceVerificationAdapter();
const httpAdapter = new HttpSourceVerificationAdapter();

let activeAdapter = localAdapter;

function setSourceAdapter(adapter) {
  activeAdapter = adapter;
}

function getSourceAdapter() {
  return activeAdapter;
}

module.exports = {
  SourceVerificationAdapter,
  LocalSourceVerificationAdapter,
  HttpSourceVerificationAdapter,
  localAdapter,
  httpAdapter,
  getSourceAdapter,
  setSourceAdapter
};

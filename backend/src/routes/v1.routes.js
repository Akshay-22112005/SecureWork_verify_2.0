const express = require('express');
const router = express.Router();
const { authenticateApiKey } = require('../middleware/apiKeyAuth');
const verificationEngine = require('../services/verification/verificationEngine');
const { successResponse } = require('../utils/response');

/**
 * High-Performance B2B Verification Endpoint (POST /api/v1/verify)
 * Authenticated via x-api-key header.
 */
router.post('/verify', authenticateApiKey, async (req, res, next) => {
  try {
    const { credentialId, documentHash } = req.body;
    const result = await verificationEngine.evaluateVerification({
      credentialId,
      documentHash
    }, req.user);

    return successResponse(res, {
      verification: result,
      verifiedAt: new Date().toISOString(),
      apiKeyId: req.apiKey.keyId
    }, 200);
  } catch (err) {
    next(err);
  }
});

module.exports = router;

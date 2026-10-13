const express = require('express');
const CredentialVersion = require('../models/credentialVersion.model');
const Credential = require('../models/credential.model');
const Organization = require('../models/organization.model');
const Issuer = require('../models/issuer.model');

const router = express.Router();

router.post('/document-hash', async (req, res, next) => {
  try {
    const hash = typeof req.body?.hash === 'string' ? req.body.hash.trim().toLowerCase() : '';
    if (!/^[a-f0-9]{64}$/.test(hash)) {
      return res.status(400).json({ success: false, error: { message: 'A valid SHA-256 hash is required.' } });
    }

    const version = await CredentialVersion.findOne({ documentHash: hash }).lean();
    if (!version) {
      return res.json({ success: true, data: { matchedOrganization: null, credentialId: null, issuerDetails: null } });
    }

    const credential = await Credential.findOne({ credentialId: version.credentialId }).lean();
    const issuer = credential ? await Issuer.findOne({ issuerId: credential.issuerId }).lean() : null;
    const organization = credential
      ? await Organization.findOne({ organizationId: credential.organizationId }).lean()
      : null;

    return res.json({
      success: true,
      data: {
        matchedOrganization: organization ? {
          name: organization.name,
          domain: organization.officialDomain,
          trustStatus: organization.organizationVerificationStatus,
          logoUrl: organization.logoUrl || null
        } : null,
        credentialId: version.credentialId,
        issuerDetails: issuer ? { issuerId: issuer.issuerId, issuerCode: issuer.issuerCode, status: issuer.status } : null
      }
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

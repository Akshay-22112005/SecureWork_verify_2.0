const express = require('express');
const verificationController = require('../controllers/verification.controller');
const { optionalAuthenticateUser, authenticateUser, requireRole } = require('../middleware/auth');

const router = express.Router();

// List verifications (public or authenticated)
router.get('/', optionalAuthenticateUser, verificationController.listVerifications);

// Evaluate credential verification (public or authenticated)
router.post('/evaluate', optionalAuthenticateUser, verificationController.evaluateVerification);

// Query an official trusted source for verification evidence
router.post('/verify-source', optionalAuthenticateUser, verificationController.verifySource);

// View discrete historical evidence records for a verification
router.get('/:id/evidence', optionalAuthenticateUser, verificationController.getVerificationEvidence);

// Submit manual human verification review (RBAC: ADMIN, AUDITOR, HR)
router.post('/:id/manual-review', authenticateUser, requireRole('ADMIN', 'AUDITOR', 'HR'), verificationController.submitManualReview);

// View past verification report by ID
router.get('/:id', optionalAuthenticateUser, verificationController.getVerification);

// View verification history for a credential (authenticated)
router.get('/credential/:credentialId', authenticateUser, verificationController.getCredentialVerifications);

module.exports = router;

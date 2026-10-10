const express = require('express');
const hrController = require('../controllers/hr.controller');
const { authenticateUser, requireRole } = require('../middleware/auth');
const { createRateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// HR and ADMIN rate limiter (e.g. 60 requests / minute)
const hrRateLimiter = createRateLimiter({
  windowMs: 60 * 1000,
  max: 60,
  message: 'HR lookup rate limit exceeded. Please wait before querying more candidate records.'
});

// All HR routes require authentication and HR / ADMIN role
router.use(authenticateUser);
router.use(requireRole('ADMIN', 'HR'));
router.use(hrRateLimiter);

// Lookup candidate subject and list all their credentials
router.get('/subjects/:userIdOrEmail/credentials', hrController.getSubjectCredentials);

// Verify candidate credential with owner matching check
router.post('/verify', hrController.verifyCandidateCredential);

module.exports = router;

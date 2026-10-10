const express = require('express');
const healthRoutes = require('./health.routes');
const authRoutes = require('./auth.routes');
const userRoutes = require('./user.routes');
const organizationRoutes = require('./organization.routes');
const issuerRoutes = require('./issuer.routes');
const issuerKeyRoutes = require('./issuerKey.routes');
const documentRoutes = require('./document.routes');
const credentialRoutes = require('./credential.routes');
const verificationRoutes = require('./verification.routes');
const trustedSourceRoutes = require('./trustedSource.routes');
const ocrRoutes = require('./ocr.routes');
const auditLogRoutes = require('./auditLog.routes');
const notificationRoutes = require('./notification.routes');
const publicRoutes = require('./public.routes');
const v1Routes = require('./v1.routes');
const apiKeyRoutes = require('./apiKey.routes');
const webhookRoutes = require('./webhook.routes');
const analyticsRoutes = require('./analytics.routes');
const hrRoutes = require('./hr.routes');

const router = express.Router();

// Mount API Route modules
router.use('/public', publicRoutes);
router.use('/v1', v1Routes);
router.use('/api-keys', apiKeyRoutes);
router.use('/webhooks', webhookRoutes);
router.use('/analytics', analyticsRoutes);
router.use('/hr', hrRoutes);
router.use('/health', healthRoutes);
router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/organizations', organizationRoutes);
router.use('/issuers', issuerRoutes);
router.use('/issuer-keys', issuerKeyRoutes);
router.use('/documents', documentRoutes);
router.use('/credentials', credentialRoutes);
router.use('/verifications', verificationRoutes);
router.use('/trusted-sources', trustedSourceRoutes);
router.use('/analysis', ocrRoutes);
router.use('/audit-logs', auditLogRoutes);
router.use('/notifications', notificationRoutes);

// Root API index info
router.get('/', (req, res) => {
  res.json({
    name: 'SecureWork Verify API',
    version: '0.1.0',
    status: 'online',
    phase: 'Phase 13 - Notifications + Backend Integration',
    documentation: '/docs',
    endpoints: {
      health: '/api/health',
      auth: {
        register: 'POST /api/auth/register',
        login: 'POST /api/auth/login',
        me: 'GET /api/auth/me'
      },
      users: {
        me: 'GET /api/users/me',
        updateMe: 'PATCH /api/users/me',
        getById: 'GET /api/users/:id',
        updateRole: 'PATCH /api/users/:id/role'
      },
      organizations: {
        create: 'POST /api/organizations',
        list: 'GET /api/organizations',
        getById: 'GET /api/organizations/:id',
        verify: 'POST /api/organizations/:id/verify',
        suspend: 'PATCH /api/organizations/:id/suspend',
        revoke: 'PATCH /api/organizations/:id/revoke'
      },
      issuers: {
        register: 'POST /api/issuers/register',
        list: 'GET /api/issuers',
        me: 'GET /api/issuers/me',
        approve: 'PATCH /api/issuers/:id/approve',
        suspend: 'PATCH /api/issuers/:id/suspend',
        revoke: 'PATCH /api/issuers/:id/revoke',
        rotateKey: 'POST /api/issuers/:id/rotate-key'
      },
      issuerKeys: {
        list: 'GET /api/issuer-keys',
        getById: 'GET /api/issuer-keys/:id',
        compromise: 'PATCH /api/issuer-keys/:id/compromise',
        revoke: 'PATCH /api/issuer-keys/:id/revoke'
      },
      documents: {
        list: 'GET /api/documents',
        upload: 'POST /api/documents/upload',
        getById: 'GET /api/documents/:id',
        download: 'GET /api/documents/:id/download'
      },
      credentials: {
        issue: 'POST /api/credentials/issue',
        list: 'GET /api/credentials',
        getById: 'GET /api/credentials/:id',
        versions: 'GET /api/credentials/:id/versions',
        createVersion: 'POST /api/credentials/:id/versions',
        revoke: 'PATCH /api/credentials/:id/revoke',
        timeline: 'GET /api/credentials/:id/timeline'
      },
      verifications: {
        evaluate: 'POST /api/verifications/evaluate',
        getById: 'GET /api/verifications/:id',
        getByCredential: 'GET /api/verifications/credential/:credentialId'
      }
    }
  });
});

module.exports = router;

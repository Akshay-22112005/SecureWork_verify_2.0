const express = require('express');
const organizationController = require('../controllers/organization.controller');
const { authenticateUser, requireRole } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

const router = express.Router();

router.use(authenticateUser, requireRole('ADMIN'));
router.get('/organizations/:id/users', organizationController.getOrganizationUsers);
router.get('/organizations/:id/users/search', organizationController.searchOrganizationUser);
router.post('/organizations/:id/users', organizationController.assignUserToOrganization);
router.post('/organizations/:id/users/invite', organizationController.inviteUserToOrganization);
router.delete('/organizations/:id/users/:userId', organizationController.removeUserFromOrganization);
router.post('/organizations/:id/users/bulk-csv', upload.single('file'), organizationController.bulkUploadOrganizationUsers);
router.post('/organizations/:id/users/:userId/resend-invite', organizationController.resendUserInvitation);
router.post('/organizations/:id/sources', organizationController.createOrganizationTrustedSource);
router.patch('/organizations/:id/sources/:sourceId/verify', organizationController.verifyOrganizationTrustedSource);

module.exports = router;

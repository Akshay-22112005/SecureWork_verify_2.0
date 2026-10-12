const express = require('express');
const organizationController = require('../controllers/organization.controller');
const { authenticateUser, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(authenticateUser, requireRole('ADMIN'));
router.get('/organizations/:id/users', organizationController.getOrganizationUsers);
router.post('/organizations/:id/users', organizationController.assignUserToOrganization);
router.delete('/organizations/:id/users/:userId', organizationController.removeUserFromOrganization);

module.exports = router;

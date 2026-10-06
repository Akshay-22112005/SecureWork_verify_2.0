const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analytics.controller');
const { authenticateUser } = require('../middleware/auth');

router.get('/overview', authenticateUser, (req, res, next) => analyticsController.getOverview(req, res, next));

module.exports = router;

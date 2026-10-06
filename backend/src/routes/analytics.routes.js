const express = require('express');
const router = express.Router();
const analyticsController = require('../controllers/analytics.controller');

router.get('/overview', (req, res, next) => analyticsController.getOverview(req, res, next));

module.exports = router;

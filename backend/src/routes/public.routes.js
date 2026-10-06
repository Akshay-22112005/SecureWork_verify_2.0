const express = require('express');
const router = express.Router();
const publicController = require('../controllers/public.controller');

// Public verification portal routes (No login required)
router.get('/verify/:id', (req, res, next) => publicController.verifyCredential(req, res, next));
router.get('/pdf/:id', (req, res, next) => publicController.downloadPdf(req, res, next));
router.get('/bundle/:id', (req, res, next) => publicController.downloadOfflineBundle(req, res, next));
router.get('/w3c/:id', (req, res, next) => publicController.exportW3c(req, res, next));
router.get('/qr/:id', (req, res, next) => publicController.getQrCode(req, res, next));
router.get('/revocations', (req, res, next) => publicController.listPublicRevocations(req, res, next));

module.exports = router;

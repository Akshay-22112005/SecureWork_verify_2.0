const { getDatabaseStatus } = require('../config/db');
const { successResponse } = require('../utils/response');
const env = require('../config/env');
const AuditLog = require('../models/auditLog.model');
const auditService = require('../services/audit.service');

/**
 * Health check controller.
 * Returns service status, uptime, system metrics, db status, storage driver, ocr on/off, and audit-chain head hash.
 */
async function getHealth(req, res, next) {
  try {
    const dbStatus = getDatabaseStatus();
    const uptimeSeconds = process.uptime();

    let chainHeadHash = null;
    try {
      const lastAuditRecord = await AuditLog.findOne().sort({ sequenceNumber: -1 });
      chainHeadHash = lastAuditRecord ? lastAuditRecord.currentHash : auditService.getGenesisHash();
    } catch {
      chainHeadHash = auditService.getGenesisHash();
    }

    const healthData = {
      service: 'SecureWork Verify Backend',
      status: 'healthy',
      version: '0.1.0',
      phase: 'Phase 1 - Production Ready Foundation',
      environment: env.NODE_ENV,
      timestamp: new Date().toISOString(),
      uptime: Math.floor(uptimeSeconds),
      uptimeSeconds: Math.floor(uptimeSeconds),
      database: {
        status: dbStatus.status,
        isConnected: dbStatus.isConnected,
        host: dbStatus.host || 'none',
        name: dbStatus.name || 'none',
        isMemoryServer: Boolean(dbStatus.isMemoryServer)
      },
      storageDriver: env.STORAGE_DRIVER || 'local',
      storage: {
        driver: env.STORAGE_DRIVER || 'local',
        provider: env.STORAGE_DRIVER === 'cloudinary' ? 'Cloudinary (Authenticated Private)' : 'Local SHA-256 Storage'
      },
      ocr: {
        enabled: Boolean(env.OCR_ENABLED),
        status: env.OCR_ENABLED ? 'on' : 'off',
        engine: env.OCR_ENGINE || 'local'
      },
      ai: {
        enabled: Boolean(env.AI_ENABLED),
        status: env.AI_ENABLED ? 'on' : 'off',
        engine: env.AI_ENGINE || 'local'
      },
      auditChain: {
        headHash: chainHeadHash,
        genesisHash: auditService.getGenesisHash(),
        status: 'TAMPER_EVIDENT_ACTIVE'
      },
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        memoryUsageMB: Math.round(process.memoryUsage().rss / 1024 / 1024)
      }
    };

    return successResponse(res, healthData);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getHealth
};

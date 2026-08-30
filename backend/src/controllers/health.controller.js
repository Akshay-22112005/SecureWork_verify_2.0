const { getDatabaseStatus } = require('../config/db');
const { successResponse } = require('../utils/response');
const env = require('../config/env');

/**
 * Health check controller.
 * Returns service status, uptime, system metrics, and database connection status.
 */
function getHealth(req, res) {
  const dbStatus = getDatabaseStatus();
  const uptimeSeconds = process.uptime();

  const healthData = {
    service: 'SecureWork Verify Backend',
    status: 'healthy',
    version: '0.1.0',
    phase: 'Phase 1 - Backend Foundation & Database',
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
    uptime: Math.floor(uptimeSeconds),
    database: {
      status: dbStatus.status,
      isConnected: dbStatus.isConnected,
      host: dbStatus.host || 'none',
      name: dbStatus.name || 'none'
    },
    system: {
      nodeVersion: process.version,
      platform: process.platform,
      memoryUsageMB: Math.round(process.memoryUsage().rss / 1024 / 1024)
    }
  };

  return successResponse(res, healthData);
}

module.exports = {
  getHealth
};

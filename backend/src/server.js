const fs = require('fs');
const app = require('./app');
const env = require('./config/env');
const { connectDB, disconnectDB } = require('./config/db');
const logger = require('./utils/logger');
// Server entrypoint

/**
 * Ensures required storage and keys directories exist.
 */
function ensureDirectories() {
  const dirs = [env.KEY_STORAGE_PATH, env.STORAGE_PATH, env.TEMP_STORAGE_PATH];
  for (const dir of dirs) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      logger.info(`Created required directory: ${dir}`);
    }
  }
}

/**
 * Start the HTTP server and initialize database connection.
 */
async function startServer() {
  // Ensure required filesystem directories
  ensureDirectories();

  // Connect to database
  await connectDB();

  const server = app.listen(env.PORT, () => {
    logger.info(`SecureWork Verify Backend Service listening on port ${env.PORT}`, {
      environment: env.NODE_ENV,
      port: env.PORT,
      healthEndpoint: `http://localhost:${env.PORT}/api/health`
    });

    console.log(`==================================================`);
    console.log(`  SecureWork Verify Backend Service Started`);
    console.log(`  Environment: ${env.NODE_ENV}`);
    console.log(`  Port:        ${env.PORT}`);
    console.log(`  Health:      http://localhost:${env.PORT}/api/health`);
    console.log(`==================================================`);
  });

  // Security timeouts: mitigate Slowloris and connection starvation attacks
  server.requestTimeout = 30000;   // 30 seconds
  server.headersTimeout = 35000;   // 35 seconds (must exceed requestTimeout)
  server.keepAliveTimeout = 30000; // 30 seconds

  let isShuttingDown = false;

  // Graceful shutdown handler
  async function gracefulShutdown(signal) {
    if (isShuttingDown) return;
    isShuttingDown = true;

    logger.info(`Received ${signal}. Starting graceful shutdown...`);
    console.log(`\nReceived ${signal}. Shutting down gracefully...`);

    // Force exit timeout if cleanup takes too long
    const forceExitTimer = setTimeout(() => {
      logger.error('Graceful shutdown timed out. Forcing process exit.');
      process.exit(1);
    }, 5000);
    forceExitTimer.unref();

    // 1. Close HTTP server
    server.close(async () => {
      logger.info('HTTP server closed.');

      // 2. Disconnect from database
      await disconnectDB();

      clearTimeout(forceExitTimer);
      logger.info('Graceful shutdown completed successfully.');
      process.exit(0);
    });
  }

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  return server;
}

if (require.main === module) {
  startServer().catch((err) => {
    logger.error(`Fatal startup failure: ${err.message}`, { stack: err.stack });
    process.exit(1);
  });
}

module.exports = { startServer, ensureDirectories };

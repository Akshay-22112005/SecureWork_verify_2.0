const mongoose = require('mongoose');
const env = require('./env');
const logger = require('../utils/logger');

let memoryServerInstance = null;
let activeUri = null;

let dbState = {
  isConnected: false,
  status: 'disconnected',
  host: null,
  name: null,
  error: null,
  isMemoryServer: false
};

// Track connection lifecycle events
mongoose.connection.on('connected', () => {
  dbState.isConnected = true;
  dbState.status = 'connected';
  dbState.host = mongoose.connection.host;
  dbState.name = mongoose.connection.name;
  dbState.error = null;
  logger.info(`MongoDB connection established: ${dbState.host}/${dbState.name}${dbState.isMemoryServer ? ' (In-Memory Fallback)' : ''}`);
});

mongoose.connection.on('error', (err) => {
  dbState.isConnected = false;
  dbState.status = 'error';
  dbState.error = err.message;
  logger.error(`MongoDB connection error: ${err.message}`);
});

mongoose.connection.on('disconnected', () => {
  dbState.isConnected = false;
  dbState.status = 'disconnected';
  logger.warn('MongoDB connection lost/disconnected');
});

mongoose.connection.on('reconnected', () => {
  dbState.isConnected = true;
  dbState.status = 'connected';
  dbState.error = null;
  logger.info('MongoDB connection restored');
});

let retryTimer = null;

/**
 * Checks if a MongoDB URI contains placeholder tokens.
 */
function isPlaceholderUri(uri) {
  if (!uri || typeof uri !== 'string') return true;
  return /<[^>]+>|CHANGE_ME|<user>|<password>|<cluster>|your_user|your_password/i.test(uri);
}

/**
 * Helper to start MongoMemoryServer fallback.
 */
async function startMemoryServer() {
  if (!memoryServerInstance) {
    try {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      memoryServerInstance = await MongoMemoryServer.create();
      const memUri = memoryServerInstance.getUri('securework_verify');
      logger.info(`Started in-memory MongoDB fallback server: ${memUri}`);
      return memUri;
    } catch (err) {
      logger.warn(`Could not start mongodb-memory-server: ${err.message}`);
      return null;
    }
  }
  return memoryServerInstance.getUri('securework_verify');
}

/**
 * Connect to MongoDB instance with timeout, placeholder check, and zero-setup fallback.
 * @param {string} [uri] - Optional URI override
 * @returns {Promise<typeof mongoose | null>}
 */
async function connectDB(uri = env.MONGODB_URI) {
  if (mongoose.connection.readyState === 1) {
    return mongoose;
  }

  dbState.status = 'connecting';
  let targetUri = uri;

  // 1. If configured URI has un-substituted placeholders, skip directly to fallback
  if (isPlaceholderUri(targetUri)) {
    logger.info('MONGODB_URI contains placeholder credentials. Attempting local daemon or memory-server fallback...');
    // Try local MongoDB first, otherwise memory server
    try {
      const localUri = 'mongodb://127.0.0.1:27017/securework_verify';
      const conn = await mongoose.connect(localUri, {
        serverSelectionTimeoutMS: 2000,
        connectTimeoutMS: 3000
      });
      activeUri = localUri;
      dbState.isConnected = true;
      dbState.status = 'connected';
      dbState.host = conn.connection.host;
      dbState.name = conn.connection.name;
      dbState.isMemoryServer = false;
      dbState.error = null;
      logger.info(`Connected to local MongoDB daemon: ${dbState.host}/${dbState.name}`);
      return conn;
    } catch (localErr) {
      logger.info('Local MongoDB daemon not running. Spinning up mongodb-memory-server fallback...');
      const memUri = await startMemoryServer();
      if (memUri) {
        const conn = await mongoose.connect(memUri);
        activeUri = memUri;
        dbState.isConnected = true;
        dbState.status = 'connected';
        dbState.host = conn.connection.host;
        dbState.name = conn.connection.name;
        dbState.isMemoryServer = true;
        dbState.error = null;
        logger.info(`Zero-setup database ready (In-Memory MongoDB): ${dbState.host}/${dbState.name}`);
        return conn;
      }
    }
  }

  // 2. Try the primary URI (e.g. Atlas or configured URI)
  try {
    const conn = await mongoose.connect(targetUri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000
    });

    activeUri = targetUri;
    dbState.isConnected = true;
    dbState.status = 'connected';
    dbState.host = conn.connection.host;
    dbState.name = conn.connection.name;
    dbState.isMemoryServer = false;
    dbState.error = null;

    if (retryTimer) {
      clearInterval(retryTimer);
      retryTimer = null;
    }

    logger.info(`MongoDB connected successfully to ${dbState.host}/${dbState.name}`);
    return conn;
  } catch (err) {
    logger.warn(`Primary MongoDB connection failed (${err.message}). Attempting fallback...`);

    // Fallback: Try local or in-memory
    try {
      const localUri = 'mongodb://127.0.0.1:27017/securework_verify';
      const conn = await mongoose.connect(localUri, { serverSelectionTimeoutMS: 2000 });
      activeUri = localUri;
      dbState.isConnected = true;
      dbState.status = 'connected';
      dbState.host = conn.connection.host;
      dbState.name = conn.connection.name;
      dbState.isMemoryServer = false;
      dbState.error = null;
      logger.info(`Connected to local MongoDB daemon: ${dbState.host}/${dbState.name}`);
      return conn;
    } catch (localErr) {
      const memUri = await startMemoryServer();
      if (memUri) {
        const conn = await mongoose.connect(memUri);
        activeUri = memUri;
        dbState.isConnected = true;
        dbState.status = 'connected';
        dbState.host = conn.connection.host;
        dbState.name = conn.connection.name;
        dbState.isMemoryServer = true;
        dbState.error = null;
        logger.info(`Zero-setup database ready (In-Memory MongoDB): ${dbState.host}/${dbState.name}`);
        return conn;
      }
    }

    dbState.isConnected = false;
    dbState.status = 'disconnected';
    dbState.host = null;
    dbState.name = null;
    dbState.error = err.message;

    logger.error(`MongoDB all connection attempts failed: ${err.message}`);
    return null;
  }
}

/**
 * Gracefully disconnect from MongoDB and clean up memory server if running.
 */
async function disconnectDB() {
  if (mongoose.connection.readyState !== 0) {
    try {
      await mongoose.disconnect();
      dbState.isConnected = false;
      dbState.status = 'disconnected';
      logger.info('MongoDB disconnected gracefully');
    } catch (err) {
      logger.error(`Error during MongoDB disconnection: ${err.message}`);
    }
  }
  if (memoryServerInstance) {
    try {
      await memoryServerInstance.stop();
      memoryServerInstance = null;
      logger.info('In-memory MongoDB stopped');
    } catch (err) {
      logger.warn(`Error stopping memory server: ${err.message}`);
    }
  }
}

/**
 * Mask URI for safe logging and status reporting.
 */
function maskUri(rawUri) {
  if (!rawUri) return 'unknown';
  return rawUri.replace(/\/\/[^@]+@/, '//***:***@');
}

/**
 * Get current database connection telemetry for health checks.
 */
function getDatabaseStatus() {
  const readyStates = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };

  const currentReadyState = mongoose.connection.readyState;
  const status = readyStates[currentReadyState] || 'disconnected';

  return {
    status,
    isConnected: currentReadyState === 1,
    host: mongoose.connection.host || dbState.host || (dbState.isMemoryServer ? '127.0.0.1 (Memory)' : null),
    name: mongoose.connection.name || dbState.name || 'securework_verify',
    uri: maskUri(activeUri || env.MONGODB_URI),
    isMemoryServer: dbState.isMemoryServer,
    error: dbState.error
  };
}

module.exports = {
  connectDB,
  disconnectDB,
  getDatabaseStatus
};

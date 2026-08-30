const mongoose = require('mongoose');
const env = require('./env');
const logger = require('../utils/logger');

let dbState = {
  isConnected: false,
  status: 'disconnected',
  host: null,
  name: null,
  error: null
};

// Track connection lifecycle events
mongoose.connection.on('connected', () => {
  dbState.isConnected = true;
  dbState.status = 'connected';
  dbState.host = mongoose.connection.host;
  dbState.name = mongoose.connection.name;
  dbState.error = null;
  logger.info(`MongoDB connection established: ${dbState.host}/${dbState.name}`);
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

/**
 * Connect to MongoDB instance with timeout and retry configuration.
 * @param {string} [uri] - Optional URI override (useful for testing)
 * @returns {Promise<typeof mongoose | null>}
 */
async function connectDB(uri = env.MONGODB_URI) {
  try {
    dbState.status = 'connecting';
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 10000
    });

    dbState.isConnected = true;
    dbState.status = 'connected';
    dbState.host = conn.connection.host;
    dbState.name = conn.connection.name;
    dbState.error = null;

    logger.info(`MongoDB connected successfully to ${dbState.host}/${dbState.name}`);
    return conn;
  } catch (err) {
    dbState.isConnected = false;
    dbState.status = 'disconnected';
    dbState.host = null;
    dbState.name = null;
    dbState.error = err.message;

    logger.error(`MongoDB initial connection failed: ${err.message}`);
    return null;
  }
}

/**
 * Gracefully disconnect from MongoDB.
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
    host: mongoose.connection.host || dbState.host || null,
    name: mongoose.connection.name || dbState.name || null,
    uri: maskUri(env.MONGODB_URI),
    error: dbState.error
  };
}

module.exports = {
  connectDB,
  disconnectDB,
  getDatabaseStatus
};

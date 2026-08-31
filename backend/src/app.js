const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const env = require('./config/env');
const requestIdMiddleware = require('./middleware/requestId');
const requestLogger = require('./middleware/logger');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const routes = require('./routes');

const app = express();

// Security HTTP Headers
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// Assign unique Request ID to each request
app.use(requestIdMiddleware);

// CORS Configuration
const allowedOrigins = [env.FRONTEND_URL, 'http://localhost:5173', 'http://127.0.0.1:5173'];
app.use(cors({
  origin: (origin, callback) => {
    // Allow non-browser requests (curl, server-to-server) or matched origins
    if (!origin || allowedOrigins.includes(origin) || env.NODE_ENV === 'development' || env.NODE_ENV === 'test') {
      callback(null, true);
    } else {
      callback(new Error('Blocked by CORS policy'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Request-Id']
}));

// Structured Request Logging
app.use(requestLogger);

// Rate Limiting on sensitive routes (auth brute-force and computationally heavy verification)
const { createRateLimiter } = require('./middleware/rateLimiter');
const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per 15 min per IP
  message: 'Too many authentication attempts. Please try again later.'
});
const evalLimiter = createRateLimiter({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 verification evaluations per minute
  message: 'Verification evaluation rate limit exceeded. Please wait a moment.'
});
app.use('/api/auth', authLimiter);
app.use('/api/verifications/evaluate', evalLimiter);

// Body Parsers with dynamic size limits from configuration
const bodyLimit = `${env.MAX_FILE_SIZE_MB}mb`;
app.use(express.json({ limit: bodyLimit }));
app.use(express.urlencoded({ extended: true, limit: bodyLimit }));

// Mount API Routes
app.use('/api', routes);

// Base service info
app.get('/', (req, res) => {
  res.json({
    service: 'SecureWork Verify API',
    status: 'online',
    version: '0.1.0',
    phase: 'Phase 1 - Backend Foundation & Database',
    endpoints: {
      health: '/api/health'
    }
  });
});

// 404 Handler for undefined routes
app.use(notFoundHandler);

// Centralized Error Handler (Never leaks stack traces)
app.use(errorHandler);

module.exports = app;

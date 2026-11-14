// src/app.js
// Configured Express app. Does NOT listen and does NOT connect to the database.

require('express-async-errors');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const { parseOrigins } = require('./config/env');
const requestId = require('./middleware/requestId');
const requestLogger = require('./middleware/requestLogger');
const { createGlobalApiLimiter } = require('./middleware/rateLimit');
const errorHandler = require('./middleware/errorHandler');
const database = require('./config/database');

const authRoutes = require('./routes/auth');
const complaintRoutes = require('./routes/complaints');
const officerRoutes = require('./routes/officers');
const wardRoutes = require('./routes/wards');
const assignmentRoutes = require('./routes/assignments');
const adminRoutes = require('./routes/admin');

const createApp = () => {
  const app = express();
  const allowedOrigins = parseOrigins(process.env.FRONTEND_URL);

  if (process.env.TRUST_PROXY) {
    const v = process.env.TRUST_PROXY;
    app.set('trust proxy', /^\d+$/.test(v) ? Number(v) : v === 'true' ? true : v);
  }
  app.disable('x-powered-by');

  app.use(requestId);
  app.use(requestLogger);
  // Security headers (images in /uploads are used by the frontend on another origin)
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(cors({
    // Allowlist only; requests without an Origin header (curl, same-origin, server-to-server) pass through
    origin: (origin, cb) => cb(null, !origin || allowedOrigins.includes(origin.replace(/\/+$/, ''))),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    exposedHeaders: ['X-Request-Id'],
    maxAge: 600,
  }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ limit: '1mb', extended: true }));
  app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));

  // Liveness
  app.get('/health', (req, res) => {
    res.json({
      success: true,
      message: 'Smart Garbage Reporting API is running',
      timestamp: new Date().toISOString(),
    });
  });

  // Readiness (checks the database)
  app.get('/health/ready', async (req, res) => {
    try {
      await database.checkConnection();
      res.json({ success: true, status: 'ready', timestamp: new Date().toISOString() });
    } catch (err) {
      res.status(503).json({ success: false, status: 'unavailable', error: 'Database unavailable' });
    }
  });

  // API Routes
  app.use('/api', createGlobalApiLimiter());
  app.use('/api/auth', authRoutes);
  app.use('/api/complaints', complaintRoutes);
  app.use('/api/officers', officerRoutes);
  app.use('/api/wards', wardRoutes);
  app.use('/api/assignments', assignmentRoutes);
  app.use('/api/admin', adminRoutes);

  // 404 Handler
  app.use((req, res) => {
    res.status(404).json({ success: false, error: 'Route not found' });
  });

  // Global Error Handler
  app.use(errorHandler);

  return app;
};

const app = createApp();
app.createApp = createApp;

module.exports = app;

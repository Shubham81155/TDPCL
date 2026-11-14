// src/index.js
// Server entry point: validate env, connect DB, listen, shut down gracefully.

require('dotenv').config();

const logger = require('./utils/logger');
const { loadConfig } = require('./config/env');

let config;
try {
  config = loadConfig();
} catch (err) {
  console.error(`FATAL: ${err.message}`);
  process.exit(1);
}

const app = require('./app');
const { pgp, checkConnection } = require('./config/database');
const { initializeEmailService } = require('./services/notificationService');

const SHUTDOWN_TIMEOUT_MS = 10000;

const start = async () => {
  try {
    await checkConnection();
    logger.info('Database connection established');
  } catch (err) {
    logger.error('Database connection error', { err });
    process.exit(1);
  }

  const server = app.listen(config.port, () => {
    logger.info('Server listening', { url: `http://${config.host}:${config.port}`, env: config.env });
    try {
      if (initializeEmailService()) {
        logger.info('Email service initialized');
      }
      // when disabled, initializeEmailService already logged why ("email disabled: ...")
    } catch (error) {
      logger.warn('Email service initialization failed', { err: error });
    }
  });

  server.on('error', (err) => {
    logger.error('Server error', { err });
    process.exit(1);
  });

  let shuttingDown = false;
  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info('Shutting down gracefully', { signal });

    const force = setTimeout(() => {
      logger.error('Forced shutdown after timeout');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);
    force.unref();

    server.close(async () => {
      try {
        await pgp.end();
      } catch (err) {
        logger.warn('Error closing database pool', { err });
      }
      process.exit(0);
    });
    if (typeof server.closeIdleConnections === 'function') server.closeIdleConnections();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

start();

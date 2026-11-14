// src/middleware/requestLogger.js
// Structured JSON access log, emitted when the response finishes.
const logger = require('../utils/logger');

const requestLogger = (req, res, next) => {
  const start = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    const path = (req.originalUrl || req.url || '').split('?')[0];
    let level = 'info';
    if (res.statusCode >= 500) level = 'error';
    else if (res.statusCode >= 400) level = 'warn';
    else if (path.startsWith('/health')) level = 'debug';
    logger[level]('request', {
      method: req.method,
      path,
      status: res.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
      requestId: req.id,
      ...(req.user && req.user.user_id != null && { userId: req.user.user_id }),
    });
  });
  next();
};

module.exports = requestLogger;

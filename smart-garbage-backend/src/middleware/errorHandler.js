// src/middleware/errorHandler.js
// Global Error Handling Middleware

const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  err = err || {};
  const requestId = req && req.id;
  const rawStatus = err.status || err.statusCode;
  const status = Number.isInteger(rawStatus) && rawStatus >= 400 && rawStatus < 600 ? rawStatus : 500;
  const isDev = process.env.NODE_ENV === 'development';
  // Message is safe to show for client errors, operational errors, or in development
  const expose = isDev || status < 500 || err.isOperational === true || err.expose === true;
  const message = expose ? (err.message || 'Internal Server Error') : 'Internal Server Error';

  logger[status >= 500 ? 'error' : 'warn']('request error', {
    requestId,
    method: req && req.method,
    path: req && (req.originalUrl || req.url),
    status,
    err,
  });

  if (res.headersSent) return next && next(err);

  // Validation error
  if (err.isJoi || err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      error: 'Validation Error',
      details: err.details || err.message,
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ success: false, error: 'Invalid token' });
  }

  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ success: false, error: 'Token expired' });
  }

  // Database errors
  if (typeof err.code === 'string' && err.code.startsWith('23')) {
    return res.status(400).json({
      success: false,
      error: 'Database constraint violation',
      details: err.message,
    });
  }

  res.status(status).json({
    success: false,
    error: message,
    ...(expose && status < 500 && err.details !== undefined && { details: err.details }),
    ...(isDev && { stack: err.stack }),
    ...(requestId && { requestId }),
  });
};

module.exports = errorHandler;

// src/middleware/errorHandler.js
// Global Error Handling Middleware

const logger = require('../utils/logger');

// Turns a Postgres integrity error (SQLSTATE 23xxx) into a message a user can act on.
// Never echoes the driver message, constraint name or offending value (they expose schema/data).
const describeConstraintError = (err) => {
  // pg's `detail` looks like: Key (employee_id)=(E2E-0001) already exists.  Only the column is used.
  const match = /Key \((.+?)\)=\(/.exec(err.detail || '');
  const field = match
    ? match[1].split(',')[0].trim().replace(/^lower\((.*)\)$/i, '$1').replace(/::\w+/g, '')
    : null;
  const label = field ? field.replace(/_/g, ' ') : null;
  switch (err.code) {
    case '23505':
      return {
        status: 409,
        field,
        message: label ? `A record with this ${label} already exists` : 'This record already exists',
      };
    case '23503':
      return { status: 409, field, message: 'This record refers to, or is still used by, other data' };
    case '23502':
      return { status: 400, field, message: label ? `${label} is required` : 'A required value is missing' };
    case '23514':
      return { status: 400, field, message: 'A value is outside the allowed range' };
    default:
      return { status: 400, field, message: 'The data could not be saved' };
  }
};

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
    const { status: dbStatus, message: dbMessage, field } = describeConstraintError(err);
    return res.status(dbStatus).json({
      success: false,
      error: dbMessage,
      ...(field && { field }),
      ...(requestId && { requestId }),
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

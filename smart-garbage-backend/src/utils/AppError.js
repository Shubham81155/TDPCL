// src/utils/AppError.js
// Operational error carrying an HTTP status. The central error handler reads
// err.status, err.isOperational and err.details.

class AppError extends Error {
  constructor(message, status = 500, details) {
    super(message);
    this.name = this.constructor.name;
    this.status = status;
    this.isOperational = true;
    if (details !== undefined) this.details = details;
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message = 'Bad request', details) {
    return new AppError(message, 400, details);
  }

  static forbidden(message = 'Forbidden', details) {
    return new AppError(message, 403, details);
  }

  static notFound(message = 'Not found', details) {
    return new AppError(message, 404, details);
  }

  static conflict(message = 'Conflict', details) {
    return new AppError(message, 409, details);
  }

  // Normalise an arbitrary caught error for service-layer rethrow.
  // - AppError (and subclasses) pass through untouched, keeping their status.
  // - Database constraint errors (SQLSTATE 23xxx) pass through so the central
  //   handler can map them to 400.
  // - Anything else becomes a non-operational 500 with a safe public message;
  //   the original error is kept on .cause for logging.
  static wrap(error, publicMessage) {
    if (error instanceof AppError) return error;
    if (error && typeof error.code === 'string' && error.code.startsWith('23')) return error;
    const wrapped = new AppError(publicMessage || 'Internal Server Error', 500);
    wrapped.isOperational = false;
    wrapped.cause = error;
    if (error && error.stack) wrapped.stack = `${wrapped.stack}\nCaused by: ${error.stack}`;
    return wrapped;
  }
}

module.exports = AppError;
module.exports.AppError = AppError;

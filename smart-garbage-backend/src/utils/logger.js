// src/utils/logger.js
// Tiny structured JSON logger (one JSON object per line). Honors LOG_LEVEL at call time.

const LEVELS = { error: 0, warn: 1, info: 2, debug: 3 };

const currentLevel = () => {
  const name = String(process.env.LOG_LEVEL || 'info').toLowerCase();
  return name in LEVELS ? LEVELS[name] : LEVELS.info;
};

const serializeError = (err) => {
  if (!err || typeof err !== 'object') return err;
  return {
    name: err.name,
    message: err.message,
    code: err.code,
    ...(err.stack && { stack: err.stack }),
  };
};

const write = (level, message, meta) => {
  if (LEVELS[level] > currentLevel()) return;
  const fields = { ...(meta || {}) };
  if (fields.err) fields.err = serializeError(fields.err);
  const base = { time: new Date().toISOString(), level, msg: message };
  let line;
  try {
    line = JSON.stringify({ ...base, ...fields });
  } catch (e) {
    line = JSON.stringify({ ...base, logError: 'unserializable meta' });
  }
  (level === 'error' || level === 'warn' ? console.error : console.log)(line);
};

const logger = {
  error: (msg, meta) => write('error', msg, meta),
  warn: (msg, meta) => write('warn', msg, meta),
  info: (msg, meta) => write('info', msg, meta),
  debug: (msg, meta) => write('debug', msg, meta),
  LEVELS,
};

module.exports = logger;

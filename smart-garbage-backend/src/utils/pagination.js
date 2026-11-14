// src/utils/pagination.js
// Query-string helpers: pagination, ids and optional dates.

const AppError = require('./AppError');

const toInt = (value) => {
  if (value === undefined || value === null || value === '') return NaN;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) ? n : NaN;
};

// parsePagination(req.query, { defaultLimit, maxLimit }) -> { limit, offset }
// limit is clamped to 1..maxLimit, offset to >= 0; NaN falls back to defaults.
const parsePagination = (query = {}, { defaultLimit = 20, maxLimit = 100 } = {}) => {
  const q = query || {};
  let limit = toInt(q.limit);
  if (Number.isNaN(limit)) limit = defaultLimit;
  limit = Math.min(Math.max(limit, 1), maxLimit);

  let offset = toInt(q.offset);
  if (Number.isNaN(offset) || offset < 0) offset = 0;
  offset = Math.min(offset, Number.MAX_SAFE_INTEGER);

  return { limit, offset };
};

// Positive integer path/body id or throws 400.
const parseId = (value, label = 'id') => {
  const n = Number(value);
  if (!Number.isInteger(n) || n <= 0) throw new AppError(`Invalid ${label}`, 400);
  return n;
};

// Optional integer filter (e.g. ward_id); invalid/empty -> null.
const parseOptionalInt = (value) => {
  const n = toInt(value);
  return Number.isNaN(n) ? null : n;
};

// Optional date filter; empty -> null; unparsable -> 400.
const parseOptionalDate = (value, label = 'date') => {
  if (value === undefined || value === null || value === '') return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) throw new AppError(`Invalid ${label}`, 400);
  return d;
};

module.exports = { parsePagination, parseId, parseOptionalInt, parseOptionalDate };

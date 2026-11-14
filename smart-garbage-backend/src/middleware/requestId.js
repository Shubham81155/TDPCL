// src/middleware/requestId.js
const crypto = require('crypto');

const SANE = /^[A-Za-z0-9._-]{8,128}$/;

const requestId = (req, res, next) => {
  const incoming = req.headers && req.headers['x-request-id'];
  const id = typeof incoming === 'string' && SANE.test(incoming) ? incoming : crypto.randomUUID();
  req.id = id;
  res.setHeader('X-Request-Id', id);
  next();
};

module.exports = requestId;

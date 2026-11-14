// Shared helpers for route-layer tests (not a test file itself).
process.env.JWT_SECRET = process.env.JWT_SECRET || 'route-test-secret';
require('express-async-errors');
const express = require('express');
const { generateToken } = require('../../../src/middleware/auth');
const errorHandler = require('../../../src/middleware/errorHandler');

const buildApp = (mount, router, { json = true } = {}) => {
  const app = express();
  if (json) app.use(express.json());
  app.use(mount, router);
  app.use(errorHandler);
  return app;
};

const tokenFor = (role, user_id = 7) =>
  `Bearer ${generateToken({ user_id, email: `${role}@x.test`, role })}`;

module.exports = { buildApp, tokenFor };

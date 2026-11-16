// src/config/env.js
// Environment validation (Joi). Call loadConfig() at boot; it throws one error listing every problem.

const Joi = require('joi');

const isProd = (env) => env.NODE_ENV === 'production';

const buildSchema = (env) => {
  const prodRequired = (schema) => (isProd(env) ? schema.required() : schema);
  return Joi.object({
    NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
    PORT: Joi.number().port().default(5000),
    HOST: Joi.string().default('localhost'),

    DB_HOST: prodRequired(Joi.string().default('localhost')),
    DB_PORT: Joi.number().port().default(5432),
    DB_NAME: prodRequired(Joi.string().default('smart_garbage_db')),
    DB_USER: prodRequired(Joi.string().default('postgres')),
    DB_PASSWORD: Joi.string().allow('').default('postgres'),
    DB_SSL: Joi.string().valid('true', 'false').default('false'),

    JWT_SECRET: Joi.string()
      .min(16)
      .required()
      .custom((value, helpers) => {
        if (isProd(env) && value.startsWith('your_')) return helpers.error('any.invalid');
        return value;
      })
      .messages({
        'any.invalid': '"JWT_SECRET" must not be a placeholder (starts with "your_") in production',
      }),
    JWT_EXPIRY: Joi.string().default('24h'),
    JWT_REFRESH_EXPIRY: Joi.string().default('7d'),

    FRONTEND_URL: Joi.string().default('http://localhost:3000'),
    STORAGE_PROVIDER: Joi.string().valid('local', 's3').default('local'),
    // Email: gmail | sendgrid | smtp | none. Placeholder values count as "not configured" (see mailTransport).
    EMAIL_SERVICE: Joi.string().valid('gmail', 'sendgrid', 'smtp', 'none').insensitive().empty('').default('gmail'),
    EMAIL_FROM: Joi.string().allow(''),
    SMTP_HOST: Joi.string()
      .allow('')
      .when('EMAIL_SERVICE', {
        is: Joi.string().valid('smtp').insensitive(),
        then: isProd(env) ? Joi.string().required() : Joi.string().allow(''),
      }),
    SMTP_PORT: Joi.number().integer().min(1).max(65535).empty('').default(587),
    SMTP_SECURE: Joi.boolean().empty(''),
    SMTP_USER: Joi.string().allow(''),
    SMTP_PASSWORD: Joi.string().allow(''),
    LOG_LEVEL: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
    // Auto-assignment: nearest-officer fallback radius, per-officer open-complaint cap, backlog retry period (0 = off)
    ASSIGN_MAX_RADIUS_KM: Joi.number().positive().empty('').default(10),
    ASSIGN_MAX_OPEN_PER_OFFICER: Joi.number().integer().min(1).empty('').default(20),
    ASSIGN_RETRY_INTERVAL_MIN: Joi.number().min(0).empty('').default(10),
  }).unknown(true);
};

const parseOrigins = (value) =>
  String(value || 'http://localhost:3000')
    .split(',')
    .map((s) => s.trim().replace(/\/+$/, ''))
    .filter(Boolean);

const validateEnv = (env = process.env) => {
  const { error, value } = buildSchema(env).validate(env, { abortEarly: false });
  if (error) {
    const problems = error.details.map((d) => d.message);
    const err = new Error(`Invalid environment configuration:\n - ${problems.join('\n - ')}`);
    err.problems = problems;
    throw err;
  }
  return value;
};

const loadConfig = (env = process.env) => {
  const v = validateEnv(env);
  return Object.freeze({
    env: v.NODE_ENV,
    isProduction: v.NODE_ENV === 'production',
    port: v.PORT,
    host: v.HOST,
    db: Object.freeze({
      host: v.DB_HOST, port: v.DB_PORT, name: v.DB_NAME, user: v.DB_USER, ssl: v.DB_SSL === 'true',
    }),
    jwt: Object.freeze({ expiry: v.JWT_EXPIRY, refreshExpiry: v.JWT_REFRESH_EXPIRY }),
    frontendOrigins: Object.freeze(parseOrigins(v.FRONTEND_URL)),
    storageProvider: v.STORAGE_PROVIDER,
    logLevel: v.LOG_LEVEL,
    assignment: Object.freeze({
      maxRadiusKm: v.ASSIGN_MAX_RADIUS_KM,
      maxOpenPerOfficer: v.ASSIGN_MAX_OPEN_PER_OFFICER,
      retryIntervalMin: v.ASSIGN_RETRY_INTERVAL_MIN,
    }),
  });
};

module.exports = { loadConfig, validateEnv, parseOrigins };

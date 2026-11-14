// src/services/mailTransport.js
// Resolves email configuration from the environment and builds a nodemailer transport.
// Pure resolution (resolveEmailConfig) is separated from side effects (createMailTransport).

const nodemailer = require('nodemailer');

const DEFAULT_FROM = 'no-reply@localhost';

// Values copied from .env.example are treated as "not configured".
const isPlaceholder = (value) => {
  if (value === undefined || value === null) return true;
  const v = String(value).trim();
  if (!v) return true;
  return /^your[_-]/i.test(v) || /_here$/i.test(v) || /^change[_-]?me$/i.test(v);
};

const real = (value) => (isPlaceholder(value) ? undefined : String(value).trim());

const toBool = (value) => {
  if (value === undefined || value === null || String(value).trim() === '') return undefined;
  return ['true', '1', 'yes'].includes(String(value).trim().toLowerCase());
};

// Returns { enabled, kind, from, options, reason }
const resolveEmailConfig = (env = process.env) => {
  const kind = String(env.EMAIL_SERVICE || 'gmail').trim().toLowerCase();
  const user = real(env.EMAIL_USER);
  const from = real(env.EMAIL_FROM) || user || DEFAULT_FROM;
  const disabled = (reason) => ({ enabled: false, kind, from, options: null, reason });

  if (kind === 'none') return disabled('EMAIL_SERVICE=none');

  if (kind === 'sendgrid') {
    const key = real(env.SENDGRID_API_KEY);
    if (!key) return disabled('EMAIL_SERVICE=sendgrid but SENDGRID_API_KEY is not set');
    return {
      enabled: true,
      kind,
      from,
      reason: null,
      options: { host: 'smtp.sendgrid.net', port: 587, secure: false, auth: { user: 'apikey', pass: key } },
    };
  }

  if (kind === 'smtp') {
    const host = real(env.SMTP_HOST);
    if (!host) return disabled('EMAIL_SERVICE=smtp but SMTP_HOST is not set');
    const port = parseInt(env.SMTP_PORT, 10) || 587;
    const secure = toBool(env.SMTP_SECURE);
    const options = {
      host,
      port,
      secure: secure === undefined ? port === 465 : secure,
      connectionTimeout: 5000,
      greetingTimeout: 5000,
      socketTimeout: 15000,
    };
    const smtpUser = real(env.SMTP_USER);
    if (smtpUser) options.auth = { user: smtpUser, pass: env.SMTP_PASSWORD || '' };
    return { enabled: true, kind, from, reason: null, options };
  }

  if (kind === 'gmail') {
    const pass = real(env.EMAIL_PASSWORD);
    if (!user || !pass) {
      return disabled('EMAIL_SERVICE=gmail but EMAIL_USER / EMAIL_PASSWORD are missing or placeholders');
    }
    return { enabled: true, kind, from, reason: null, options: { service: 'gmail', auth: { user, pass } } };
  }

  return disabled(`unknown EMAIL_SERVICE "${kind}"`);
};

const createMailTransport = (config) => nodemailer.createTransport(config.options);

module.exports = { resolveEmailConfig, createMailTransport, isPlaceholder, DEFAULT_FROM };

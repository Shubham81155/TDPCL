const { validateEnv } = require('../../../src/config/env');

const base = { JWT_SECRET: 'a-sufficiently-long-secret' };
const prod = { ...base, NODE_ENV: 'production', DB_HOST: 'h', DB_NAME: 'n', DB_USER: 'u' };

describe('email env validation', () => {
  it('defaults', () => {
    const v = validateEnv(base);
    expect(v.EMAIL_SERVICE).toBe('gmail');
    expect(v.SMTP_PORT).toBe(587);
  });
  it('accepts placeholder gmail values in development', () => {
    expect(() => validateEnv({ ...base, EMAIL_SERVICE: 'gmail', EMAIL_USER: 'your_email@gmail.com', EMAIL_PASSWORD: 'your_app_specific_password' })).not.toThrow();
  });
  it.each(['gmail', 'sendgrid', 'smtp', 'none'])('accepts EMAIL_SERVICE=%s', (s) => {
    expect(() => validateEnv({ ...base, EMAIL_SERVICE: s })).not.toThrow();
  });
  it('rejects unknown EMAIL_SERVICE', () => {
    expect(() => validateEnv({ ...base, EMAIL_SERVICE: 'mailgun' })).toThrow(/EMAIL_SERVICE/);
  });
  it.each(['0', '65536', 'abc', '1.5'])('rejects SMTP_PORT=%s', (p) => {
    expect(() => validateEnv({ ...base, SMTP_PORT: p })).toThrow(/SMTP_PORT/);
  });
  it('accepts SMTP_PORT 1 and 65535', () => {
    expect(validateEnv({ ...base, SMTP_PORT: '65535' }).SMTP_PORT).toBe(65535);
    expect(validateEnv({ ...base, SMTP_PORT: '1' }).SMTP_PORT).toBe(1);
  });
  it('SMTP_SECURE must be boolean', () => {
    expect(validateEnv({ ...base, SMTP_SECURE: 'true' }).SMTP_SECURE).toBe(true);
    expect(() => validateEnv({ ...base, SMTP_SECURE: 'maybe' })).toThrow(/SMTP_SECURE/);
  });
  it('production + smtp requires SMTP_HOST', () => {
    expect(() => validateEnv({ ...prod, EMAIL_SERVICE: 'smtp' })).toThrow(/SMTP_HOST/);
    expect(() => validateEnv({ ...prod, EMAIL_SERVICE: 'smtp', SMTP_HOST: 'smtp.example.org' })).not.toThrow();
    expect(() => validateEnv({ ...prod, EMAIL_SERVICE: 'gmail' })).not.toThrow();
  });
  it('development + smtp does not require SMTP_HOST', () => {
    expect(() => validateEnv({ ...base, EMAIL_SERVICE: 'smtp' })).not.toThrow();
  });
});

const mockCreateTransport = jest.fn(() => ({ sendMail: jest.fn().mockResolvedValue({}) }));
jest.mock('nodemailer', () => ({ createTransport: (...a) => mockCreateTransport(...a) }));

const { resolveEmailConfig, isPlaceholder, createMailTransport } = require('../../../src/services/mailTransport');

describe('isPlaceholder', () => {
  it.each(['your_email@gmail.com', 'your_app_specific_password', 'your_sendgrid_api_key_here', '', undefined, 'changeme'])(
    'treats %p as placeholder', (v) => expect(isPlaceholder(v)).toBe(true)
  );
  it('accepts real values', () => {
    expect(isPlaceholder('me@real.org')).toBe(false);
    expect(isPlaceholder('SG.abc')).toBe(false);
  });
});

describe('resolveEmailConfig', () => {
  it('gmail with real credentials', () => {
    const c = resolveEmailConfig({ EMAIL_USER: 'a@b.org', EMAIL_PASSWORD: 'pw' });
    expect(c).toMatchObject({ enabled: true, kind: 'gmail', from: 'a@b.org', options: { service: 'gmail', auth: { user: 'a@b.org', pass: 'pw' } } });
  });
  it('gmail with placeholders is disabled', () => {
    const c = resolveEmailConfig({ EMAIL_SERVICE: 'gmail', EMAIL_USER: 'your_email@gmail.com', EMAIL_PASSWORD: 'your_app_specific_password' });
    expect(c.enabled).toBe(false);
    expect(c.reason).toMatch(/gmail/);
    expect(c.from).toBe('no-reply@localhost');
  });
  it('nothing configured at all is disabled (default gmail)', () => {
    expect(resolveEmailConfig({}).enabled).toBe(false);
  });
  it('sendgrid uses api key and EMAIL_FROM', () => {
    const c = resolveEmailConfig({ EMAIL_SERVICE: 'sendgrid', SENDGRID_API_KEY: 'SG.k', EMAIL_FROM: 'n@x.org' });
    expect(c).toMatchObject({ enabled: true, from: 'n@x.org', options: { host: 'smtp.sendgrid.net', port: 587, auth: { user: 'apikey', pass: 'SG.k' } } });
  });
  it('sendgrid without key is disabled', () => {
    expect(resolveEmailConfig({ EMAIL_SERVICE: 'sendgrid', SENDGRID_API_KEY: 'your_sendgrid_api_key_here' }).enabled).toBe(false);
  });
  it('smtp without auth (sink / Mailpit)', () => {
    const c = resolveEmailConfig({ EMAIL_SERVICE: 'smtp', SMTP_HOST: '127.0.0.1', SMTP_PORT: '1025', SMTP_SECURE: 'false' });
    expect(c.enabled).toBe(true);
    expect(c.options).toMatchObject({ host: '127.0.0.1', port: 1025, secure: false });
    expect(c.options.auth).toBeUndefined();
  });
  it('smtp with auth, defaults port 587 and secure=false', () => {
    const c = resolveEmailConfig({ EMAIL_SERVICE: 'SMTP', SMTP_HOST: 'h', SMTP_USER: 'u', SMTP_PASSWORD: 'p' });
    expect(c.options).toMatchObject({ port: 587, secure: false, auth: { user: 'u', pass: 'p' } });
  });
  it('smtp secure defaults to true on 465 and explicit value wins', () => {
    expect(resolveEmailConfig({ EMAIL_SERVICE: 'smtp', SMTP_HOST: 'h', SMTP_PORT: '465' }).options.secure).toBe(true);
    expect(resolveEmailConfig({ EMAIL_SERVICE: 'smtp', SMTP_HOST: 'h', SMTP_PORT: '465', SMTP_SECURE: 'false' }).options.secure).toBe(false);
    expect(resolveEmailConfig({ EMAIL_SERVICE: 'smtp', SMTP_HOST: 'h', SMTP_SECURE: 'true' }).options.secure).toBe(true);
  });
  it('smtp without host is disabled', () => {
    expect(resolveEmailConfig({ EMAIL_SERVICE: 'smtp' }).enabled).toBe(false);
  });
  it('none and unknown are disabled', () => {
    expect(resolveEmailConfig({ EMAIL_SERVICE: 'none' }).enabled).toBe(false);
    expect(resolveEmailConfig({ EMAIL_SERVICE: 'bogus' }).reason).toMatch(/unknown/);
  });
  it('EMAIL_FROM fallback chain', () => {
    const base = { EMAIL_SERVICE: 'smtp', SMTP_HOST: 'h' };
    expect(resolveEmailConfig({ ...base, EMAIL_FROM: 'f@x', EMAIL_USER: 'u@x' }).from).toBe('f@x');
    expect(resolveEmailConfig({ ...base, EMAIL_USER: 'u@x' }).from).toBe('u@x');
    expect(resolveEmailConfig({ ...base, EMAIL_USER: 'your_email@gmail.com' }).from).toBe('no-reply@localhost');
    expect(resolveEmailConfig(base).from).toBe('no-reply@localhost');
  });
  it('createMailTransport passes options to nodemailer', () => {
    const c = resolveEmailConfig({ EMAIL_SERVICE: 'smtp', SMTP_HOST: 'h' });
    createMailTransport(c);
    expect(mockCreateTransport).toHaveBeenCalledWith(c.options);
  });
});

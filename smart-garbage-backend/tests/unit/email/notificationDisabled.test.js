const mockSendMail = jest.fn().mockResolvedValue({});
const mockCreateTransport = jest.fn(() => ({ sendMail: mockSendMail }));
jest.mock('nodemailer', () => ({ createTransport: (...a) => mockCreateTransport(...a) }));
jest.mock('../../../src/config/database', () => ({
  db: { none: jest.fn().mockResolvedValue(), any: jest.fn().mockResolvedValue([{ email: 'a@x', name: 'A' }]) },
}));

const KEYS = ['EMAIL_SERVICE', 'EMAIL_USER', 'EMAIL_PASSWORD', 'EMAIL_FROM', 'SENDGRID_API_KEY', 'SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASSWORD'];
let svc;
let warn;
beforeEach(() => {
  jest.resetModules();
  mockSendMail.mockClear();
  mockCreateTransport.mockClear();
  KEYS.forEach((k) => delete process.env[k]);
  warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  svc = require('../../../src/services/notificationService');
});
afterEach(() => { warn.mockRestore(); KEYS.forEach((k) => delete process.env[k]); });

describe('email disabled (no config / placeholders)', () => {
  it('warns exactly once and every send returns quietly', async () => {
    process.env.EMAIL_SERVICE = 'gmail';
    process.env.EMAIL_USER = 'your_email@gmail.com';
    process.env.EMAIL_PASSWORD = 'your_app_specific_password';
    svc.initializeEmailService();
    await svc.sendComplaintSubmittedEmail('c@x', 'C', 1);
    await svc.sendComplaintAssignedEmail('o@x', 'O', 1, 't');
    await svc.sendComplaintStatusUpdateEmail('c@x', 'C', 1, 'new');
    await svc.sendComplaintSubmittedToAdminEmail(1, 'C', 'l', 'c');
    expect(await svc.sendPasswordResetEmail('c@x', 'C', 'http://r')).toBe(false);
    expect(mockCreateTransport).not.toHaveBeenCalled();
    expect(mockSendMail).not.toHaveBeenCalled();
    const disabledWarnings = warn.mock.calls.filter((c) => String(c[0]).startsWith('email disabled:'));
    expect(disabledWarnings).toHaveLength(1);
  });
  it('EMAIL_SERVICE=none disables', async () => {
    process.env.EMAIL_SERVICE = 'none';
    expect(svc.initializeEmailService()).toBe(false);
    expect(await svc.sendPasswordResetEmail('c@x', 'C', 'u')).toBe(false);
  });
});

describe('smtp mode', () => {
  beforeEach(() => {
    process.env.EMAIL_SERVICE = 'smtp';
    process.env.SMTP_HOST = '127.0.0.1';
    process.env.SMTP_PORT = '1025';
    process.env.EMAIL_FROM = 'noreply@test.local';
    process.env.FRONTEND_URL = 'http://f.test';
  });
  it('uses EMAIL_FROM as the from address everywhere', async () => {
    await svc.sendComplaintSubmittedEmail('c@x', 'C', 1);
    await svc.sendComplaintAssignedEmail('o@x', 'O', 1, 't');
    await svc.sendComplaintStatusUpdateEmail('c@x', 'C', 1, 'new');
    await svc.sendComplaintSubmittedToAdminEmail(1, 'C', 'l', 'c');
    expect(await svc.sendPasswordResetEmail('c@x', 'C', 'http://r')).toBe(true);
    expect(mockSendMail).toHaveBeenCalledTimes(5);
    mockSendMail.mock.calls.forEach(([m]) => expect(m.from).toBe('noreply@test.local'));
    expect(mockCreateTransport).toHaveBeenCalledTimes(1);
    expect(warn).not.toHaveBeenCalled();
  });
  it('delivery failure never throws', async () => {
    mockSendMail.mockRejectedValueOnce(new Error('ECONNREFUSED'));
    expect(await svc.sendPasswordResetEmail('c@x', 'C', 'u')).toBe(false);
  });
});

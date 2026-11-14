const mockSendMail = jest.fn();
jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail: (...a) => mockSendMail(...a) })),
}));
jest.mock('../../../src/config/database', () => ({ db: { none: jest.fn(), any: jest.fn() } }));

let nodemailer;
let db;

const XSS = '<script>alert(1)</script>';
const ESC = '&lt;script&gt;alert(1)&lt;/script&gt;';

let svc;
beforeEach(() => {
  jest.resetModules();
  nodemailer = require('nodemailer');
  ({ db } = require('../../../src/config/database'));
  mockSendMail.mockReset().mockResolvedValue({});
  db.none.mockResolvedValue();
  process.env.FRONTEND_URL = 'http://front.test';
  process.env.EMAIL_USER = 'sender@real.test';
  process.env.EMAIL_PASSWORD = 'app-pass';
  process.env.SENDGRID_API_KEY = 'SG.real';
  svc = require('../../../src/services/notificationService');
});
afterEach(() => {
  ['EMAIL_SERVICE', 'EMAIL_USER', 'EMAIL_PASSWORD', 'SENDGRID_API_KEY', 'EMAIL_FROM'].forEach((k) => delete process.env[k]);
});

const html = () => mockSendMail.mock.calls[0][0].html;

describe('transport selection', () => {
  it('gmail by default, created once and reused', async () => {
    await svc.sendComplaintSubmittedEmail('a@b', 'N', 1);
    await svc.sendComplaintSubmittedEmail('a@b', 'N', 2);
    expect(nodemailer.createTransport).toHaveBeenCalledTimes(1);
    expect(nodemailer.createTransport.mock.calls[0][0]).toMatchObject({ service: 'gmail' });
  });
  it('sendgrid when configured', async () => {
    process.env.EMAIL_SERVICE = 'sendgrid';
    svc.initializeEmailService();
    expect(nodemailer.createTransport.mock.calls[0][0]).toMatchObject({ host: 'smtp.sendgrid.net', auth: { user: 'apikey' } });
  });
});

describe('sendComplaintSubmittedEmail', () => {
  it('escapes name, sends and logs success', async () => {
    await svc.sendComplaintSubmittedEmail('a@b', XSS, 5);
    expect(html()).toContain(ESC);
    expect(html()).not.toContain('<script>');
    expect(mockSendMail.mock.calls[0][0]).toMatchObject({ to: 'a@b', subject: 'Complaint #5 Submitted Successfully' });
    expect(html()).toContain('http://front.test/citizen/complaint/5');
    expect(db.none.mock.calls[0][1]).toEqual(['a@b', expect.any(String), 'sent', null]);
  });
  it('transport error is swallowed and failure is logged; log failure also swallowed', async () => {
    mockSendMail.mockRejectedValue(new Error('smtp down'));
    await expect(svc.sendComplaintSubmittedEmail('a@b', 'N', 1)).resolves.toBeUndefined();
    expect(db.none.mock.calls[0][1]).toEqual(['a@b', expect.any(String), 'failed', 'smtp down']);
    db.none.mockRejectedValue(new Error('db down'));
    await expect(svc.sendComplaintSubmittedEmail('a@b', 'N', 1)).resolves.toBeUndefined();
  });
});

describe('sendComplaintAssignedEmail', () => {
  it('escapes officer name and title', async () => {
    await svc.sendComplaintAssignedEmail('o@x', XSS, 3, XSS);
    expect(html().split(ESC)).toHaveLength(3);
    expect(html()).not.toContain('<script>');
  });
  it('swallows errors', async () => {
    mockSendMail.mockRejectedValue(new Error('x'));
    await expect(svc.sendComplaintAssignedEmail('o', 'n', 1, 't')).resolves.toBeUndefined();
  });
});

describe('sendComplaintStatusUpdateEmail', () => {
  it('formats status and escapes name', async () => {
    await svc.sendComplaintStatusUpdateEmail('c@x', XSS, 2, 'in_progress');
    expect(mockSendMail.mock.calls[0][0].subject).toBe('Complaint #2 Status Updated: IN PROGRESS');
    expect(html()).toContain(ESC);
    expect(html()).not.toContain('<script>');
  });
  it('swallows errors (including bad status input)', async () => {
    await expect(svc.sendComplaintStatusUpdateEmail('c', 'n', 1, undefined)).resolves.toBeUndefined();
    mockSendMail.mockRejectedValue(new Error('x'));
    await expect(svc.sendComplaintStatusUpdateEmail('c', 'n', 1, 'new')).resolves.toBeUndefined();
  });
});

describe('sendComplaintSubmittedToAdminEmail', () => {
  it('escapes all user fields and mails each admin', async () => {
    db.any.mockResolvedValue([{ email: 'a1@x', name: 'A1' }, { email: 'a2@x', name: XSS }]);
    await svc.sendComplaintSubmittedToAdminEmail(9, XSS, XSS, XSS);
    expect(mockSendMail).toHaveBeenCalledTimes(2);
    const h = mockSendMail.mock.calls[1][0].html;
    expect(h.split(ESC)).toHaveLength(5);
    expect(h).not.toContain('<script>');
  });
  it('no admins -> nothing sent', async () => {
    db.any.mockResolvedValue([]);
    await svc.sendComplaintSubmittedToAdminEmail(1, 'n', 'l', 'c');
    expect(mockSendMail).not.toHaveBeenCalled();
  });
  it('swallows errors', async () => {
    db.any.mockRejectedValue(new Error('x'));
    await expect(svc.sendComplaintSubmittedToAdminEmail(1, 'n', 'l', 'c')).resolves.toBeUndefined();
  });
});

describe('sendPasswordResetEmail', () => {
  it('returns true, escapes name, defaults to "user"', async () => {
    expect(await svc.sendPasswordResetEmail('e@x', XSS, 'http://r')).toBe(true);
    expect(html()).toContain(ESC);
    expect(html()).toContain('href="http://r"');
    await svc.sendPasswordResetEmail('e@x', null, 'http://r');
    expect(mockSendMail.mock.calls[1][0].html).toContain('Dear user,');
  });
  it('returns false on transport error', async () => {
    mockSendMail.mockRejectedValue(new Error('x'));
    expect(await svc.sendPasswordResetEmail('e', 'n', 'u')).toBe(false);
  });
});

describe('escaping of other characters', () => {
  it('escapes ampersand and quotes', async () => {
    await svc.sendComplaintAssignedEmail('o', `A&B "q" 'z'`, 1, 't');
    expect(html()).toContain('A&amp;B &quot;q&quot; &#39;z&#39;');
  });
});

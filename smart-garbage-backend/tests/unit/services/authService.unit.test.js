jest.mock('../../../src/config/database', () => {
  const tx = { oneOrNone: jest.fn(), one: jest.fn(), none: jest.fn() };
  const db = {
    oneOrNone: jest.fn(), one: jest.fn(), none: jest.fn(), tx: jest.fn(), _tx: tx,
  };
  return { db };
});
jest.mock('../../../src/middleware/auth', () => ({
  generateToken: jest.fn(() => 'access-tok'),
  generateRefreshToken: jest.fn(() => 'refresh-tok'),
}));
jest.mock('../../../src/services/notificationService', () => ({
  sendPasswordResetEmail: jest.fn(),
}));

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../../../src/config/database');
const notification = require('../../../src/services/notificationService');
const svc = require('../../../src/services/authService');

beforeEach(() => {
  ['oneOrNone', 'one', 'none'].forEach((k) => { db[k].mockReset(); db._tx[k].mockReset(); });
  db.tx.mockReset();
  db.tx.mockImplementation((cb) => cb(db._tx));
  notification.sendPasswordResetEmail.mockReset();
  process.env.JWT_SECRET = 'unit-secret';
});

describe('registerUser', () => {
  it('rejects duplicate email', async () => {
    db.oneOrNone.mockResolvedValue({ user_id: 1 });
    await expect(svc.registerUser({ email: 'a@b.c', password: 'x' }))
      .rejects.toThrow('Registration failed: User with this email already exists');
    expect(db.one).not.toHaveBeenCalled();
  });

  it('forces citizen role, hashes password, defaults name, no prefs without phone', async () => {
    db.oneOrNone.mockResolvedValue(null);
    db.one.mockResolvedValue({ user_id: 5 });
    const r = await svc.registerUser({ email: 'jane@x.com', password: 'pw', role: 'admin' });
    expect(r).toEqual({ user_id: 5 });
    const params = db.one.mock.calls[0][1];
    expect(params[0]).toBe('jane');
    expect(params[4]).toBe('citizen');
    expect(params[3]).not.toBe('pw');
    expect(await bcrypt.compare('pw', params[3])).toBe(true);
    expect(db.none).not.toHaveBeenCalled();
  });

  it('stores the email trimmed and lower-cased and checks duplicates ignoring case', async () => {
    db.oneOrNone.mockResolvedValue(null);
    db.one.mockResolvedValue({ user_id: 9 });
    await svc.registerUser({ email: '  Jane.Doe@Example.COM ', password: 'pw' });
    expect(db.oneOrNone.mock.calls[0][0]).toContain('LOWER(email) = LOWER($1)');
    expect(db.oneOrNone.mock.calls[0][1]).toEqual(['jane.doe@example.com']);
    const params = db.one.mock.calls[0][1];
    expect(params[1]).toBe('jane.doe@example.com');
    expect(params[0]).toBe('Jane.Doe'); // default name keeps the typed case
  });

  it('creates preferences row when phone given', async () => {
    db.oneOrNone.mockResolvedValue(null);
    db.one.mockResolvedValue({ user_id: 7 });
    await svc.registerUser({ email: 'a@b.c', password: 'pw', name: 'N', phone: '123' });
    expect(db.none).toHaveBeenCalledWith(expect.stringContaining('user_preferences'), [7, '123']);
  });
});

describe('loginUser email matching', () => {
  it('looks the account up case-insensitively, preferring an exact-case row', async () => {
    db.oneOrNone.mockResolvedValue(null);
    await expect(svc.loginUser(' Jane@X.com ', 'p')).rejects.toThrow('Invalid email or password');
    const sql = db.oneOrNone.mock.calls[0][0];
    expect(sql).toContain('LOWER(email) = LOWER($1)');
    expect(sql).toContain('ORDER BY (email = $1) DESC');
    expect(sql).toContain('LIMIT 1');
    expect(db.oneOrNone.mock.calls[0][1]).toEqual(['Jane@X.com']);
  });
});

describe('loginUser', () => {
  const mkUser = async (over = {}) => ({
    user_id: 1, name: 'N', email: 'e', role: 'citizen', status: 'active',
    password_hash: await bcrypt.hash('good', 4), ...over,
  });

  it('unknown user', async () => {
    db.oneOrNone.mockResolvedValue(null);
    await expect(svc.loginUser('e', 'p')).rejects.toThrow('Login failed: Invalid email or password');
  });
  it.each(['inactive', 'suspended'])('blocks %s accounts', async (status) => {
    db.oneOrNone.mockResolvedValue(await mkUser({ status }));
    await expect(svc.loginUser('e', 'good')).rejects.toThrow('inactive or suspended');
  });
  it('wrong password', async () => {
    db.oneOrNone.mockResolvedValue(await mkUser());
    await expect(svc.loginUser('e', 'bad')).rejects.toThrow('Invalid email or password');
  });
  it('success returns tokens and no hash', async () => {
    db.oneOrNone.mockResolvedValue(await mkUser());
    const r = await svc.loginUser('e', 'good');
    expect(r).toEqual({
      user_id: 1, name: 'N', email: 'e', role: 'citizen',
      accessToken: 'access-tok', refreshToken: 'refresh-tok',
    });
    expect(r.password_hash).toBeUndefined();
  });
});

describe('profile', () => {
  it('getUserProfile found / not found', async () => {
    db.oneOrNone.mockResolvedValueOnce({ user_id: 1 });
    expect(await svc.getUserProfile(1)).toEqual({ user_id: 1 });
    db.oneOrNone.mockResolvedValueOnce(null);
    await expect(svc.getUserProfile(2)).rejects.toThrow('Failed to get profile: User not found');
  });
  it('updateUserProfile passes fields and wraps errors', async () => {
    db.one.mockResolvedValueOnce({ user_id: 1, name: 'X' });
    expect(await svc.updateUserProfile(1, { name: 'X' })).toEqual({ user_id: 1, name: 'X' });
    expect(db.one.mock.calls[0][1]).toEqual([1, 'X', undefined, undefined]);
    db.one.mockRejectedValueOnce(new Error('boom'));
    await expect(svc.updateUserProfile(1, {})).rejects.toThrow('Failed to update profile: boom');
  });
});

describe('changePassword', () => {
  it('user not found', async () => {
    db.oneOrNone.mockResolvedValue(null);
    await expect(svc.changePassword(1, 'a', 'b')).rejects.toThrow('User not found');
  });
  it('wrong old password', async () => {
    db.oneOrNone.mockResolvedValue({ password_hash: await bcrypt.hash('real', 4) });
    await expect(svc.changePassword(1, 'nope', 'new')).rejects.toThrow('Old password is incorrect');
    expect(db.none).not.toHaveBeenCalled();
  });
  it('success stores new hash', async () => {
    db.oneOrNone.mockResolvedValue({ password_hash: await bcrypt.hash('real', 4) });
    const r = await svc.changePassword(1, 'real', 'new');
    expect(r.success).toBe(true);
    const hash = db.none.mock.calls[0][1][1];
    expect(await bcrypt.compare('new', hash)).toBe(true);
  });
});

describe('refreshTokens', () => {
  it('invalid token', async () => {
    await expect(svc.refreshTokens('garbage')).rejects.toThrow('Invalid or expired refresh token');
  });
  it('inactive / missing account', async () => {
    const tok = jwt.sign({ user_id: 1 }, 'unit-secret_refresh');
    db.oneOrNone.mockResolvedValueOnce(null);
    await expect(svc.refreshTokens(tok)).rejects.toThrow('Account is not active');
    db.oneOrNone.mockResolvedValueOnce({ user_id: 1, status: 'suspended' });
    await expect(svc.refreshTokens(tok)).rejects.toThrow('Account is not active');
  });
  it('success', async () => {
    const tok = jwt.sign({ user_id: 1 }, 'unit-secret_refresh');
    db.oneOrNone.mockResolvedValue({ user_id: 1, status: 'active' });
    expect(await svc.refreshTokens(tok)).toEqual({ accessToken: 'access-tok', refreshToken: 'refresh-tok' });
  });
});

describe('requestPasswordReset', () => {
  it.each([
    ['unknown', null],
    ['inactive', { user_id: 1, status: 'inactive' }],
    ['suspended', { user_id: 1, status: 'suspended' }],
  ])('silently ignores %s user', async (_n, user) => {
    db.oneOrNone.mockResolvedValue(user);
    await expect(svc.requestPasswordReset('e')).resolves.toBeUndefined();
    expect(db.none).not.toHaveBeenCalled();
    expect(notification.sendPasswordResetEmail).not.toHaveBeenCalled();
  });

  it('stores hashed token and emails raw token link', async () => {
    process.env.FRONTEND_URL = 'http://front.test///';
    db.oneOrNone.mockResolvedValue({ user_id: 3, name: 'N', email: 'e@x', status: 'active' });
    await svc.requestPasswordReset('E@x');
    const [uid, hash] = db.none.mock.calls[0][1];
    expect(uid).toBe(3);
    const url = notification.sendPasswordResetEmail.mock.calls[0][2];
    const token = url.split('token=')[1];
    expect(url.startsWith('http://front.test/reset-password?token=')).toBe(true);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toBe(token);
    delete process.env.FRONTEND_URL;
  });

  it('defaults frontend url and swallows email/db failures', async () => {
    delete process.env.FRONTEND_URL;
    db.oneOrNone.mockResolvedValue({ user_id: 3, name: 'N', email: 'e', status: 'active' });
    notification.sendPasswordResetEmail.mockRejectedValue(new Error('smtp'));
    await expect(svc.requestPasswordReset('e')).resolves.toBeUndefined();
    expect(notification.sendPasswordResetEmail.mock.calls[0][2]).toMatch(/^http:\/\/localhost:3000\/reset-password/);
    db.oneOrNone.mockRejectedValue(new Error('db'));
    await expect(svc.requestPasswordReset('e')).resolves.toBeUndefined();
  });
});

describe('resetPassword', () => {
  it('bad/expired token', async () => {
    db._tx.oneOrNone.mockResolvedValue(null);
    await expect(svc.resetPassword('t', 'newpw')).rejects.toThrow('Invalid or expired reset token');
    expect(db._tx.none).not.toHaveBeenCalled();
  });
  it('success updates password and invalidates tokens inside tx', async () => {
    db._tx.oneOrNone.mockResolvedValue({ reset_id: 1, user_id: 9 });
    const r = await svc.resetPassword('t', 'newpw');
    expect(r.message).toMatch(/reset successfully/);
    expect(db.tx).toHaveBeenCalledTimes(1);
    expect(db._tx.none).toHaveBeenCalledTimes(2);
    expect(db._tx.none.mock.calls[0][1][0]).toBe(9);
    expect(await bcrypt.compare('newpw', db._tx.none.mock.calls[0][1][1])).toBe(true);
    expect(db._tx.none.mock.calls[1][0]).toMatch(/used_at = NOW\(\)/);
  });
});

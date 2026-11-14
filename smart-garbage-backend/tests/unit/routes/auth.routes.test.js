jest.mock('../../../src/services/authService', () => ({
  registerUser: jest.fn(), loginUser: jest.fn(), refreshTokens: jest.fn(), getUserProfile: jest.fn(),
  updateUserProfile: jest.fn(), changePassword: jest.fn(), requestPasswordReset: jest.fn(), resetPassword: jest.fn(),
}));
const request = require('supertest');
const { buildApp, tokenFor } = require('./helpers');
const authService = require('../../../src/services/authService');
const router = require('../../../src/routes/auth');

const app = buildApp('/api/auth', router);
const auth = tokenFor('citizen', 7);

beforeEach(() => jest.resetAllMocks());

describe('POST /register', () => {
  it('201 on success', async () => {
    authService.registerUser.mockResolvedValue({ user_id: 1 });
    const res = await request(app).post('/api/auth/register').send({ email: 'a@b.co', password: 'secret1', extra: 'x' });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ success: true, message: 'Registration successful', user: { user_id: 1 } });
    expect(authService.registerUser).toHaveBeenCalledWith({ email: 'a@b.co', password: 'secret1' });
  });
  it('400 on validation failure', async () => {
    const res = await request(app).post('/api/auth/register').send({ email: 'bad', password: '1' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation Error');
    expect(res.body.details.length).toBe(2);
  });
  it('400 when service throws', async () => {
    authService.registerUser.mockRejectedValue(new Error('exists'));
    const res = await request(app).post('/api/auth/register').send({ email: 'a@b.co', password: 'secret1' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('exists');
  });
});

describe('POST /login and rate limiter', () => {
  it('200 on success', async () => {
    authService.loginUser.mockResolvedValue({ token: 't', user: { user_id: 1 } });
    const res = await request(app).post('/api/auth/login').send({ email: 'a@b.co', password: 'pw' });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, message: 'Login successful', token: 't' });
    expect(authService.loginUser).toHaveBeenCalledWith('a@b.co', 'pw');
  });
  it('400 on validation failure', async () => {
    const res = await request(app).post('/api/auth/login').send({ email: 'a@b.co' });
    expect(res.status).toBe(400);
  });
  it('401 on bad credentials, then 429 after 10 failures', async () => {
    const send = () => request(app).post('/api/auth/login').send({ email: 'z@b.co', password: 'pw' });
    authService.loginUser.mockResolvedValueOnce({ token: 't' });
    expect((await send()).status).toBe(200); // success clears any earlier counter
    authService.loginUser.mockRejectedValue(new Error('Invalid credentials'));
    for (let i = 0; i < 10; i++) {
      const r = await send();
      expect(r.status).toBe(401);
      expect(r.body.error).toBe('Invalid credentials');
    }
    const blocked = await send();
    expect(blocked.status).toBe(429);
    expect(blocked.headers['retry-after']).toBeDefined();
    expect(blocked.body.error).toMatch(/Too many/);
  });
  it('a success after some failures clears the counter', async () => {
    // Fresh module registry so the limiter store starts empty
    let freshApp; let freshService;
    jest.isolateModules(() => {
      freshService = require('../../../src/services/authService');
      freshApp = buildApp('/api/auth', require('../../../src/routes/auth'));
    });
    const send = () => request(freshApp).post('/api/auth/login').send({ email: 'q@b.co', password: 'pw' });
    freshService.loginUser.mockRejectedValue(new Error('bad'));
    for (let i = 0; i < 5; i++) expect((await send()).status).toBe(401);
    freshService.loginUser.mockResolvedValue({ token: 't' });
    expect((await send()).status).toBe(200);
    freshService.loginUser.mockRejectedValue(new Error('bad'));
    for (let i = 0; i < 10; i++) expect((await send()).status).toBe(401);
    expect((await send()).status).toBe(429);
  });
});

describe('POST /refresh', () => {
  it('400 without token', async () => {
    const res = await request(app).post('/api/auth/refresh').send({});
    expect(res.status).toBe(400);
  });
  it('200 with tokens', async () => {
    authService.refreshTokens.mockResolvedValue({ token: 'n', refreshToken: 'r' });
    const res = await request(app).post('/api/auth/refresh').send({ refreshToken: 'old' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, token: 'n', refreshToken: 'r' });
    expect(authService.refreshTokens).toHaveBeenCalledWith('old');
  });
  it('401 when service rejects', async () => {
    authService.refreshTokens.mockRejectedValue(new Error('expired'));
    const res = await request(app).post('/api/auth/refresh').send({ refreshToken: 'old' });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('expired');
  });
});

describe('GET /profile', () => {
  it('401 without token / invalid token / missing token after scheme', async () => {
    expect((await request(app).get('/api/auth/profile')).status).toBe(401);
    expect((await request(app).get('/api/auth/profile').set('Authorization', 'Bearer garbage')).status).toBe(401);
    expect((await request(app).get('/api/auth/profile').set('Authorization', 'Bearer')).status).toBe(401);
  });
  it('200', async () => {
    authService.getUserProfile.mockResolvedValue({ user_id: 7 });
    const res = await request(app).get('/api/auth/profile').set('Authorization', auth);
    expect(res.status).toBe(200);
    expect(res.body.user).toEqual({ user_id: 7 });
    expect(authService.getUserProfile).toHaveBeenCalledWith(7);
  });
  it('400 on service error', async () => {
    authService.getUserProfile.mockRejectedValue(new Error('nope'));
    const res = await request(app).get('/api/auth/profile').set('Authorization', auth);
    expect(res.status).toBe(400);
  });
});

describe('PUT /profile', () => {
  it('401 without token', async () => {
    expect((await request(app).put('/api/auth/profile').send({})).status).toBe(401);
  });
  it('200', async () => {
    authService.updateUserProfile.mockResolvedValue({ user_id: 7, name: 'N' });
    const res = await request(app).put('/api/auth/profile').set('Authorization', auth).send({ name: 'N' });
    expect(res.status).toBe(200);
    expect(authService.updateUserProfile).toHaveBeenCalledWith(7, { name: 'N' });
  });
  it('400 on service error', async () => {
    authService.updateUserProfile.mockRejectedValue(new Error('bad'));
    const res = await request(app).put('/api/auth/profile').set('Authorization', auth).send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('bad');
  });
});

describe('POST /change-password', () => {
  const post = (body) => request(app).post('/api/auth/change-password').set('Authorization', auth).send(body);
  it('401 without token', async () => {
    expect((await request(app).post('/api/auth/change-password').send({})).status).toBe(401);
  });
  it('400 for short new password', async () => {
    expect((await post({ oldPassword: 'o', newPassword: '123' })).status).toBe(400);
  });
  it('400 for missing fields', async () => {
    expect((await post({ newPassword: 'abcdefg' })).status).toBe(400);
    expect((await post({})).status).toBe(400);
  });
  it('200', async () => {
    authService.changePassword.mockResolvedValue({ message: 'ok' });
    const res = await post({ oldPassword: 'old', newPassword: 'newpass' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, message: 'ok' });
    expect(authService.changePassword).toHaveBeenCalledWith(7, 'old', 'newpass');
  });
  it('400 on service error', async () => {
    authService.changePassword.mockRejectedValue(new Error('wrong'));
    const res = await post({ oldPassword: 'old', newPassword: 'newpass' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('wrong');
  });
});

describe('POST /forgot-password', () => {
  it('calls service for valid email, always 200', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({ email: ' a@b.co ' });
    expect(res.status).toBe(200);
    expect(authService.requestPasswordReset).toHaveBeenCalledWith('a@b.co');
  });
  it('200 without calling service for missing email', async () => {
    const res = await request(app).post('/api/auth/forgot-password').send({});
    expect(res.status).toBe(200);
    expect(authService.requestPasswordReset).not.toHaveBeenCalled();
  });
});

describe('POST /reset-password', () => {
  const post = (body) => request(app).post('/api/auth/reset-password').send(body);
  it('400 when fields missing', async () => {
    expect((await post({})).status).toBe(400);
    expect((await post({ token: 't' })).status).toBe(400);
  });
  it('400 when password too short', async () => {
    expect((await post({ token: 't', newPassword: '123' })).status).toBe(400);
  });
  it('200', async () => {
    authService.resetPassword.mockResolvedValue({ message: 'done' });
    const res = await post({ token: 't', newPassword: 'abcdef' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, message: 'done' });
    expect(authService.resetPassword).toHaveBeenCalledWith('t', 'abcdef');
  });
  it('400 on service error', async () => {
    authService.resetPassword.mockRejectedValue(new Error('invalid token'));
    const res = await post({ token: 't', newPassword: 'abcdef' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('invalid token');
  });
});

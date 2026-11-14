process.env.JWT_SECRET = 'unit-test-secret-long-enough';
process.env.FRONTEND_URL = 'http://localhost:3000, https://app.example.com';

jest.mock('../../src/config/database', () => ({
  db: {},
  pgp: { end: jest.fn() },
  checkConnection: jest.fn(),
}));

const request = require('supertest');
const database = require('../../src/config/database');
const { validateEnv, loadConfig, parseOrigins } = require('../../src/config/env');
const { createRateLimiter } = require('../../src/middleware/rateLimit');
const requestId = require('../../src/middleware/requestId');
const errorHandler = require('../../src/middleware/errorHandler');
const app = require('../../src/app');

const baseEnv = { NODE_ENV: 'development', JWT_SECRET: 'a-sufficiently-long-secret' };

describe('env validation', () => {
  test('accepts minimal dev env and applies defaults', () => {
    const cfg = loadConfig(baseEnv);
    expect(cfg.port).toBe(5000);
    expect(cfg.frontendOrigins).toEqual(['http://localhost:3000']);
    expect(Object.isFrozen(cfg)).toBe(true);
  });

  test('lists all problems at once', () => {
    let err;
    try { validateEnv({ NODE_ENV: 'bogus', PORT: 'abc', JWT_SECRET: 'short' }); } catch (e) { err = e; }
    expect(err.problems.length).toBeGreaterThanOrEqual(3);
    expect(err.message).toMatch(/JWT_SECRET/);
    expect(err.message).toMatch(/PORT/);
  });

  test('JWT_SECRET required', () => {
    expect(() => validateEnv({ NODE_ENV: 'development' })).toThrow(/JWT_SECRET/);
  });

  test('production rejects placeholder secret and requires DB settings', () => {
    expect(() => validateEnv({ NODE_ENV: 'production', JWT_SECRET: 'your_jwt_secret_here_123', DB_HOST: 'h', DB_NAME: 'n', DB_USER: 'u' }))
      .toThrow(/placeholder/);
    expect(() => validateEnv({ NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(32) })).toThrow(/DB_HOST/);
    expect(() => validateEnv({ NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(32), DB_HOST: 'h', DB_NAME: 'n', DB_USER: 'u' })).not.toThrow();
  });

  test('parseOrigins splits and trims', () => {
    expect(parseOrigins('http://a.com/, http://b.com')).toEqual(['http://a.com', 'http://b.com']);
  });
});

describe('rate limiter', () => {
  const run = (limiter, req = { ip: '1.1.1.1', path: '/x' }) => {
    const res = { statusCode: 200, setHeader: jest.fn(), on: jest.fn(), status: jest.fn().mockReturnThis(), json: jest.fn() };
    const next = jest.fn();
    limiter(req, res, next);
    return { res, next };
  };

  test('blocks after max and sets 429 shape', () => {
    const l = createRateLimiter({ max: 2, windowMs: 60000 });
    expect(run(l).next).toHaveBeenCalled();
    expect(run(l).next).toHaveBeenCalled();
    const { res, next } = run(l);
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(429);
    expect(res.json.mock.calls[0][0].success).toBe(false);
    expect(run(l, { ip: '2.2.2.2', path: '/x' }).next).toHaveBeenCalled();
    l.stop();
  });

  test('reset clears counter', () => {
    const l = createRateLimiter({ max: 1, windowMs: 60000 });
    const req = { ip: '1.1.1.1', path: '/x' };
    run(l, req);
    l.reset(req);
    expect(run(l, req).next).toHaveBeenCalled();
    l.stop();
  });

  test('skipSuccessful does not count 2xx responses', () => {
    const l = createRateLimiter({ max: 1, windowMs: 60000, skipSuccessful: true });
    const first = run(l);
    first.res.on.mock.calls[0][1](); // finish with 200
    expect(run(l).next).toHaveBeenCalled();
    l.stop();
  });

  test('cleanup removes expired entries', () => {
    const l = createRateLimiter({ max: 5, windowMs: 1000 });
    run(l);
    expect(l.size()).toBe(1);
    l.cleanup(Date.now() + 5000);
    expect(l.size()).toBe(0);
    l.stop();
  });

  test('periodic timer cleans up expired entries', () => {
    jest.useFakeTimers();
    const l = createRateLimiter({ max: 5, windowMs: 1000, cleanupIntervalMs: 1000 });
    run(l);
    jest.advanceTimersByTime(3000);
    expect(l.size()).toBe(0);
    l.stop();
    jest.useRealTimers();
  });
});

describe('request id', () => {
  test('generates one and echoes a sane incoming one', async () => {
    const a = await request(app).get('/health');
    expect(a.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    const b = await request(app).get('/health').set('X-Request-Id', 'client-req-12345');
    expect(b.headers['x-request-id']).toBe('client-req-12345');
    const c = await request(app).get('/health').set('X-Request-Id', 'bad id with spaces');
    expect(c.headers['x-request-id']).not.toBe('bad id with spaces');
  });

  test('middleware sets req.id', () => {
    const req = { headers: {} }; const res = { setHeader: jest.fn() }; const next = jest.fn();
    requestId(req, res, next);
    expect(req.id).toBeTruthy();
    expect(next).toHaveBeenCalled();
  });
});

describe('errorHandler production vs development', () => {
  const orig = process.env.NODE_ENV;
  afterEach(() => { process.env.NODE_ENV = orig; });
  const call = (err) => {
    const res = { headersSent: false, status: jest.fn().mockReturnThis(), json: jest.fn() };
    errorHandler(err, { id: 'rid-1', method: 'GET', url: '/x' }, res, jest.fn());
    return res;
  };

  test('production hides 5xx internals and stack, includes requestId', () => {
    process.env.NODE_ENV = 'production';
    const res = call(new Error('db password leaked'));
    const body = res.json.mock.calls[0][0];
    expect(res.status).toHaveBeenCalledWith(500);
    expect(body.error).toBe('Internal Server Error');
    expect(body.stack).toBeUndefined();
    expect(body.requestId).toBe('rid-1');
  });

  test('production exposes operational and 4xx errors', () => {
    process.env.NODE_ENV = 'production';
    let res = call({ status: 409, message: 'conflict', details: [1] });
    expect(res.json.mock.calls[0][0]).toMatchObject({ error: 'conflict', details: [1] });
    res = call({ statusCode: 503, isOperational: true, message: 'busy' });
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json.mock.calls[0][0].error).toBe('busy');
  });

  test('development shows message and stack', () => {
    process.env.NODE_ENV = 'development';
    const body = call(new Error('boom')).json.mock.calls[0][0];
    expect(body.error).toBe('boom');
    expect(body.stack).toContain('boom');
  });
});

describe('app', () => {
  beforeEach(() => { database.checkConnection.mockReset(); });

  test('GET /health', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ success: true, message: 'Smart Garbage Reporting API is running' });
  });

  test('GET /health/ready 200 / 503', async () => {
    database.checkConnection.mockResolvedValue(true);
    expect((await request(app).get('/health/ready')).status).toBe(200);
    database.checkConnection.mockRejectedValue(new Error('down'));
    const res = await request(app).get('/health/ready');
    expect(res.status).toBe(503);
    expect(res.body.success).toBe(false);
  });

  test('404 shape', async () => {
    const res = await request(app).get('/nope');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: false, error: 'Route not found' });
  });

  test('CORS allows listed origins (credentials) and denies others', async () => {
    const ok = await request(app).get('/health').set('Origin', 'https://app.example.com');
    expect(ok.headers['access-control-allow-origin']).toBe('https://app.example.com');
    expect(ok.headers['access-control-allow-credentials']).toBe('true');
    const bad = await request(app).get('/health').set('Origin', 'https://evil.example.com');
    expect(bad.headers['access-control-allow-origin']).toBeUndefined();
    const pre = await request(app).options('/api/auth/login')
      .set('Origin', 'http://localhost:3000').set('Access-Control-Request-Method', 'POST');
    expect(pre.headers['access-control-allow-origin']).toBe('http://localhost:3000');
  });

  test('oversized JSON body rejected with 413', async () => {
    const big = JSON.stringify({ a: 'x'.repeat(1.2 * 1024 * 1024) });
    const res = await request(app).post('/api/auth/login').set('Content-Type', 'application/json').send(big);
    expect(res.status).toBe(413);
  });
});

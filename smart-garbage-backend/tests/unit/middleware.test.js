process.env.JWT_SECRET = 'unit-test-secret';
const jwt = require('jsonwebtoken');
const { verifyToken, checkRole, generateToken } = require('../../src/middleware/auth');
const { validateRequest, schemas } = require('../../src/middleware/validator');
const errorHandler = require('../../src/middleware/errorHandler');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('auth middleware', () => {
  const user = { user_id: 7, email: 'a@b.com', role: 'admin', password: 'x' };

  test('generateToken payload contains only id, email, role', () => {
    const d = jwt.verify(generateToken(user), process.env.JWT_SECRET);
    expect(d).toMatchObject({ user_id: 7, email: 'a@b.com', role: 'admin' });
    expect(d.password).toBeUndefined();
    expect(d.exp).toBeGreaterThan(d.iat);
  });

  test('verifyToken: missing token -> 401', () => {
    const res = mockRes(); const next = jest.fn();
    verifyToken({ headers: {} }, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json.mock.calls[0][0].error).toBe('No token provided');
    expect(next).not.toHaveBeenCalled();
  });

  test('verifyToken: invalid token -> 401', () => {
    const res = mockRes(); const next = jest.fn();
    verifyToken({ headers: { authorization: 'Bearer garbage' } }, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  test('verifyToken: token signed with other secret / expired -> 401', () => {
    const bad = jwt.sign({ user_id: 1 }, 'other');
    const expired = jwt.sign({ user_id: 1 }, process.env.JWT_SECRET, { expiresIn: -10 });
    for (const t of [bad, expired]) {
      const res = mockRes(); const next = jest.fn();
      verifyToken({ headers: { authorization: `Bearer ${t}` } }, res, next);
      expect(res.status).toHaveBeenCalledWith(401);
      expect(next).not.toHaveBeenCalled();
    }
  });

  test('verifyToken: valid token sets req.user and calls next', () => {
    const req = { headers: { authorization: `Bearer ${generateToken(user)}` } };
    const res = mockRes(); const next = jest.fn();
    verifyToken(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(req.user.role).toBe('admin');
  });

  test('checkRole allows listed role, denies others and missing user', () => {
    const mw = checkRole('admin', 'officer');
    let next = jest.fn(); let res = mockRes();
    mw({ user: { role: 'officer' } }, res, next);
    expect(next).toHaveBeenCalled();

    next = jest.fn(); res = mockRes();
    mw({ user: { role: 'citizen' } }, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();

    next = jest.fn(); res = mockRes();
    mw({}, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
  });
});

describe('validator', () => {
  const run = (schema, body) => {
    const req = { body }; const res = mockRes(); const next = jest.fn();
    validateRequest(schema)(req, res, next);
    return { req, res, next };
  };

  test('registerUser strips role (no privilege escalation)', () => {
    const { req, next } = run(schemas.registerUser, {
      email: 'a@b.com', password: 'secret1', name: ' Bob ', role: 'admin', is_admin: true,
    });
    expect(next).toHaveBeenCalled();
    expect(req.body.role).toBeUndefined();
    expect(req.body.is_admin).toBeUndefined();
    expect(req.body.name).toBe('Bob');
  });

  test('registerUser rejects bad email, short password, missing fields', () => {
    const { res, next } = run(schemas.registerUser, { email: 'nope', password: '123' });
    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(400);
    const fields = res.json.mock.calls[0][0].details.map((d) => d.field);
    expect(fields).toEqual(expect.arrayContaining(['email', 'password']));
    expect(run(schemas.registerUser, {}).res.status).toHaveBeenCalledWith(400);
  });

  test('registerUser accepts 6-char password, rejects 5; limits name/phone length', () => {
    expect(run(schemas.registerUser, { email: 'a@b.com', password: '123456' }).next).toHaveBeenCalled();
    expect(run(schemas.registerUser, { email: 'a@b.com', password: '12345' }).next).not.toHaveBeenCalled();
    expect(run(schemas.registerUser, { email: 'a@b.com', password: '123456', phone: '1'.repeat(21) }).next).not.toHaveBeenCalled();
    expect(run(schemas.registerUser, { email: 'a@b.com', password: '123456', name: 'x'.repeat(256) }).next).not.toHaveBeenCalled();
  });

  test('loginUser requires email and password', () => {
    expect(run(schemas.loginUser, { email: 'a@b.com', password: 'p' }).next).toHaveBeenCalled();
    expect(run(schemas.loginUser, { email: 'a@b.com' }).res.status).toHaveBeenCalledWith(400);
    expect(run(schemas.loginUser, { email: 'bad', password: 'p' }).res.status).toHaveBeenCalledWith(400);
    const { req } = run(schemas.loginUser, { email: 'a@b.com', password: 'p', role: 'admin' });
    expect(req.body.role).toBeUndefined();
  });
});

describe('errorHandler', () => {
  const call = (err) => { const res = mockRes(); errorHandler(err, {}, res, jest.fn()); return res; };
  const origEnv = process.env.NODE_ENV;
  afterEach(() => { process.env.NODE_ENV = origEnv; });

  test('joi error -> 400 Validation Error', () => {
    const res = call({ isJoi: true, message: 'm', details: [{ message: 'x' }] });
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Validation Error', details: [{ message: 'x' }] });
  });

  test('JWT errors -> 401', () => {
    let res = call({ name: 'JsonWebTokenError', message: 'm' });
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json.mock.calls[0][0].error).toBe('Invalid token');
    res = call({ name: 'TokenExpiredError', message: 'm' });
    expect(res.json.mock.calls[0][0].error).toBe('Token expired');
  });

  test('pg unique violation -> 409 with the column named, never the driver text or value', () => {
    const res = call({
      code: '23505',
      message: 'duplicate key value violates unique constraint "officers_employee_id_key"',
      detail: 'Key (employee_id)=(E2E-0001) already exists.',
    });
    expect(res.status).toHaveBeenCalledWith(409);
    const body = res.json.mock.calls[0][0];
    expect(body).toEqual({ success: false, error: 'A record with this employee id already exists', field: 'employee_id' });
    expect(JSON.stringify(body)).not.toMatch(/E2E-0001|officers_employee_id_key|duplicate key/);
  });

  test.each([
    ['23503', 409, 'This record refers to, or is still used by, other data'],
    ['23502', 400, 'A required value is missing'],
    ['23514', 400, 'A value is outside the allowed range'],
    ['23000', 400, 'The data could not be saved'],
    ['23505', 409, 'This record already exists'], // no detail available
  ])('pg %s without detail -> %i', (code, status, message) => {
    const res = call({ code, message: 'raw driver text' });
    expect(res.status).toHaveBeenCalledWith(status);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: message });
  });

  test('lower(email) unique index reports the plain column', () => {
    const res = call({ code: '23505', message: 'm', detail: 'Key (lower(email::text))=(a@b.c) already exists.' });
    expect(res.json.mock.calls[0][0].error).toMatch(/^A record with this /);
    expect(JSON.stringify(res.json.mock.calls[0][0])).not.toContain('a@b.c');
  });

  test('default 500 shape; honors err.status; stack only in development', () => {
    process.env.NODE_ENV = 'production';
    let res = call(new Error('boom'));
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ success: false, error: 'Internal Server Error' }); // 5xx messages are not leaked in production
    res = call({ status: 404, message: 'nf' });
    expect(res.status).toHaveBeenCalledWith(404);
    res = call({});
    expect(res.json.mock.calls[0][0].error).toBe('Internal Server Error');
    process.env.NODE_ENV = 'development';
    res = call(new Error('boom'));
    expect(res.json.mock.calls[0][0].stack).toContain('boom');
  });
});

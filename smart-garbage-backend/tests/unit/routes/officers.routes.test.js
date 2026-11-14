jest.mock('../../../src/services/officerService', () => ({
  getAllOfficers: jest.fn(), countOfficers: jest.fn(), getOfficerProfileForUser: jest.fn(),
  getOfficerMetricsForUser: jest.fn(), getOfficerById: jest.fn(), createOfficer: jest.fn(), updateOfficer: jest.fn(),
  getOfficerUserId: jest.fn(), updateOfficerLocation: jest.fn(), assertOfficerAccess: jest.fn(),
  getOfficerMetrics: jest.fn(), deactivateOfficer: jest.fn(), deleteOfficer: jest.fn(),
}));

const request = require('supertest');
const { buildApp, tokenFor } = require('./helpers');
const svc = require('../../../src/services/officerService');
const AppError = require('../../../src/utils/AppError');
const router = require('../../../src/routes/officers');

const app = buildApp('/api/officers', router);
const citizen = tokenFor('citizen', 7);
const officer = tokenFor('officer', 8);
const admin = tokenFor('admin', 9);

beforeEach(() => jest.resetAllMocks());

describe('GET /', () => {
  it('401 / 403', async () => {
    expect((await request(app).get('/api/officers')).status).toBe(401);
    expect((await request(app).get('/api/officers').set('Authorization', officer)).status).toBe(403);
  });
  it('200 with default and explicit filters', async () => {
    svc.getAllOfficers.mockResolvedValue([{ id: 1 }]);
    svc.countOfficers.mockResolvedValue(5);
    let res = await request(app).get('/api/officers').set('Authorization', admin);
    expect(res.body).toEqual({ success: true, data: [{ id: 1 }], count: 1, total: 5 });
    expect(svc.getAllOfficers).toHaveBeenCalledWith({ status: 'active', wardId: null, limit: 100, offset: 0 });
    res = await request(app).get('/api/officers?status=inactive&ward_id=3&limit=5&offset=10').set('Authorization', admin);
    expect(svc.getAllOfficers).toHaveBeenLastCalledWith({ status: 'inactive', wardId: 3, limit: 5, offset: 10 });
    expect(svc.countOfficers).toHaveBeenLastCalledWith({ status: 'inactive', wardId: 3, limit: 5, offset: 10 });
    await request(app).get('/api/officers?limit=100000&ward_id=abc').set('Authorization', admin);
    expect(svc.getAllOfficers).toHaveBeenLastCalledWith(expect.objectContaining({ limit: 100, wardId: null }));
  });
});

describe('GET /me and /me/metrics', () => {
  it('401 / 403', async () => {
    expect((await request(app).get('/api/officers/me')).status).toBe(401);
    expect((await request(app).get('/api/officers/me').set('Authorization', admin)).status).toBe(403);
    expect((await request(app).get('/api/officers/me/metrics')).status).toBe(401);
    expect((await request(app).get('/api/officers/me/metrics').set('Authorization', citizen)).status).toBe(403);
  });
  it('200', async () => {
    svc.getOfficerProfileForUser.mockResolvedValue({ officer_id: 1 });
    svc.getOfficerMetricsForUser.mockResolvedValue({ m: 1 });
    let res = await request(app).get('/api/officers/me').set('Authorization', officer);
    expect(res.body).toEqual({ success: true, officer: { officer_id: 1 } });
    expect(svc.getOfficerProfileForUser).toHaveBeenCalledWith(8);
    res = await request(app).get('/api/officers/me/metrics').set('Authorization', officer);
    expect(res.body).toEqual({ success: true, metrics: { m: 1 } });
    expect(svc.getOfficerMetricsForUser).toHaveBeenCalledWith(8);
  });
  it('propagates 404', async () => {
    svc.getOfficerProfileForUser.mockRejectedValue(AppError.notFound('nf'));
    expect((await request(app).get('/api/officers/me').set('Authorization', officer)).status).toBe(404);
  });
});

describe('GET /:id', () => {
  it('401', async () => {
    expect((await request(app).get('/api/officers/1')).status).toBe(401);
  });
  it('400 invalid id', async () => {
    const res = await request(app).get('/api/officers/abc').set('Authorization', admin);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid officer id');
  });
  it('404 when missing', async () => {
    svc.getOfficerById.mockResolvedValue(null);
    expect((await request(app).get('/api/officers/1').set('Authorization', admin)).status).toBe(404);
  });
  it('200 for admin and for self officer', async () => {
    svc.getOfficerById.mockResolvedValue({ officer_id: 1, user_id: 8 });
    expect((await request(app).get('/api/officers/1').set('Authorization', admin)).status).toBe(200);
    const res = await request(app).get('/api/officers/1').set('Authorization', officer);
    expect(res.status).toBe(200);
    expect(res.body.officer.officer_id).toBe(1);
    expect(svc.getOfficerById).toHaveBeenCalledWith(1);
  });
  it('403 for a different non-admin user', async () => {
    svc.getOfficerById.mockResolvedValue({ officer_id: 1, user_id: 99 });
    expect((await request(app).get('/api/officers/1').set('Authorization', officer)).status).toBe(403);
  });
});

describe('POST /', () => {
  const post = (tok, body) => request(app).post('/api/officers').set('Authorization', tok).send(body);
  it('401 / 403', async () => {
    expect((await request(app).post('/api/officers').send({})).status).toBe(401);
    expect((await post(officer, {})).status).toBe(403);
  });
  it('400 on missing fields', async () => {
    expect((await post(admin, { email: 'a@b.co' })).status).toBe(400);
    expect((await post(admin)).status).toBe(400);
  });
  it('400 on non-string email/password', async () => {
    const res = await post(admin, { email: 1, password: 2, employee_id: 'E' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('email and password must be strings');
  });
  it('400 on bad year', async () => {
    const res = await post(admin, { email: 'a@b.co', password: 'p', employee_id: 'E', year_of_joining: 'abc' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('year_of_joining must be a number');
  });
  it('201 with defaults', async () => {
    svc.createOfficer.mockResolvedValue({ officer_id: 1 });
    const res = await post(admin, { email: 'joe@b.co', password: 'p', employee_id: 'E1' });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ success: true, message: 'Officer created successfully', officer: { officer_id: 1 } });
    expect(svc.createOfficer).toHaveBeenCalledWith({
      name: 'joe', email: 'joe@b.co', phone: '0000000000', password: 'p', employee_id: 'E1',
      ward_id: null, area_name: 'Unassigned', year_of_joining: new Date().getFullYear(),
    });
  });
  it('201 with explicit values', async () => {
    svc.createOfficer.mockResolvedValue({ officer_id: 2 });
    await post(admin, { email: 'a@b.co', password: 'p', employee_id: 'E', name: 'N', phone: '1', assigned_area_name: 'Z', year_of_joining: '2020' });
    expect(svc.createOfficer).toHaveBeenCalledWith(expect.objectContaining({ name: 'N', phone: '1', area_name: 'Z', year_of_joining: 2020 }));
  });
  it('409 conflict from service', async () => {
    svc.createOfficer.mockRejectedValue(AppError.conflict('dup'));
    expect((await post(admin, { email: 'a@b.co', password: 'p', employee_id: 'E' })).status).toBe(409);
  });
});

describe('PUT /:id', () => {
  it('401 / 403 / 400', async () => {
    expect((await request(app).put('/api/officers/1').send({})).status).toBe(401);
    expect((await request(app).put('/api/officers/1').set('Authorization', officer).send({})).status).toBe(403);
    expect((await request(app).put('/api/officers/x').set('Authorization', admin).send({})).status).toBe(400);
  });
  it('200', async () => {
    svc.updateOfficer.mockResolvedValue({ officer_id: 1 });
    const res = await request(app).put('/api/officers/1').set('Authorization', admin).send({ name: 'N' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, message: 'Officer updated successfully', officer: { officer_id: 1 } });
    expect(svc.updateOfficer).toHaveBeenCalledWith(1, { name: 'N' });
  });
  it('404 from service', async () => {
    svc.updateOfficer.mockRejectedValue(AppError.notFound('nf'));
    expect((await request(app).put('/api/officers/1').set('Authorization', admin).send({})).status).toBe(404);
  });
});

describe('POST /:id/location', () => {
  const post = (tok, body, id = 1) => request(app).post(`/api/officers/${id}/location`).set('Authorization', tok).send(body);
  it('401 / 403', async () => {
    expect((await request(app).post('/api/officers/1/location').send({})).status).toBe(401);
    expect((await post(admin, {})).status).toBe(403);
  });
  it('400 invalid id and missing coords', async () => {
    expect((await post(officer, { latitude: 1, longitude: 2 }, 'x')).status).toBe(400);
    expect((await post(officer, { latitude: 1 })).status).toBe(400);
    expect((await post(officer, { latitude: '', longitude: 2 })).status).toBe(400);
  });
  it('403 when officer does not own record (incl. null owner)', async () => {
    svc.getOfficerUserId.mockResolvedValueOnce(99);
    expect((await post(officer, { latitude: 1, longitude: 2 })).status).toBe(403);
    svc.getOfficerUserId.mockResolvedValueOnce(null);
    expect((await post(officer, { latitude: 1, longitude: 2 })).status).toBe(403);
    expect(svc.updateOfficerLocation).not.toHaveBeenCalled();
  });
  it('200 (accepts 0 coordinates)', async () => {
    svc.getOfficerUserId.mockResolvedValue(8);
    svc.updateOfficerLocation.mockResolvedValue({ officer_id: 1 });
    const res = await post(officer, { latitude: 0, longitude: 0 });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, message: 'Location updated successfully', officer: { officer_id: 1 } });
    expect(svc.updateOfficerLocation).toHaveBeenCalledWith(1, 0, 0);
  });
});

describe('GET /:id/metrics', () => {
  it('401 / 400', async () => {
    expect((await request(app).get('/api/officers/1/metrics')).status).toBe(401);
    expect((await request(app).get('/api/officers/x/metrics').set('Authorization', admin)).status).toBe(400);
  });
  it('200 and checks access with user', async () => {
    svc.assertOfficerAccess.mockResolvedValue();
    svc.getOfficerMetrics.mockResolvedValue({ m: 1 });
    const res = await request(app).get('/api/officers/1/metrics').set('Authorization', officer);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, metrics: { m: 1 } });
    expect(svc.assertOfficerAccess).toHaveBeenCalledWith(1, expect.objectContaining({ user_id: 8, role: 'officer' }));
  });
  it('403 from access check', async () => {
    svc.assertOfficerAccess.mockRejectedValue(AppError.forbidden('no'));
    expect((await request(app).get('/api/officers/1/metrics').set('Authorization', citizen)).status).toBe(403);
    expect(svc.getOfficerMetrics).not.toHaveBeenCalled();
  });
});

describe('PATCH /:id/deactivate and DELETE /:id', () => {
  it('401 / 403 / 400', async () => {
    expect((await request(app).patch('/api/officers/1/deactivate')).status).toBe(401);
    expect((await request(app).patch('/api/officers/1/deactivate').set('Authorization', officer)).status).toBe(403);
    expect((await request(app).patch('/api/officers/x/deactivate').set('Authorization', admin)).status).toBe(400);
    expect((await request(app).delete('/api/officers/1')).status).toBe(401);
    expect((await request(app).delete('/api/officers/1').set('Authorization', officer)).status).toBe(403);
    expect((await request(app).delete('/api/officers/x').set('Authorization', admin)).status).toBe(400);
  });
  it('200 deactivate', async () => {
    svc.deactivateOfficer.mockResolvedValue({ officer_id: 1 });
    const res = await request(app).patch('/api/officers/1/deactivate').set('Authorization', admin);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, message: 'Officer deactivated and complaints reassigned', officer: { officer_id: 1 } });
    expect(svc.deactivateOfficer).toHaveBeenCalledWith(1);
  });
  it('200 delete', async () => {
    svc.deleteOfficer.mockResolvedValue();
    const res = await request(app).delete('/api/officers/1').set('Authorization', admin);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, message: 'Officer deleted successfully' });
    expect(svc.deleteOfficer).toHaveBeenCalledWith(1);
  });
  it('404 / 409 propagate', async () => {
    svc.deactivateOfficer.mockRejectedValue(AppError.notFound('nf'));
    expect((await request(app).patch('/api/officers/1/deactivate').set('Authorization', admin)).status).toBe(404);
    svc.deleteOfficer.mockRejectedValue(AppError.conflict('c'));
    expect((await request(app).delete('/api/officers/1').set('Authorization', admin)).status).toBe(409);
  });
});

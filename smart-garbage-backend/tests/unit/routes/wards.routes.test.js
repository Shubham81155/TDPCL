jest.mock('../../../src/services/wardService', () => ({
  getAllWards: jest.fn(), countWards: jest.fn(), getWardById: jest.fn(), getWardOfficers: jest.fn(),
  createWard: jest.fn(), updateWard: jest.fn(),
}));

const request = require('supertest');
const { buildApp, tokenFor } = require('./helpers');
const svc = require('../../../src/services/wardService');
const AppError = require('../../../src/utils/AppError');
const router = require('../../../src/routes/wards');

const app = buildApp('/api/wards', router);
const citizen = tokenFor('citizen', 7);
const admin = tokenFor('admin', 9);

beforeEach(() => jest.resetAllMocks());

describe('GET /', () => {
  it('401', async () => {
    expect((await request(app).get('/api/wards')).status).toBe(401);
  });
  it('200 with filters and clamped pagination', async () => {
    svc.getAllWards.mockResolvedValue([{ id: 1 }]);
    svc.countWards.mockResolvedValue(3);
    const res = await request(app).get('/api/wards?city=Pune&limit=500&offset=2').set('Authorization', citizen);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: [{ id: 1 }], count: 1, total: 3 });
    expect(svc.getAllWards).toHaveBeenCalledWith({ city: 'Pune', limit: 100, offset: 2 });
    expect(svc.countWards).toHaveBeenCalledWith({ city: 'Pune', limit: 100, offset: 2 });
  });
  it('500 on unexpected service error hides message', async () => {
    svc.getAllWards.mockRejectedValue(new Error('db secret'));
    svc.countWards.mockResolvedValue(0);
    const res = await request(app).get('/api/wards').set('Authorization', citizen);
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Internal Server Error');
  });
});

describe('GET /:id', () => {
  it('401 / 400 / 404', async () => {
    expect((await request(app).get('/api/wards/1')).status).toBe(401);
    const bad = await request(app).get('/api/wards/abc').set('Authorization', citizen);
    expect(bad.status).toBe(400);
    expect(bad.body.error).toBe('Invalid ward id');
    svc.getWardById.mockResolvedValue(null);
    expect((await request(app).get('/api/wards/1').set('Authorization', citizen)).status).toBe(404);
  });
  it('200', async () => {
    svc.getWardById.mockResolvedValue({ ward_id: 1 });
    svc.getWardOfficers.mockResolvedValue([{ officer_id: 2 }]);
    const res = await request(app).get('/api/wards/1').set('Authorization', citizen);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, ward: { ward_id: 1 }, officers: [{ officer_id: 2 }] });
    expect(svc.getWardOfficers).toHaveBeenCalledWith(1);
  });
});

describe('POST /', () => {
  const body = { name: 'W', city: 'C', state: 'S', boundaries_geojson: { type: 'Polygon' }, junk: 1 };
  it('401 / 403', async () => {
    expect((await request(app).post('/api/wards').send(body)).status).toBe(401);
    expect((await request(app).post('/api/wards').set('Authorization', citizen).send(body)).status).toBe(403);
  });
  it('400 on missing fields', async () => {
    expect((await request(app).post('/api/wards').set('Authorization', admin).send({ name: 'W' })).status).toBe(400);
    expect((await request(app).post('/api/wards').set('Authorization', admin)).status).toBe(400);
  });
  it('201 passes only known fields', async () => {
    svc.createWard.mockResolvedValue({ ward_id: 1 });
    const res = await request(app).post('/api/wards').set('Authorization', admin).send(body);
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ success: true, message: 'Ward created successfully', ward: { ward_id: 1 } });
    expect(svc.createWard).toHaveBeenCalledWith({ name: 'W', city: 'C', state: 'S', boundaries_geojson: { type: 'Polygon' } });
  });
  it('409 from service', async () => {
    svc.createWard.mockRejectedValue(AppError.conflict('dup'));
    expect((await request(app).post('/api/wards').set('Authorization', admin).send(body)).status).toBe(409);
  });
});

describe('PUT /:id', () => {
  it('401 / 403', async () => {
    expect((await request(app).put('/api/wards/1').send({})).status).toBe(401);
    expect((await request(app).put('/api/wards/1').set('Authorization', citizen).send({})).status).toBe(403);
  });
  it('200', async () => {
    svc.updateWard.mockResolvedValue({ ward_id: 1 });
    const res = await request(app).put('/api/wards/1').set('Authorization', admin).send({ name: 'X' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, message: 'Ward updated successfully', ward: { ward_id: 1 } });
    expect(svc.updateWard).toHaveBeenCalledWith('1', { name: 'X' });
  });
  it('404 from service', async () => {
    svc.updateWard.mockRejectedValue(AppError.notFound('nf'));
    expect((await request(app).put('/api/wards/1').set('Authorization', admin).send({})).status).toBe(404);
  });
});

describe('GET /:id/officers', () => {
  it('401 / 400', async () => {
    expect((await request(app).get('/api/wards/1/officers')).status).toBe(401);
    expect((await request(app).get('/api/wards/x/officers').set('Authorization', citizen)).status).toBe(400);
  });
  it('200', async () => {
    svc.getWardOfficers.mockResolvedValue([{ a: 1 }, { a: 2 }]);
    const res = await request(app).get('/api/wards/4/officers').set('Authorization', citizen);
    expect(res.body).toEqual({ success: true, data: [{ a: 1 }, { a: 2 }], count: 2 });
    expect(svc.getWardOfficers).toHaveBeenCalledWith(4);
  });
});

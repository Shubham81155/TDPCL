jest.mock('../../../src/services/assignmentService', () => ({
  autoAssignComplaint: jest.fn(), manualAssign: jest.fn(), findNearestOfficers: jest.fn(),
  getOfficerWorkload: jest.fn(), balanceWorkload: jest.fn(),
}));
jest.mock('../../../src/services/wardService', () => ({ getWardByCoordinates: jest.fn() }));
jest.mock('../../../src/services/officerService', () => ({ assertOfficerAccess: jest.fn() }));

const request = require('supertest');
const { buildApp, tokenFor } = require('./helpers');
const assignment = require('../../../src/services/assignmentService');
const wardService = require('../../../src/services/wardService');
const officerService = require('../../../src/services/officerService');
const AppError = require('../../../src/utils/AppError');
const router = require('../../../src/routes/assignments');

const app = buildApp('/api/assignments', router);
const citizen = tokenFor('citizen', 7);
const officer = tokenFor('officer', 8);
const admin = tokenFor('admin', 9);

beforeEach(() => jest.resetAllMocks());

describe('POST /auto-assign/:complaintId', () => {
  const url = '/api/assignments/auto-assign/5';
  it('401 / 403', async () => {
    expect((await request(app).post(url)).status).toBe(401);
    expect((await request(app).post(url).set('Authorization', citizen)).status).toBe(403);
  });
  it('400 invalid id', async () => {
    expect((await request(app).post('/api/assignments/auto-assign/abc').set('Authorization', admin)).status).toBe(400);
  });
  it('200 for admin and officer', async () => {
    assignment.autoAssignComplaint.mockResolvedValue({ officer_id: 1 });
    for (const t of [admin, officer]) {
      const res = await request(app).post(url).set('Authorization', t);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ success: true, message: 'Complaint auto-assigned successfully', assignment: { officer_id: 1 } });
    }
    expect(assignment.autoAssignComplaint).toHaveBeenCalledWith(5);
  });
  it('404 / 409 propagate', async () => {
    assignment.autoAssignComplaint.mockRejectedValueOnce(AppError.notFound('nf'));
    expect((await request(app).post(url).set('Authorization', admin)).status).toBe(404);
    assignment.autoAssignComplaint.mockRejectedValueOnce(AppError.conflict('c'));
    expect((await request(app).post(url).set('Authorization', admin)).status).toBe(409);
  });
});

describe('POST /assign/:complaintId', () => {
  const url = '/api/assignments/assign/5';
  it('401 / 403', async () => {
    expect((await request(app).post(url).send({})).status).toBe(401);
    expect((await request(app).post(url).set('Authorization', officer).send({})).status).toBe(403);
  });
  it('400 invalid complaint id, missing officer_id, invalid officer_id', async () => {
    expect((await request(app).post('/api/assignments/assign/x').set('Authorization', admin).send({ officer_id: 1 })).status).toBe(400);
    const missing = await request(app).post(url).set('Authorization', admin).send({});
    expect(missing.status).toBe(400);
    expect(missing.body.error).toBe('officer_id is required');
    const bad = await request(app).post(url).set('Authorization', admin).send({ officer_id: 'abc' });
    expect(bad.status).toBe(400);
    expect(bad.body.error).toBe('Invalid officer_id');
  });
  it('200', async () => {
    assignment.manualAssign.mockResolvedValue({ ok: 1 });
    const res = await request(app).post(url).set('Authorization', admin).send({ officer_id: '3' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, message: 'Complaint assigned to officer', assignment: { ok: 1 } });
    expect(assignment.manualAssign).toHaveBeenCalledWith(5, 3, 9);
  });
  it('404 from service', async () => {
    assignment.manualAssign.mockRejectedValue(AppError.notFound('nf'));
    expect((await request(app).post(url).set('Authorization', admin).send({ officer_id: 3 })).status).toBe(404);
  });
});

describe('POST /nearest-officers', () => {
  const url = '/api/assignments/nearest-officers';
  const post = (body) => request(app).post(url).set('Authorization', citizen).send(body);
  it('401', async () => {
    expect((await request(app).post(url).send({})).status).toBe(401);
  });
  it('400 missing / out-of-range / non-numeric coordinates', async () => {
    expect((await post({})).status).toBe(400);
    expect((await post({ latitude: 91, longitude: 10 })).status).toBe(400);
    expect((await post({ latitude: 10, longitude: 181 })).status).toBe(400);
    expect((await post({ latitude: 'abc', longitude: 10 })).status).toBe(400);
    expect((await post({ latitude: 10, longitude: -181 })).status).toBe(400);
    expect((await post({ latitude: -91, longitude: 10 })).status).toBe(400);
    const res = await post({ latitude: 91, longitude: 10 });
    expect(res.body.error).toBe('Invalid coordinates');
  });
  it('400 invalid ward_id', async () => {
    expect((await post({ latitude: 10, longitude: 10, ward_id: 'x' })).status).toBe(400);
  });
  it('200 with defaults (limit 5, ward null)', async () => {
    assignment.findNearestOfficers.mockResolvedValue([{ id: 1 }]);
    const res = await post({ latitude: '19.5', longitude: '72.5' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: [{ id: 1 }], count: 1 });
    expect(assignment.findNearestOfficers).toHaveBeenCalledWith(19.5, 72.5, null, 5);
  });
  it('200 with ward and limit clamping', async () => {
    assignment.findNearestOfficers.mockResolvedValue([]);
    await post({ latitude: 1, longitude: 2, ward_id: 4, limit: 1000 });
    expect(assignment.findNearestOfficers).toHaveBeenLastCalledWith(1, 2, 4, 100);
    await post({ latitude: 1, longitude: 2, ward_id: '', limit: 0 });
    expect(assignment.findNearestOfficers).toHaveBeenLastCalledWith(1, 2, null, 1);
    await post({ latitude: 1, longitude: 2, ward_id: null });
    expect(assignment.findNearestOfficers).toHaveBeenLastCalledWith(1, 2, null, 5);
  });
});

describe('GET /workload/:officerId', () => {
  const url = '/api/assignments/workload/3';
  it('401 / 403 / 400', async () => {
    expect((await request(app).get(url)).status).toBe(401);
    expect((await request(app).get(url).set('Authorization', citizen)).status).toBe(403);
    expect((await request(app).get('/api/assignments/workload/x').set('Authorization', admin)).status).toBe(400);
  });
  it('200', async () => {
    officerService.assertOfficerAccess.mockResolvedValue();
    assignment.getOfficerWorkload.mockResolvedValue({ open: 2 });
    const res = await request(app).get(url).set('Authorization', officer);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, workload: { open: 2 } });
    expect(officerService.assertOfficerAccess).toHaveBeenCalledWith(3, expect.objectContaining({ user_id: 8, role: 'officer' }));
  });
  it('403 from access check', async () => {
    officerService.assertOfficerAccess.mockRejectedValue(AppError.forbidden('no'));
    expect((await request(app).get(url).set('Authorization', officer)).status).toBe(403);
    expect(assignment.getOfficerWorkload).not.toHaveBeenCalled();
  });
});

describe('POST /balance/:wardId', () => {
  const url = '/api/assignments/balance/2';
  it('401 / 403 / 400', async () => {
    expect((await request(app).post(url)).status).toBe(401);
    expect((await request(app).post(url).set('Authorization', officer)).status).toBe(403);
    expect((await request(app).post('/api/assignments/balance/x').set('Authorization', admin)).status).toBe(400);
  });
  it('200 spreads result', async () => {
    assignment.balanceWorkload.mockResolvedValue({ moved: 3 });
    const res = await request(app).post(url).set('Authorization', admin);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, moved: 3 });
    expect(assignment.balanceWorkload).toHaveBeenCalledWith(2);
  });
  it('404 from service', async () => {
    assignment.balanceWorkload.mockRejectedValue(AppError.notFound('nf'));
    expect((await request(app).post(url).set('Authorization', admin)).status).toBe(404);
  });
});

describe('POST /ward-by-location', () => {
  const url = '/api/assignments/ward-by-location';
  it('401', async () => {
    expect((await request(app).post(url).send({})).status).toBe(401);
  });
  it('400 bad coordinates', async () => {
    expect((await request(app).post(url).set('Authorization', citizen).send({ latitude: 1 })).status).toBe(400);
    expect((await request(app).post(url).set('Authorization', citizen).send({ latitude: 100, longitude: 1 })).status).toBe(400);
  });
  it('404 when no ward', async () => {
    wardService.getWardByCoordinates.mockResolvedValue(null);
    const res = await request(app).post(url).set('Authorization', citizen).send({ latitude: 1, longitude: 2 });
    expect(res.status).toBe(404);
    expect(res.body.error).toBe('No ward found for this location');
  });
  it('200', async () => {
    wardService.getWardByCoordinates.mockResolvedValue({ ward_id: 1 });
    const res = await request(app).post(url).set('Authorization', citizen).send({ latitude: 1.5, longitude: 2.5 });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, ward: { ward_id: 1 } });
    expect(wardService.getWardByCoordinates).toHaveBeenCalledWith(1.5, 2.5);
  });
});

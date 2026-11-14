jest.mock('../../../src/services/complaintService', () => ({
  getAllComplaints: jest.fn(), countAllComplaints: jest.fn(),
}));
jest.mock('../../../src/services/adminService', () => ({
  getComplaintStats: jest.fn(), getStatsByCategory: jest.fn(), getStatsByWard: jest.fn(),
  getOfficerPerformance: jest.fn(), getHeatmapData: jest.fn(), getAuditLogs: jest.fn(), exportComplaintsCsv: jest.fn(),
}));

const request = require('supertest');
const { buildApp, tokenFor } = require('./helpers');
const complaintService = require('../../../src/services/complaintService');
const adminService = require('../../../src/services/adminService');
const AppError = require('../../../src/utils/AppError');
const router = require('../../../src/routes/admin');

const app = buildApp('/api/admin', router);
const citizen = tokenFor('citizen', 7);
const officer = tokenFor('officer', 8);
const admin = tokenFor('admin', 9);

beforeEach(() => jest.resetAllMocks());

describe('auth on every admin endpoint', () => {
  const endpoints = [
    ['get', '/stats/complaints'], ['get', '/stats/by-category'], ['get', '/stats/by-ward'],
    ['get', '/stats/officer-performance'], ['get', '/complaints'], ['post', '/heatmap'],
    ['get', '/audit-logs'], ['get', '/report/export'],
  ];
  test.each(endpoints)('%s %s -> 401 without token, 403 for citizen/officer', async (method, path) => {
    const url = `/api/admin${path}`;
    expect((await request(app)[method](url)).status).toBe(401);
    expect((await request(app)[method](url).set('Authorization', citizen)).status).toBe(403);
    expect((await request(app)[method](url).set('Authorization', officer)).status).toBe(403);
  });
});

describe('stats endpoints', () => {
  it('GET /stats/complaints', async () => {
    adminService.getComplaintStats.mockResolvedValue({ total: 1 });
    const res = await request(app).get('/api/admin/stats/complaints').set('Authorization', admin);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, stats: { total: 1 } });
  });
  it('GET /stats/by-category', async () => {
    adminService.getStatsByCategory.mockResolvedValue([{ c: 1 }]);
    const res = await request(app).get('/api/admin/stats/by-category').set('Authorization', admin);
    expect(res.body).toEqual({ success: true, data: [{ c: 1 }] });
  });
  it('GET /stats/by-ward', async () => {
    adminService.getStatsByWard.mockResolvedValue([{ w: 1 }]);
    const res = await request(app).get('/api/admin/stats/by-ward').set('Authorization', admin);
    expect(res.body).toEqual({ success: true, data: [{ w: 1 }] });
  });
  it('GET /stats/officer-performance parses limit', async () => {
    adminService.getOfficerPerformance.mockResolvedValue([]);
    await request(app).get('/api/admin/stats/officer-performance').set('Authorization', admin);
    expect(adminService.getOfficerPerformance).toHaveBeenLastCalledWith(10);
    await request(app).get('/api/admin/stats/officer-performance?limit=5000').set('Authorization', admin);
    expect(adminService.getOfficerPerformance).toHaveBeenLastCalledWith(100);
    await request(app).get('/api/admin/stats/officer-performance?limit=3').set('Authorization', admin);
    expect(adminService.getOfficerPerformance).toHaveBeenLastCalledWith(3);
  });
  it('500 for unexpected service error', async () => {
    adminService.getComplaintStats.mockRejectedValue(new Error('boom'));
    const res = await request(app).get('/api/admin/stats/complaints').set('Authorization', admin);
    expect(res.status).toBe(500);
  });
});

describe('GET /complaints', () => {
  it('200 with parsed filters', async () => {
    complaintService.getAllComplaints.mockResolvedValue([{ id: 1 }]);
    complaintService.countAllComplaints.mockResolvedValue(9);
    const res = await request(app)
      .get('/api/admin/complaints?status=open&category=c&ward_id=4&dateFrom=2024-01-01&dateTo=2024-03-01&limit=50&offset=5')
      .set('Authorization', admin);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: [{ id: 1 }], count: 1, total: 9 });
    const filters = complaintService.getAllComplaints.mock.calls[0][0];
    expect(filters).toEqual({
      status: 'open', category: 'c', ward_id: 4,
      dateFrom: new Date('2024-01-01'), dateTo: new Date('2024-03-01'), limit: 50, offset: 5,
    });
    expect(complaintService.countAllComplaints).toHaveBeenCalledWith(filters);
  });
  it('defaults and clamping (limit 1000 max)', async () => {
    complaintService.getAllComplaints.mockResolvedValue([]);
    complaintService.countAllComplaints.mockResolvedValue(0);
    await request(app).get('/api/admin/complaints').set('Authorization', admin);
    expect(complaintService.getAllComplaints.mock.calls[0][0]).toMatchObject({ limit: 1000, offset: 0, ward_id: null, dateFrom: null, dateTo: null });
    await request(app).get('/api/admin/complaints?limit=99999&offset=-1&ward_id=zz').set('Authorization', admin);
    expect(complaintService.getAllComplaints.mock.calls[1][0]).toMatchObject({ limit: 1000, offset: 0, ward_id: null });
  });
  it('400 for invalid dates', async () => {
    const res = await request(app).get('/api/admin/complaints?dateTo=nope').set('Authorization', admin);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid dateTo');
    expect((await request(app).get('/api/admin/complaints?dateFrom=nope').set('Authorization', admin)).status).toBe(400);
  });
});

describe('POST /heatmap', () => {
  it('200', async () => {
    adminService.getHeatmapData.mockResolvedValue([{ lat: 1 }]);
    const res = await request(app).post('/api/admin/heatmap').set('Authorization', admin);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: [{ lat: 1 }] });
  });
});

describe('GET /audit-logs', () => {
  it('200 with pagination', async () => {
    adminService.getAuditLogs.mockResolvedValue([{ a: 1 }]);
    const res = await request(app).get('/api/admin/audit-logs?limit=500&offset=20').set('Authorization', admin);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: [{ a: 1 }], count: 1 });
    expect(adminService.getAuditLogs).toHaveBeenCalledWith({ limit: 100, offset: 20 });
    await request(app).get('/api/admin/audit-logs').set('Authorization', admin);
    expect(adminService.getAuditLogs).toHaveBeenLastCalledWith({ limit: 100, offset: 0 });
  });
});

describe('GET /report/export', () => {
  it('200 CSV with headers; query is passed through', async () => {
    adminService.exportComplaintsCsv.mockResolvedValue('a,b\n1,2\n');
    const res = await request(app).get('/api/admin/report/export?status=open').set('Authorization', admin);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toBe('attachment; filename="complaints-report.csv"');
    expect(res.text).toBe('a,b\n1,2\n');
    expect(adminService.exportComplaintsCsv).toHaveBeenCalledWith({ status: 'open' });
  });
  it('AppError goes through the central handler with its status', async () => {
    adminService.exportComplaintsCsv.mockRejectedValue(AppError.badRequest('bad filter'));
    const res = await request(app).get('/api/admin/report/export').set('Authorization', admin);
    expect(res.status).toBe(400);
    expect(res.body).toMatchObject({ success: false, error: 'bad filter' });
    adminService.exportComplaintsCsv.mockRejectedValue(AppError.notFound('nf'));
    expect((await request(app).get('/api/admin/report/export').set('Authorization', admin)).status).toBe(404);
  });
  it('non-AppError keeps legacy 400 JSON', async () => {
    adminService.exportComplaintsCsv.mockRejectedValue(new Error('weird'));
    const res = await request(app).get('/api/admin/report/export').set('Authorization', admin);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, error: 'weird' });
  });
});

jest.mock('../../../src/services/complaintService', () => ({ getAllComplaints: jest.fn(), countAllComplaints: jest.fn() }));
jest.mock('../../../src/services/adminService', () => ({
  getComplaintStats: jest.fn(), getStatsByCategory: jest.fn(), getStatsByWard: jest.fn(),
  getOfficerPerformance: jest.fn(), getHeatmapData: jest.fn(), getAuditLogs: jest.fn(), exportComplaintsCsv: jest.fn(),
}));

const request = require('supertest');
const { buildApp, tokenFor } = require('./helpers');
const adminService = require('../../../src/services/adminService');
const router = require('../../../src/routes/admin');

const app = buildApp('/api/admin', router);
const admin = tokenFor('admin', 9);
const get = (url) => request(app).get(url).set('Authorization', admin);

beforeEach(() => {
  jest.resetAllMocks();
  Object.values(adminService).forEach((f) => f.mockResolvedValue([]));
});

describe('stats date filters', () => {
  const endpoints = [
    ['/stats/complaints', 'getComplaintStats'],
    ['/stats/by-category', 'getStatsByCategory'],
    ['/stats/by-ward', 'getStatsByWard'],
    ['/stats/officer-performance', 'getOfficerPerformance'],
  ];
  const filtersArg = (fn) => adminService[fn].mock.calls[0].slice(-1)[0];

  test.each(endpoints)('%s passes parsed dateFrom/dateTo', async (path, fn) => {
    const res = await get(`/api/admin${path}?dateFrom=2024-01-01&dateTo=2024-01-31`);
    expect(res.status).toBe(200);
    expect(filtersArg(fn)).toEqual({ dateFrom: new Date('2024-01-01'), dateTo: new Date('2024-01-31') });
  });
  test.each(endpoints)('%s without params passes null dates', async (path, fn) => {
    expect((await get(`/api/admin${path}`)).status).toBe(200);
    expect(filtersArg(fn)).toEqual({ dateFrom: null, dateTo: null });
  });
  test.each(endpoints)('%s 400 for invalid dates and reversed range', async (path, fn) => {
    let res = await get(`/api/admin${path}?dateFrom=nope`);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid dateFrom');
    res = await get(`/api/admin${path}?dateTo=nope`);
    expect(res.body.error).toBe('Invalid dateTo');
    res = await get(`/api/admin${path}?dateFrom=2024-02-01&dateTo=2024-01-01`);
    expect(res.status).toBe(400);
    expect(adminService[fn]).not.toHaveBeenCalled();
  });
  it('same-day range is allowed', async () => {
    expect((await get('/api/admin/stats/by-ward?dateFrom=2024-01-05&dateTo=2024-01-05')).status).toBe(200);
  });
});

describe('GET /heatmap', () => {
  it('passes all filters to the service', async () => {
    adminService.getHeatmapData.mockResolvedValue([{ latitude: 1 }]);
    const res = await get('/api/admin/heatmap?dateFrom=2024-01-01&dateTo=2024-02-01&status=resolved&category=litter');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: [{ latitude: 1 }] });
    expect(adminService.getHeatmapData).toHaveBeenCalledWith({
      dateFrom: new Date('2024-01-01'), dateTo: new Date('2024-02-01'), status: 'resolved', category: 'litter',
    });
  });
  it('no params -> null filters', async () => {
    await get('/api/admin/heatmap');
    expect(adminService.getHeatmapData).toHaveBeenCalledWith({ dateFrom: null, dateTo: null, status: null, category: null });
  });
  it('400 for invalid status, blank category, bad dates', async () => {
    expect((await get('/api/admin/heatmap?status=bogus')).body.error).toBe('Invalid status');
    expect((await get('/api/admin/heatmap?category=%20%20')).status).toBe(400);
    expect((await get('/api/admin/heatmap?dateFrom=x')).status).toBe(400);
    expect((await get('/api/admin/heatmap?dateFrom=2024-03-01&dateTo=2024-01-01')).status).toBe(400);
    expect(adminService.getHeatmapData).not.toHaveBeenCalled();
  });
  it('legacy POST still works with no filters', async () => {
    adminService.getHeatmapData.mockResolvedValue([{ a: 1 }]);
    const res = await request(app).post('/api/admin/heatmap').set('Authorization', admin);
    expect(res.status).toBe(200);
    expect(adminService.getHeatmapData).toHaveBeenCalledWith();
  });
});

jest.mock('../../../src/services/complaintService', () => ({
  getComplaintsByUser: jest.fn(), countComplaintsByUser: jest.fn(), getAssignedComplaintsForUser: jest.fn(),
  getAuthorizedComplaint: jest.fn(), getComplaintHistory: jest.fn(), updateStatusByOfficer: jest.fn(),
  resolveComplaintForUser: jest.fn(),
}));
jest.mock('../../../src/services/complaintSubmissionService', () => ({ submitComplaint: jest.fn() }));
jest.mock('../../../src/utils/s3Upload', () => ({ uploadToS3: jest.fn() }));

const request = require('supertest');
const { buildApp, tokenFor } = require('./helpers');
const svc = require('../../../src/services/complaintService');
const { submitComplaint } = require('../../../src/services/complaintSubmissionService');
const AppError = require('../../../src/utils/AppError');
const router = require('../../../src/routes/complaints');

const app = buildApp('/api/complaints', router);
const citizen = tokenFor('citizen', 7);
const officer = tokenFor('officer', 8);
const admin = tokenFor('admin', 9);

beforeEach(() => jest.resetAllMocks());

describe('POST /', () => {
  it('401 without token', async () => {
    expect((await request(app).post('/api/complaints')).status).toBe(401);
  });
  it('403 for non-citizen', async () => {
    expect((await request(app).post('/api/complaints').set('Authorization', officer)).status).toBe(403);
  });
  it('201 with multipart image', async () => {
    submitComplaint.mockResolvedValue({ complaint_id: 1 });
    const res = await request(app).post('/api/complaints').set('Authorization', citizen)
      .field('latitude', '19.07').field('longitude', '72.87')
      .attach('image', Buffer.from('fakepng'), { filename: 'a.png', contentType: 'image/png' });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ success: true, message: 'Complaint submitted successfully', complaint: { complaint_id: 1 } });
    const arg = submitComplaint.mock.calls[0][0];
    expect(arg.user.user_id).toBe(7);
    expect(arg.body).toMatchObject({ latitude: '19.07', longitude: '72.87' });
    expect(arg.file.originalname).toBe('a.png');
    expect(arg.file.buffer.toString()).toBe('fakepng');
  });
  it('rejects non-image uploads without calling the service', async () => {
    const res = await request(app).post('/api/complaints').set('Authorization', citizen)
      .attach('image', Buffer.from('x'), { filename: 'a.txt', contentType: 'text/plain' });
    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(submitComplaint).not.toHaveBeenCalled();
  });
  it('propagates AppError status from the service', async () => {
    submitComplaint.mockRejectedValue(AppError.badRequest('Image required'));
    const res = await request(app).post('/api/complaints').set('Authorization', citizen).send({});
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Image required');
  });
});

describe('GET /', () => {
  it('401 / 403', async () => {
    expect((await request(app).get('/api/complaints')).status).toBe(401);
    expect((await request(app).get('/api/complaints').set('Authorization', admin)).status).toBe(403);
  });
  it('200 with filters and pagination clamping', async () => {
    svc.getComplaintsByUser.mockResolvedValue([{ id: 1 }, { id: 2 }]);
    svc.countComplaintsByUser.mockResolvedValue(42);
    const res = await request(app)
      .get('/api/complaints?status=pending&category=x&dateFrom=2024-01-01&dateTo=2024-02-01&limit=9999&offset=-5')
      .set('Authorization', citizen);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: [{ id: 1 }, { id: 2 }], count: 2, total: 42 });
    const [uid, filters] = svc.getComplaintsByUser.mock.calls[0];
    expect(uid).toBe(7);
    expect(filters).toMatchObject({ status: 'pending', category: 'x', limit: 100, offset: 0 });
    expect(filters.dateFrom).toEqual(new Date('2024-01-01'));
    expect(filters.dateTo).toEqual(new Date('2024-02-01'));
    expect(svc.countComplaintsByUser).toHaveBeenCalledWith(7, filters);
  });
  it('default pagination', async () => {
    svc.getComplaintsByUser.mockResolvedValue([]);
    svc.countComplaintsByUser.mockResolvedValue(0);
    await request(app).get('/api/complaints?limit=abc&offset=30').set('Authorization', citizen);
    expect(svc.getComplaintsByUser.mock.calls[0][1]).toMatchObject({ limit: 20, offset: 30, dateFrom: null, dateTo: null });
  });
  it('400 for invalid date', async () => {
    const res = await request(app).get('/api/complaints?dateFrom=notadate').set('Authorization', citizen);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid dateFrom');
  });
});

describe('GET /officer/assigned', () => {
  it('401 / 403', async () => {
    expect((await request(app).get('/api/complaints/officer/assigned')).status).toBe(401);
    expect((await request(app).get('/api/complaints/officer/assigned').set('Authorization', citizen)).status).toBe(403);
  });
  it('200', async () => {
    svc.getAssignedComplaintsForUser.mockResolvedValue([{ id: 1 }]);
    const res = await request(app).get('/api/complaints/officer/assigned?status=open&limit=0&offset=4').set('Authorization', officer);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: [{ id: 1 }], count: 1 });
    expect(svc.getAssignedComplaintsForUser).toHaveBeenCalledWith(8, { status: 'open', limit: 1, offset: 4 });
  });
});

describe('GET /:id', () => {
  it('401', async () => {
    expect((await request(app).get('/api/complaints/5')).status).toBe(401);
  });
  it('200 passes user to authorization check', async () => {
    svc.getAuthorizedComplaint.mockResolvedValue({ complaint_id: 5 });
    const res = await request(app).get('/api/complaints/5').set('Authorization', citizen);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, complaint: { complaint_id: 5 } });
    expect(svc.getAuthorizedComplaint).toHaveBeenCalledWith(5, expect.objectContaining({ user_id: 7, role: 'citizen' }), 'Not authorized to view this complaint');
  });
  it('400 for id 0', async () => {
    const res = await request(app).get('/api/complaints/0').set('Authorization', citizen);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Invalid complaint id');
  });
  it('404 for non-numeric id (route does not match)', async () => {
    expect((await request(app).get('/api/complaints/abc').set('Authorization', citizen)).status).toBe(404);
  });
  it('propagates 404 and 403 from the service', async () => {
    svc.getAuthorizedComplaint.mockRejectedValueOnce(AppError.notFound('Complaint not found'));
    expect((await request(app).get('/api/complaints/5').set('Authorization', citizen)).status).toBe(404);
    svc.getAuthorizedComplaint.mockRejectedValueOnce(AppError.forbidden('no'));
    expect((await request(app).get('/api/complaints/5').set('Authorization', citizen)).status).toBe(403);
  });
});

describe('GET /:id/timeline', () => {
  it('401', async () => {
    expect((await request(app).get('/api/complaints/5/timeline')).status).toBe(401);
  });
  it('200', async () => {
    svc.getAuthorizedComplaint.mockResolvedValue({});
    svc.getComplaintHistory.mockResolvedValue([{ h: 1 }]);
    const res = await request(app).get('/api/complaints/5/timeline').set('Authorization', admin);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, timeline: [{ h: 1 }] });
    expect(svc.getComplaintHistory).toHaveBeenCalledWith(5);
  });
  it('400 invalid id', async () => {
    expect((await request(app).get('/api/complaints/0/timeline').set('Authorization', admin)).status).toBe(400);
  });
  it('403 from service skips history', async () => {
    svc.getAuthorizedComplaint.mockRejectedValue(AppError.forbidden('Not authorized'));
    const res = await request(app).get('/api/complaints/5/timeline').set('Authorization', citizen);
    expect(res.status).toBe(403);
    expect(svc.getComplaintHistory).not.toHaveBeenCalled();
  });
});

describe('PATCH /:id/status', () => {
  it('401 / 403', async () => {
    expect((await request(app).patch('/api/complaints/5/status')).status).toBe(401);
    expect((await request(app).patch('/api/complaints/5/status').set('Authorization', citizen)).status).toBe(403);
  });
  it('200', async () => {
    svc.updateStatusByOfficer.mockResolvedValue({ status: 'in_progress' });
    const res = await request(app).patch('/api/complaints/5/status').set('Authorization', officer).send({ status: 'in_progress', comment: 'c' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, message: 'Complaint status updated to in_progress', complaint: { status: 'in_progress' } });
    expect(svc.updateStatusByOfficer).toHaveBeenCalledWith('5', 'in_progress', 8, 'c');
  });
  it('propagates 400/404/409', async () => {
    for (const [err, code] of [[AppError.badRequest('b'), 400], [AppError.notFound('n'), 404], [AppError.conflict('c'), 409]]) {
      svc.updateStatusByOfficer.mockRejectedValueOnce(err);
      const res = await request(app).patch('/api/complaints/5/status').set('Authorization', officer).send({ status: 'x' });
      expect(res.status).toBe(code);
    }
  });
  it('tolerates missing body', async () => {
    svc.updateStatusByOfficer.mockResolvedValue({});
    const res = await request(app).patch('/api/complaints/5/status').set('Authorization', officer);
    expect(res.status).toBe(200);
    expect(svc.updateStatusByOfficer).toHaveBeenCalledWith('5', undefined, 8, undefined);
  });
});

describe('POST /:id/resolve', () => {
  it('401 / 403', async () => {
    expect((await request(app).post('/api/complaints/5/resolve')).status).toBe(401);
    expect((await request(app).post('/api/complaints/5/resolve').set('Authorization', admin)).status).toBe(403);
  });
  it('200', async () => {
    svc.resolveComplaintForUser.mockResolvedValue({ status: 'resolved' });
    const res = await request(app).post('/api/complaints/5/resolve').set('Authorization', officer)
      .send({ resolution_image_path: '/p.png', comments: 'done' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, message: 'Complaint resolved successfully', complaint: { status: 'resolved' } });
    expect(svc.resolveComplaintForUser).toHaveBeenCalledWith('5', '/p.png', 'done', 8);
  });
  it('propagates 404 and handles missing body', async () => {
    svc.resolveComplaintForUser.mockRejectedValue(AppError.notFound('nf'));
    const res = await request(app).post('/api/complaints/5/resolve').set('Authorization', officer);
    expect(res.status).toBe(404);
    expect(svc.resolveComplaintForUser).toHaveBeenCalledWith('5', undefined, undefined, 8);
  });
});

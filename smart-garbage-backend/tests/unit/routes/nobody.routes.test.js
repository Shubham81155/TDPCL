// Routers mounted WITHOUT a body parser: req.body is undefined, exercising the `|| {}` fallbacks.
jest.mock('../../../src/services/complaintService', () => ({
  updateStatusByOfficer: jest.fn().mockResolvedValue({}), resolveComplaintForUser: jest.fn().mockResolvedValue({}),
}));
jest.mock('../../../src/services/complaintSubmissionService', () => ({ submitComplaint: jest.fn() }));
jest.mock('../../../src/utils/s3Upload', () => ({ uploadToS3: jest.fn() }));
jest.mock('../../../src/services/officerService', () => ({
  updateOfficer: jest.fn().mockResolvedValue({}), createOfficer: jest.fn(),
}));
jest.mock('../../../src/services/wardService', () => ({ updateWard: jest.fn().mockResolvedValue({}), createWard: jest.fn() }));
jest.mock('../../../src/services/assignmentService', () => ({ manualAssign: jest.fn(), findNearestOfficers: jest.fn() }));
jest.mock('../../../src/services/authService', () => ({ requestPasswordReset: jest.fn(), changePassword: jest.fn() }));

const request = require('supertest');
const { buildApp, tokenFor } = require('./helpers');

const admin = tokenFor('admin', 9);
const officer = tokenFor('officer', 8);
const mk = (mount, file) => buildApp(mount, require(`../../../src/routes/${file}`), { json: false });

describe('missing body (no parser)', () => {
  it('complaints', async () => {
    const app = mk('/c', 'complaints');
    expect((await request(app).patch('/c/1/status').set('Authorization', officer)).status).toBe(200);
    expect((await request(app).post('/c/1/resolve').set('Authorization', officer)).status).toBe(200);
  });
  it('officers', async () => {
    const app = mk('/o', 'officers');
    expect((await request(app).post('/o').set('Authorization', admin)).status).toBe(400);
    expect((await request(app).put('/o/1').set('Authorization', admin)).status).toBe(200);
    expect((await request(app).post('/o/1/location').set('Authorization', officer)).status).toBe(400);
  });
  it('wards', async () => {
    const app = mk('/w', 'wards');
    expect((await request(app).post('/w').set('Authorization', admin)).status).toBe(400);
    expect((await request(app).put('/w/1').set('Authorization', admin)).status).toBe(200);
  });
  it('assignments', async () => {
    const app = mk('/a', 'assignments');
    expect((await request(app).post('/a/assign/1').set('Authorization', admin)).status).toBe(400);
    expect((await request(app).post('/a/nearest-officers').set('Authorization', admin)).status).toBe(400);
    expect((await request(app).post('/a/ward-by-location').set('Authorization', admin)).status).toBe(400);
  });
  it('auth', async () => {
    const app = mk('/u', 'auth');
    expect((await request(app).post('/u/forgot-password')).status).toBe(200);
    expect((await request(app).post('/u/reset-password')).status).toBe(400);
  });
});

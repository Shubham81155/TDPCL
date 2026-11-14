jest.mock('../../../src/config/database', () => ({ db: { oneOrNone: jest.fn() } }));
jest.mock('../../../src/utils/s3Upload', () => ({ uploadToS3: jest.fn() }));
jest.mock('../../../src/utils/logger', () => ({ warn: jest.fn(), info: jest.fn(), error: jest.fn(), debug: jest.fn() }));
jest.mock('../../../src/services/complaintService', () => ({ createComplaint: jest.fn() }));
jest.mock('../../../src/services/assignmentService', () => ({ autoAssignComplaint: jest.fn() }));
jest.mock('../../../src/services/wardService', () => ({ getWardByCoordinates: jest.fn() }));
jest.mock('../../../src/services/notificationService', () => ({
  sendComplaintSubmittedEmail: jest.fn(),
  sendComplaintAssignedEmail: jest.fn(),
  sendComplaintSubmittedToAdminEmail: jest.fn(),
}));

const { db } = require('../../../src/config/database');
const { uploadToS3 } = require('../../../src/utils/s3Upload');
const logger = require('../../../src/utils/logger');
const complaintService = require('../../../src/services/complaintService');
const assignmentService = require('../../../src/services/assignmentService');
const wardService = require('../../../src/services/wardService');
const notify = require('../../../src/services/notificationService');
const svc = require('../../../src/services/complaintSubmissionService');

const file = { buffer: Buffer.from('x'), originalname: 'a.jpg' };
const body = (o = {}) => ({ latitude: '12.5', longitude: '77.5', category: 'plastics', ...o });
const flush = () => new Promise((r) => setImmediate(r));

describe('validateSubmission', () => {
  const v = (b, f = file) => () => svc.validateSubmission(b, f);

  it('requires lat/lng', () => {
    expect(v(body({ latitude: '' }))).toThrow(/Missing required/);
    expect(v(body({ longitude: undefined }))).toThrow(/Missing required/);
    expect(() => svc.validateSubmission(undefined, file)).toThrow(/Missing required/);
  });
  it('requires image', () => {
    expect(v(body(), null)).toThrow('Image file is required');
  });
  it('requires valid category', () => {
    expect(v(body({ category: undefined }))).toThrow(/valid complaint category/);
    expect(v(body({ category: 'nonsense' }))).toThrow(/valid complaint category/);
    expect(svc.MANUAL_CATEGORIES.has('plastics')).toBe(true);
  });
  it('latitude range / non-numeric', () => {
    expect(v(body({ latitude: '91' }))).toThrow(/Latitude/);
    expect(v(body({ latitude: '-91' }))).toThrow(/Latitude/);
    expect(v(body({ latitude: 'abc' }))).toThrow(/Latitude/);
  });
  it('longitude range / non-numeric', () => {
    expect(v(body({ longitude: '181' }))).toThrow(/Longitude/);
    expect(v(body({ longitude: 'zz' }))).toThrow(/Longitude/);
  });
  it('title/description length limits', () => {
    expect(v(body({ title: 'x'.repeat(121) }))).toThrow(/120/);
    expect(v(body({ description: 'x'.repeat(1001) }))).toThrow(/1000/);
    expect(() => svc.validateSubmission(body({ title: 'x'.repeat(120), description: 'y'.repeat(1000) }), file)).not.toThrow();
  });
  it('urgency validation and normalisation', () => {
    expect(v(body({ urgency_level: 'critical' }))).toThrow(/Urgency/);
    expect(svc.validateSubmission(body({ urgency_level: ' HIGH ' }), file).urgencyLevel).toBe('high');
    expect(svc.validateSubmission(body(), file).urgencyLevel).toBe('medium');
  });
  it('defaults and trims title/description; ignores non-string', () => {
    const r = svc.validateSubmission(body({ title: '  T  ', description: 5 }), file);
    expect(r).toMatchObject({
      latNum: 12.5, lngNum: 77.5, category: 'plastics', title: 'T', description: 'No description provided',
    });
    expect(svc.validateSubmission(body(), file).title).toBe('Garbage Issue Report');
  });
});

describe('submitComplaint', () => {
  const user = { user_id: 3 };
  const complaint = { complaint_id: 11, user_id: 3 };

  beforeEach(() => {
    jest.clearAllMocks();
    uploadToS3.mockResolvedValue({ url: 'http://img' });
    wardService.getWardByCoordinates.mockResolvedValue({ ward_id: 2, name: 'W2' });
    complaintService.createComplaint.mockResolvedValue(complaint);
    db.oneOrNone.mockResolvedValue({ name: 'Cit', email: 'c@x' });
    ['sendComplaintSubmittedEmail', 'sendComplaintAssignedEmail', 'sendComplaintSubmittedToAdminEmail']
      .forEach((k) => notify[k].mockResolvedValue());
  });

  it('rejects invalid input before any side effect', async () => {
    await expect(svc.submitComplaint({ user, body: body({ category: 'x' }), file })).rejects.toMatchObject({ status: 400 });
    expect(uploadToS3).not.toHaveBeenCalled();
  });

  it('happy path: creates with ward, returns assignment, sends all emails', async () => {
    const assignment = { complaint_id: 11, status: 'assigned', officer: { email: 'o@x', name: 'O' } };
    assignmentService.autoAssignComplaint.mockResolvedValue(assignment);
    const r = await svc.submitComplaint({ user, body: body({ title: 'T' }), file });
    expect(r).toBe(assignment);
    expect(uploadToS3).toHaveBeenCalledWith(file.buffer, 'a.jpg', 'complaints');
    expect(wardService.getWardByCoordinates).toHaveBeenCalledWith(12.5, 77.5);
    expect(complaintService.createComplaint).toHaveBeenCalledWith(expect.objectContaining({
      user_id: 3, image_path: 'http://img', area: 'W2', ward_id: 2, category: 'plastics', urgency_level: 'medium', title: 'T',
    }));
    expect(notify.sendComplaintSubmittedEmail).toHaveBeenCalledWith('c@x', 'Cit', 11);
    expect(notify.sendComplaintAssignedEmail).toHaveBeenCalledWith('o@x', 'O', 11, 'T');
    expect(notify.sendComplaintSubmittedToAdminEmail).toHaveBeenCalledWith(11, 'Cit', 'W2', 'plastics');
  });

  it('auto-assign failure is non-fatal -> { ...complaint, assigned:false }; no officer email', async () => {
    assignmentService.autoAssignComplaint.mockRejectedValue(new Error('no officers'));
    const r = await svc.submitComplaint({ user, body: body(), file });
    expect(r).toEqual({ ...complaint, assigned: false });
    expect(logger.warn).toHaveBeenCalled();
    expect(notify.sendComplaintAssignedEmail).not.toHaveBeenCalled();
    expect(notify.sendComplaintSubmittedEmail).toHaveBeenCalled();
  });

  it('no ward -> Unknown Area / null ward; no citizen -> no citizen email, admin gets undefined name', async () => {
    wardService.getWardByCoordinates.mockResolvedValue(null);
    assignmentService.autoAssignComplaint.mockResolvedValue({ complaint_id: 11, officer: { name: 'O' } });
    db.oneOrNone.mockResolvedValue(null);
    await svc.submitComplaint({ user, body: body(), file });
    expect(complaintService.createComplaint).toHaveBeenCalledWith(expect.objectContaining({ area: 'Unknown Area', ward_id: null }));
    expect(notify.sendComplaintSubmittedEmail).not.toHaveBeenCalled();
    expect(notify.sendComplaintAssignedEmail).not.toHaveBeenCalled(); // officer without email
    expect(notify.sendComplaintSubmittedToAdminEmail).toHaveBeenCalledWith(11, undefined, 'Unknown Area', 'plastics');
  });

  it('email rejections never block or fail the request', async () => {
    assignmentService.autoAssignComplaint.mockResolvedValue({ complaint_id: 11, officer: { email: 'o@x', name: 'O' } });
    notify.sendComplaintSubmittedEmail.mockRejectedValue(new Error('a'));
    notify.sendComplaintAssignedEmail.mockRejectedValue(new Error('b'));
    notify.sendComplaintSubmittedToAdminEmail.mockRejectedValue(new Error('c'));
    await expect(svc.submitComplaint({ user, body: body(), file })).resolves.toBeDefined();
    await flush();
    expect(console.error).toHaveBeenCalledWith('Email error (non-blocking):', 'a');
    expect(console.error).toHaveBeenCalledWith('Admin notification error (non-blocking):', 'c');
  });

  it('synchronous throw in a notifier is swallowed', async () => {
    assignmentService.autoAssignComplaint.mockResolvedValue(null);
    notify.sendComplaintSubmittedEmail.mockImplementation(() => { throw new Error('sync'); });
    const r = await svc.submitComplaint({ user, body: body(), file });
    expect(r).toEqual({ ...complaint, assigned: false });
    expect(console.error).toHaveBeenCalledWith('Email error (non-blocking):', 'sync');
  });

  it('upload and create failures propagate', async () => {
    uploadToS3.mockRejectedValueOnce(new Error('s3'));
    await expect(svc.submitComplaint({ user, body: body(), file })).rejects.toThrow('s3');
    complaintService.createComplaint.mockRejectedValueOnce(new Error('db'));
    await expect(svc.submitComplaint({ user, body: body(), file })).rejects.toThrow('db');
    expect(assignmentService.autoAssignComplaint).not.toHaveBeenCalled();
  });
});

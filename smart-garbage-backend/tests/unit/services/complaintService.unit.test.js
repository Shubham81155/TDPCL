jest.mock('../../../src/config/database', () => {
  const tx = { oneOrNone: jest.fn(), one: jest.fn(), none: jest.fn() };
  return {
    db: {
      oneOrNone: jest.fn(), one: jest.fn(), none: jest.fn(), manyOrNone: jest.fn(), tx: jest.fn(), _tx: tx,
    },
  };
});
jest.mock('../../../src/services/notificationService', () => ({
  sendComplaintStatusUpdateEmail: jest.fn(),
}));

const { db } = require('../../../src/config/database');
const notify = require('../../../src/services/notificationService');
const svc = require('../../../src/services/complaintService');

const flush = () => new Promise((r) => setImmediate(r));

beforeEach(() => {
  ['oneOrNone', 'one', 'none', 'manyOrNone', 'tx'].forEach((k) => db[k].mockReset());
  ['oneOrNone', 'one', 'none'].forEach((k) => db._tx[k].mockReset());
  db.tx.mockImplementation((cb) => cb(db._tx));
  notify.sendComplaintStatusUpdateEmail.mockReset();
});

describe('createComplaint', () => {
  const base = {
    user_id: 1, title: 't', description: 'd', image_path: 'i', latitude: 1, longitude: 2, area: 'a', category: 'paper',
  };
  it('defaults urgency and ward_id', async () => {
    db.one.mockResolvedValue({ complaint_id: 1 });
    await svc.createComplaint(base);
    expect(db.one.mock.calls[0][1]).toEqual([1, 't', 'd', 'i', 1, 2, 'a', 'paper', 'medium', null]);
  });
  it('uses provided ward_id and urgency', async () => {
    db.one.mockResolvedValue({ complaint_id: 1 });
    await svc.createComplaint({ ...base, ward_id: 9, urgency_level: 'high' });
    const p = db.one.mock.calls[0][1];
    expect(p[8]).toBe('high');
    expect(p[9]).toBe(9);
  });
  it('wraps errors', async () => {
    db.one.mockRejectedValue(new Error('x'));
    await expect(svc.createComplaint(base)).rejects.toMatchObject({ status: 500 });
  });
});

describe('simple reads', () => {
  it('getComplaintById and history', async () => {
    db.oneOrNone.mockResolvedValueOnce({ complaint_id: 1 });
    expect(await svc.getComplaintById(1)).toEqual({ complaint_id: 1 });
    db.oneOrNone.mockRejectedValueOnce(new Error('x'));
    await expect(svc.getComplaintById(1)).rejects.toMatchObject({ status: 500 });
    db.manyOrNone.mockResolvedValueOnce([{ history_id: 1 }]);
    expect(await svc.getComplaintHistory(1)).toEqual([{ history_id: 1 }]);
    expect(db.manyOrNone.mock.calls[0][0]).toContain('ORDER BY created_at ASC');
    db.manyOrNone.mockRejectedValueOnce(new Error('x'));
    await expect(svc.getComplaintHistory(1)).rejects.toMatchObject({ status: 500 });
  });
});

describe('filters and param indexing', () => {
  it('getComplaintsByUser with all filters', async () => {
    db.manyOrNone.mockResolvedValue([]);
    await svc.getComplaintsByUser(7, { status: 's', category: 'c', dateFrom: 'f', dateTo: 't', limit: 5, offset: 10 });
    const [sql, params] = db.manyOrNone.mock.calls[0];
    expect(params).toEqual([7, 's', 'c', 'f', 't', 5, 10]);
    expect(sql).toContain('c.user_id = $1 AND c.status = $2 AND c.category = $3 AND c.created_at >= $4 AND c.created_at <= $5');
    expect(sql).toContain('LIMIT $6 OFFSET $7');
  });
  it('getComplaintsByUser defaults and error', async () => {
    db.manyOrNone.mockResolvedValueOnce([]);
    await svc.getComplaintsByUser(7);
    expect(db.manyOrNone.mock.calls[0][1]).toEqual([7, 20, 0]);
    db.manyOrNone.mockRejectedValueOnce(new Error('x'));
    await expect(svc.getComplaintsByUser(7)).rejects.toMatchObject({ status: 500 });
  });
  it('countComplaintsByUser', async () => {
    db.one.mockResolvedValueOnce({ total: '3' });
    expect(await svc.countComplaintsByUser(7, { status: 's' })).toBe(3);
    expect(db.one.mock.calls[0][1]).toEqual([7, 's']);
    db.one.mockResolvedValueOnce({ total: 'x' });
    expect(await svc.countComplaintsByUser(7)).toBe(0);
    db.one.mockRejectedValueOnce(new Error('x'));
    await expect(svc.countComplaintsByUser(7)).rejects.toMatchObject({ status: 500 });
  });
  it('getAllComplaints with every filter incl. ward_id', async () => {
    db.manyOrNone.mockResolvedValue([]);
    await svc.getAllComplaints({ status: 's', category: 'c', ward_id: 3, dateFrom: 'f', dateTo: 't' });
    const [sql, params] = db.manyOrNone.mock.calls[0];
    expect(params).toEqual(['s', 'c', 3, 'f', 't', 100, 0]);
    expect(sql).toContain('c.ward_id = $3');
    expect(sql).toContain('LIMIT $6 OFFSET $7');
  });
  it('getAllComplaints no filters; error', async () => {
    db.manyOrNone.mockResolvedValueOnce([]);
    await svc.getAllComplaints();
    expect(db.manyOrNone.mock.calls[0][1]).toEqual([100, 0]);
    db.manyOrNone.mockRejectedValueOnce(new Error('x'));
    await expect(svc.getAllComplaints()).rejects.toMatchObject({ status: 500 });
  });
  it('countAllComplaints', async () => {
    db.one.mockResolvedValueOnce({ total: '9' });
    expect(await svc.countAllComplaints({ ward_id: 2 })).toBe(9);
    expect(db.one.mock.calls[0][1]).toEqual([2]);
    db.one.mockResolvedValueOnce({ total: '1' });
    expect(await svc.countAllComplaints()).toBe(1);
    db.one.mockRejectedValueOnce(new Error('x'));
    await expect(svc.countAllComplaints()).rejects.toMatchObject({ status: 500 });
  });
  it('getOfficerComplaints with and without status', async () => {
    db.manyOrNone.mockResolvedValue([]);
    await svc.getOfficerComplaints(4, { status: 'assigned', limit: 2, offset: 1 });
    expect(db.manyOrNone.mock.calls[0][1]).toEqual([4, 'assigned', 2, 1]);
    await svc.getOfficerComplaints(4);
    expect(db.manyOrNone.mock.calls[1][1]).toEqual([4, 20, 0]);
    db.manyOrNone.mockRejectedValueOnce(new Error('x'));
    await expect(svc.getOfficerComplaints(4)).rejects.toMatchObject({ status: 500 });
  });
  it('getAssignedComplaintsForUser: 404 or delegates', async () => {
    db.oneOrNone.mockResolvedValueOnce(null);
    await expect(svc.getAssignedComplaintsForUser(1)).rejects.toMatchObject({ status: 404 });
    db.oneOrNone.mockResolvedValueOnce({ officer_id: 4 });
    db.manyOrNone.mockResolvedValueOnce([{ complaint_id: 1 }]);
    expect(await svc.getAssignedComplaintsForUser(1, { status: 'x' })).toEqual([{ complaint_id: 1 }]);
    expect(db.manyOrNone.mock.calls[0][1][0]).toBe(4);
  });
});

describe('updateComplaintStatus', () => {
  it('404 when missing', async () => {
    db._tx.oneOrNone.mockResolvedValue(null);
    await expect(svc.updateComplaintStatus(1, 'resolved', 2)).rejects.toMatchObject({ status: 404 });
  });
  it.each([
    ['assigned', 'assigned_at'], ['in_progress', 'started_at'], ['resolved', 'resolved_at'],
  ])('sets %s timestamp column', async (status, col) => {
    db._tx.oneOrNone.mockResolvedValue({ status: 'new' });
    db._tx.one.mockResolvedValue({ complaint_id: 1, status });
    await svc.updateComplaintStatus(1, status, 2, 'note');
    expect(db._tx.one.mock.calls[0][0]).toContain(`${col} = CURRENT_TIMESTAMP`);
    expect(db._tx.none.mock.calls[0][1]).toEqual([1, 'new', status, 2, 'note']);
  });
  it('no extra timestamp for other statuses; null comment', async () => {
    db._tx.oneOrNone.mockResolvedValue({ status: 'new' });
    db._tx.one.mockResolvedValue({});
    await svc.updateComplaintStatus(1, 'rejected', 2);
    expect(db._tx.one.mock.calls[0][0]).not.toMatch(/(assigned|started|resolved)_at = CURRENT/);
    expect(db._tx.none.mock.calls[0][1][4]).toBeNull();
  });
  it('wraps errors', async () => {
    db.tx.mockRejectedValueOnce(new Error('x'));
    await expect(svc.updateComplaintStatus(1, 'rejected', 2)).rejects.toMatchObject({ status: 500 });
  });
});

describe('updateStatusByOfficer', () => {
  it('rejects invalid status without touching db', async () => {
    await expect(svc.updateStatusByOfficer(1, 'new', 2)).rejects.toMatchObject({ status: 400 });
    expect(db.oneOrNone).not.toHaveBeenCalled();
  });
  it('403 when complaint not owned', async () => {
    db.oneOrNone.mockResolvedValueOnce(null);
    await expect(svc.updateStatusByOfficer(1, 'in_progress', 2)).rejects.toMatchObject({ status: 403 });
    expect(db.tx).not.toHaveBeenCalled();
  });
  it('updates with user id as changed_by and emails citizen', async () => {
    db.oneOrNone.mockResolvedValueOnce({ officer_id: 4 }); // ownership
    db._tx.oneOrNone.mockResolvedValue({ status: 'assigned' });
    db._tx.one.mockResolvedValue({ complaint_id: 1, status: 'in_progress' });
    db.oneOrNone.mockResolvedValueOnce({ citizen_name: 'C', citizen_email: 'c@x' });
    const r = await svc.updateStatusByOfficer(1, 'in_progress', 2, 'on it');
    expect(r.status).toBe('in_progress');
    expect(db._tx.none.mock.calls[0][1]).toEqual([1, 'assigned', 'in_progress', 2, 'on it']);
    await flush();
    expect(notify.sendComplaintStatusUpdateEmail).toHaveBeenCalledWith('c@x', 'C', 1, 'in_progress');
  });
  it('skips email without citizen email; email failure never blocks', async () => {
    db._tx.oneOrNone.mockResolvedValue({ status: 'assigned' });
    db._tx.one.mockResolvedValue({ complaint_id: 1 });
    db.oneOrNone.mockResolvedValueOnce({ officer_id: 4 }).mockResolvedValueOnce({ citizen_email: null });
    await svc.updateStatusByOfficer(1, 'resolved', 2);
    await flush();
    expect(notify.sendComplaintStatusUpdateEmail).not.toHaveBeenCalled();

    db.oneOrNone.mockResolvedValueOnce({ officer_id: 4 }).mockResolvedValueOnce({ citizen_email: 'c@x', citizen_name: 'C' });
    notify.sendComplaintStatusUpdateEmail.mockRejectedValueOnce(new Error('smtp'));
    await expect(svc.updateStatusByOfficer(1, 'resolved', 2)).resolves.toBeDefined();
    await flush();
    expect(console.error).toHaveBeenCalledWith('Email error (non-blocking):', 'smtp');
  });
});

describe('resolveComplaint', () => {
  it('404 when not assigned to officer', async () => {
    db._tx.oneOrNone.mockResolvedValue(null);
    await expect(svc.resolveComplaint(1, 'img', 'c', 4, 9)).rejects.toMatchObject({ status: 404 });
    expect(db._tx.one).not.toHaveBeenCalled();
  });
  it('resolves in tx using previous status and user id', async () => {
    db._tx.oneOrNone.mockResolvedValue({ status: 'in_progress' });
    db._tx.one.mockResolvedValue({ complaint_id: 1, status: 'resolved' });
    await svc.resolveComplaint(1, 'img', 'done', 4, 9);
    expect(db._tx.oneOrNone.mock.calls[0][1]).toEqual([1, 4]);
    expect(db._tx.one.mock.calls[0][1]).toEqual(['img', 'done', 1]);
    expect(db._tx.none.mock.calls[0][1]).toEqual([1, 'in_progress', 9, 'done']);
  });
  it('null comment in history; wraps errors', async () => {
    db._tx.oneOrNone.mockResolvedValue({ status: 'assigned' });
    db._tx.one.mockResolvedValue({});
    await svc.resolveComplaint(1, 'img', '', 4, 9);
    expect(db._tx.none.mock.calls[0][1][3]).toBeNull();
    db.tx.mockRejectedValueOnce(new Error('x'));
    await expect(svc.resolveComplaint(1, 'img', 'c', 4, 9)).rejects.toMatchObject({ status: 500 });
  });
  it('resolveComplaintForUser validates image and officer profile', async () => {
    await expect(svc.resolveComplaintForUser(1, null, 'c', 9)).rejects.toMatchObject({ status: 400 });
    db.oneOrNone.mockResolvedValueOnce(null);
    await expect(svc.resolveComplaintForUser(1, 'img', 'c', 9)).rejects.toMatchObject({ status: 404 });
    db.oneOrNone.mockResolvedValueOnce({ officer_id: 4 });
    db._tx.oneOrNone.mockResolvedValue({ status: 'assigned' });
    db._tx.one.mockResolvedValue({ status: 'resolved' });
    expect(await svc.resolveComplaintForUser(1, 'img', 'c', 9)).toEqual({ status: 'resolved' });
    expect(db._tx.oneOrNone.mock.calls[0][1]).toEqual([1, 4]);
    expect(db._tx.none.mock.calls[0][1][2]).toBe(9);
  });
});

describe('getAuthorizedComplaint', () => {
  const c = { complaint_id: 1, user_id: 5, officer_user_id: 6 };
  it('404', async () => {
    db.oneOrNone.mockResolvedValueOnce(null);
    await expect(svc.getAuthorizedComplaint(1, { user_id: 1 })).rejects.toMatchObject({ status: 404 });
  });
  it.each([
    ['owner', { user_id: '5', role: 'citizen' }],
    ['assigned officer', { user_id: 6, role: 'officer' }],
    ['admin', { user_id: 99, role: 'admin' }],
  ])('allows %s', async (_n, user) => {
    db.oneOrNone.mockResolvedValueOnce(c);
    expect(await svc.getAuthorizedComplaint(1, user)).toBe(c);
  });
  it('403 for others with default and custom message', async () => {
    db.oneOrNone.mockResolvedValueOnce(c);
    await expect(svc.getAuthorizedComplaint(1, { user_id: 7, role: 'citizen' }))
      .rejects.toMatchObject({ status: 403, message: 'Not authorized to view this complaint' });
    db.oneOrNone.mockResolvedValueOnce(c);
    await expect(svc.getAuthorizedComplaint(1, { user_id: 7, role: 'citizen' }, 'nope'))
      .rejects.toMatchObject({ status: 403, message: 'nope' });
  });
});

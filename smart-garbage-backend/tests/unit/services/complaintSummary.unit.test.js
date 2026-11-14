jest.mock('../../../src/config/database', () => ({ db: { one: jest.fn() } }));
jest.mock('../../../src/services/notificationService', () => ({ sendComplaintStatusUpdateEmail: jest.fn() }));

const { db } = require('../../../src/config/database');
const svc = require('../../../src/services/complaintService');

beforeEach(() => db.one.mockReset());

describe('getComplaintSummaryByUser', () => {
  it('runs one aggregate with the user id and returns numbers', async () => {
    db.one.mockResolvedValue({ total: '5', pending: '2', in_progress: 1, resolved: '1', rejected: null });
    const out = await svc.getComplaintSummaryByUser(7);
    expect(out).toEqual({ total: 5, pending: 2, in_progress: 1, resolved: 1, rejected: 0 });
    expect(db.one).toHaveBeenCalledTimes(1);
    const [sql, params] = db.one.mock.calls[0];
    expect(params).toEqual([7]);
    expect(sql).toContain("status IN ('new', 'pending', 'assigned')");
    expect(sql).toContain('user_id = $1');
  });
  it('wraps errors as 500', async () => {
    db.one.mockRejectedValue(new Error('x'));
    await expect(svc.getComplaintSummaryByUser(1)).rejects.toMatchObject({ status: 500 });
  });
});

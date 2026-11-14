jest.mock('../../../src/config/database', () => ({
  db: { oneOrNone: jest.fn(), one: jest.fn(), none: jest.fn(), manyOrNone: jest.fn() },
}));

const { db } = require('../../../src/config/database');
const svc = require('../../../src/services/assignmentService');

beforeEach(() => Object.values(db).forEach((f) => f.mockReset()));

const complaint = { complaint_id: 10, latitude: 12.5, longitude: 77.5, ward_id: 2 };
const officer = {
  officer_id: 4, officer_name: 'Off', officer_phone: 'p', officer_email: 'e',
  distance_meters: '123.6', current_workload: '2',
};

describe('autoAssignComplaint', () => {
  it('404 for unknown complaint', async () => {
    db.oneOrNone.mockResolvedValueOnce(null);
    await expect(svc.autoAssignComplaint(1)).rejects.toMatchObject({ status: 404 });
  });
  it('409 when no officer available', async () => {
    db.oneOrNone.mockResolvedValueOnce(complaint).mockResolvedValueOnce(null);
    await expect(svc.autoAssignComplaint(10)).rejects.toMatchObject({ status: 409 });
    expect(db.one).not.toHaveBeenCalled();
  });
  it('assigns best officer, logs history, returns officer info', async () => {
    db.oneOrNone.mockResolvedValueOnce(complaint).mockResolvedValueOnce(officer);
    db.one.mockResolvedValueOnce({ complaint_id: 10, assigned_officer_id: 4, status: 'assigned' });
    const r = await svc.autoAssignComplaint(10);
    expect(db.oneOrNone.mock.calls[1][1]).toEqual(['POINT(77.5 12.5)', 2]);
    expect(db.one.mock.calls[0][1]).toEqual([4, 10]);
    expect(db.none.mock.calls[0][1]).toEqual([10, 'Auto-assigned to Officer: Off']);
    expect(r.officer).toEqual({
      officer_id: 4, name: 'Off', phone: 'p', email: 'e', distance_meters: 124, current_workload: 2,
    });
    expect(r.status).toBe('assigned');
  });
  it('workload defaults to 0 when null', async () => {
    db.oneOrNone.mockResolvedValueOnce(complaint).mockResolvedValueOnce({ ...officer, current_workload: null });
    db.one.mockResolvedValueOnce({});
    expect((await svc.autoAssignComplaint(10)).officer.current_workload).toBe(0);
  });
  it('wraps unexpected errors as 500', async () => {
    db.oneOrNone.mockRejectedValueOnce(new Error('x'));
    await expect(svc.autoAssignComplaint(1)).rejects.toMatchObject({ status: 500, message: 'Auto-assignment failed' });
  });
});

describe('findNearestOfficers', () => {
  it('passes point, ward and limit', async () => {
    db.manyOrNone.mockResolvedValue([1]);
    expect(await svc.findNearestOfficers(1, 2, 3)).toEqual([1]);
    expect(db.manyOrNone.mock.calls[0][1]).toEqual(['POINT(2 1)', 3, 5]);
    await svc.findNearestOfficers(1, 2, 3, 9);
    expect(db.manyOrNone.mock.calls[1][1][2]).toBe(9);
  });
  it('wraps error', async () => {
    db.manyOrNone.mockRejectedValue(new Error('x'));
    await expect(svc.findNearestOfficers(1, 2, 3)).rejects.toMatchObject({ status: 500 });
  });
});

describe('manualAssign', () => {
  it('404 when officer missing', async () => {
    db.oneOrNone.mockResolvedValueOnce(null);
    await expect(svc.manualAssign(1, 2, 3)).rejects.toMatchObject({ status: 404 });
  });
  it('first assignment comment', async () => {
    db.oneOrNone.mockResolvedValueOnce({ officer_id: 2 }).mockResolvedValueOnce({ assigned_officer_id: null, status: 'new' });
    db.one.mockResolvedValueOnce({ complaint_id: 1 });
    expect(await svc.manualAssign(1, 2, 99)).toEqual({ complaint_id: 1 });
    expect(db.none.mock.calls[0][1]).toEqual([1, 'new', 99, 'Manually assigned to Officer 2']);
  });
  it('reassignment comment', async () => {
    db.oneOrNone.mockResolvedValueOnce({ officer_id: 2 }).mockResolvedValueOnce({ assigned_officer_id: 7, status: 'assigned' });
    db.one.mockResolvedValueOnce({});
    await svc.manualAssign(1, 2, 99);
    expect(db.none.mock.calls[0][1][3]).toBe('Reassigned from Officer 7 to 2');
  });
  it('404 when the complaint does not exist (and nothing is updated)', async () => {
    db.oneOrNone.mockResolvedValueOnce({ officer_id: 2 }).mockResolvedValueOnce(null);
    await expect(svc.manualAssign(1, 2, 99)).rejects.toMatchObject({ status: 404, message: 'Complaint not found' });
    expect(db.one).not.toHaveBeenCalled();
    expect(db.none).not.toHaveBeenCalled();
  });
});

describe('getOfficerWorkload', () => {
  it('returns row / wraps error', async () => {
    db.oneOrNone.mockResolvedValueOnce({ total_active: '1' });
    expect(await svc.getOfficerWorkload(1)).toEqual({ total_active: '1' });
    db.oneOrNone.mockRejectedValueOnce(new Error('x'));
    await expect(svc.getOfficerWorkload(1)).rejects.toMatchObject({ status: 500 });
  });
});

describe('balanceWorkload', () => {
  it('not enough officers', async () => {
    db.manyOrNone.mockResolvedValueOnce([{ officer_id: 1, current_load: 5 }]);
    expect(await svc.balanceWorkload(1)).toEqual({ message: 'Not enough officers to balance' });
  });
  it('already balanced when difference < 2', async () => {
    db.manyOrNone.mockResolvedValueOnce([{ officer_id: 1, current_load: 3 }, { officer_id: 2, current_load: 2 }]);
    expect(await svc.balanceWorkload(1)).toEqual({ message: 'Workload is balanced' });
  });
  it('balanced message when busiest has no movable complaint', async () => {
    db.manyOrNone.mockResolvedValueOnce([{ officer_id: 1, current_load: 5 }, { officer_id: 2, current_load: 1 }]);
    db.oneOrNone.mockResolvedValueOnce(null);
    expect(await svc.balanceWorkload(1)).toEqual({ message: 'Workload is balanced' });
  });
  it('moves oldest complaint to least busy officer', async () => {
    db.manyOrNone.mockResolvedValueOnce([{ officer_id: 1, current_load: 5 }, { officer_id: 3, current_load: 2 }, { officer_id: 2, current_load: 1 }]);
    db.oneOrNone
      .mockResolvedValueOnce({ complaint_id: 50 }) // oldest complaint
      .mockResolvedValueOnce({ officer_id: 2 }) // manualAssign: officer exists
      .mockResolvedValueOnce({ assigned_officer_id: 1, status: 'assigned' });
    db.one.mockResolvedValueOnce({});
    expect(await svc.balanceWorkload(1)).toEqual({
      message: 'Workload balanced', reassigned: 50, from: 1, to: 2,
    });
    expect(db.none.mock.calls[0][1]).toEqual([50, 'assigned', null, 'Reassigned from Officer 1 to 2']);
  });
  it('wraps error', async () => {
    db.manyOrNone.mockRejectedValueOnce(new Error('x'));
    await expect(svc.balanceWorkload(1)).rejects.toMatchObject({ status: 500 });
  });
});

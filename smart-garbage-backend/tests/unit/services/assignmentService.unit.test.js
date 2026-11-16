jest.mock('../../../src/config/database', () => {
  const db = { oneOrNone: jest.fn(), one: jest.fn(), none: jest.fn(), manyOrNone: jest.fn(), any: jest.fn(), tx: jest.fn() };
  db.tx.mockImplementation((cb) => cb(db));
  return { db };
});

const { db } = require('../../../src/config/database');
const svc = require('../../../src/services/assignmentService');

beforeEach(() => {
  Object.values(db).forEach((f) => f.mockReset());
  db.tx.mockImplementation((cb) => cb(db));
});

const complaint = { complaint_id: 10, latitude: 12.5, longitude: 77.5, ward_id: 2, ward_name: 'Ward 2', area: 'Ward 2' };
const officer = {
  officer_id: 4, officer_name: 'Off', officer_phone: 'p', officer_email: 'e',
  distance_meters: '123.6', current_workload: '2', tier: 1,
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
  it('serialises with an advisory lock inside one transaction', async () => {
    db.oneOrNone.mockResolvedValueOnce(complaint).mockResolvedValueOnce(officer);
    db.one.mockResolvedValueOnce({ complaint_id: 10, assigned_officer_id: 4, status: 'assigned' });
    await svc.autoAssignComplaint(10);
    expect(db.tx).toHaveBeenCalledTimes(1);
    // pg_advisory_xact_lock returns a (void) row, so it must use any(): none() rejects any returned row
    expect(db.any.mock.calls[0][0]).toContain('pg_advisory_xact_lock');
    expect(db.none.mock.calls.some((c) => String(c[0]).includes('pg_advisory'))).toBe(false);
  });
  it('assigns best officer, logs the reason in history, returns officer info', async () => {
    db.oneOrNone.mockResolvedValueOnce({ ...complaint, status: 'new' }).mockResolvedValueOnce(officer);
    db.one.mockResolvedValueOnce({ complaint_id: 10, assigned_officer_id: 4, status: 'assigned' });
    const r = await svc.autoAssignComplaint(10);
    // selection params: point, ward id, ward name, radius (m), open-complaint cap
    expect(db.oneOrNone.mock.calls[1][1]).toEqual(['POINT(77.5 12.5)', 2, 'Ward 2', 10000, 20]);
    expect(db.one.mock.calls[0][1]).toEqual([4, 10]);
    expect(db.none.mock.calls[0][1]).toEqual([10, 'new', 'Auto-assigned to Officer: Off (ward match, 124 m away)']);
    expect(r.officer).toEqual({
      officer_id: 4, name: 'Off', phone: 'p', email: 'e', distance_meters: 124, current_workload: 2, match: 'ward match',
    });
    expect(r.status).toBe('assigned');
  });
  it('reports area and nearest matches; no distance for officers without a location', async () => {
    db.oneOrNone.mockResolvedValueOnce(complaint).mockResolvedValueOnce({ ...officer, tier: 2, distance_meters: null });
    db.one.mockResolvedValueOnce({});
    const r = await svc.autoAssignComplaint(10);
    expect(r.officer.match).toBe('area match');
    expect(r.officer.distance_meters).toBeNull();
    expect(db.none.mock.calls[0][1][2]).toBe('Auto-assigned to Officer: Off (area match)');
    db.oneOrNone.mockResolvedValueOnce(complaint).mockResolvedValueOnce({ ...officer, tier: 3, distance_meters: '4200' });
    db.one.mockResolvedValueOnce({});
    await svc.autoAssignComplaint(10);
    expect(db.none.mock.calls[1][1][2]).toBe('Auto-assigned to Officer: Off (nearest officer, 4.2 km away)');
  });
  it('uses the complaint area when it has no ward, and honours env overrides', async () => {
    process.env.ASSIGN_MAX_RADIUS_KM = '3';
    process.env.ASSIGN_MAX_OPEN_PER_OFFICER = '5';
    try {
      db.oneOrNone.mockResolvedValueOnce({ ...complaint, ward_id: null, ward_name: null, area: 'Unknown Area' })
        .mockResolvedValueOnce(officer);
      db.one.mockResolvedValueOnce({});
      await svc.autoAssignComplaint(10);
      expect(db.oneOrNone.mock.calls[1][1]).toEqual(['POINT(77.5 12.5)', null, 'Unknown Area', 3000, 5]);
    } finally {
      delete process.env.ASSIGN_MAX_RADIUS_KM;
      delete process.env.ASSIGN_MAX_OPEN_PER_OFFICER;
    }
  });
  it('onlyIfUnassigned leaves an already-assigned complaint alone', async () => {
    db.oneOrNone.mockResolvedValueOnce({ ...complaint, assigned_officer_id: 9 });
    expect(await svc.autoAssignComplaint(10, { onlyIfUnassigned: true })).toBeNull();
    expect(db.oneOrNone).toHaveBeenCalledTimes(1);
    expect(db.one).not.toHaveBeenCalled();
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

describe('selectOfficer query', () => {
  it('orders by tier, cap, nearest (100 m buckets) then workload; filters tier 3 by radius', async () => {
    db.oneOrNone.mockResolvedValueOnce(null);
    await svc.selectOfficer(db, complaint);
    const sql = db.oneOrNone.mock.calls[0][0];
    expect(sql).toMatch(/ORDER BY tier,\s+\(current_workload >= \$5\),\s+\(distance_meters IS NULL\),\s+ROUND\(distance_meters \/ 100\),\s+current_workload/);
    expect(sql).toContain('tier < 3 OR (distance_meters IS NOT NULL AND distance_meters <= $4)');
    expect(sql).toContain("o.status = 'active'");
    // officers without a ward are not universal: only matched through the area name
    expect(sql).not.toContain('assigned_ward_id IS NULL OR');
  });
});

describe('assignUnassigned', () => {
  it('assigns what it can, leaves the rest queued, ignores "no officer" errors', async () => {
    db.manyOrNone.mockResolvedValueOnce([{ complaint_id: 1 }, { complaint_id: 2 }, { complaint_id: 3 }]);
    db.oneOrNone
      .mockResolvedValueOnce({ ...complaint, complaint_id: 1 }).mockResolvedValueOnce(officer) // 1: assigned
      .mockResolvedValueOnce({ ...complaint, complaint_id: 2 }).mockResolvedValueOnce(null) // 2: nobody
      .mockResolvedValueOnce({ ...complaint, complaint_id: 3, assigned_officer_id: 5 }); // 3: raced
    db.one.mockResolvedValueOnce({});
    expect(await svc.assignUnassigned()).toEqual({ checked: 3, assigned: 1, remaining: 2 });
    expect(db.manyOrNone.mock.calls[0][0]).toContain("status = 'new'");
  });
  it('retryUnassignedSafely never rejects', async () => {
    db.manyOrNone.mockRejectedValueOnce(new Error('db down'));
    expect(await svc.retryUnassignedSafely()).toBeNull();
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

jest.mock('../../../src/config/database', () => {
  const tx = { oneOrNone: jest.fn(), one: jest.fn(), none: jest.fn() };
  return {
    db: {
      oneOrNone: jest.fn(), one: jest.fn(), none: jest.fn(), manyOrNone: jest.fn(), tx: jest.fn(), _tx: tx,
    },
  };
});

const bcrypt = require('bcryptjs');
const { db } = require('../../../src/config/database');
const svc = require('../../../src/services/officerService');

beforeEach(() => {
  ['oneOrNone', 'one', 'none', 'manyOrNone', 'tx'].forEach((k) => db[k].mockReset());
  ['oneOrNone', 'one', 'none'].forEach((k) => db._tx[k].mockReset());
  db.tx.mockImplementation((cb) => cb(db._tx));
});

describe('listing', () => {
  it('getAllOfficers default filter, then status + ward', async () => {
    db.manyOrNone.mockResolvedValue([]);
    await svc.getAllOfficers();
    expect(db.manyOrNone.mock.calls[0][1]).toEqual(['active', 100, 0]);
    await svc.getAllOfficers({ status: 'inactive', wardId: 3, limit: 5, offset: 10 });
    expect(db.manyOrNone.mock.calls[1][1]).toEqual(['inactive', 3, 5, 10]);
    expect(db.manyOrNone.mock.calls[1][0]).toContain('LIMIT $3 OFFSET $4');
    await svc.getAllOfficers({ status: '' });
    expect(db.manyOrNone.mock.calls[2][1]).toEqual([100, 0]);
  });
  it('getAllOfficers wraps error', async () => {
    db.manyOrNone.mockRejectedValue(new Error('x'));
    await expect(svc.getAllOfficers()).rejects.toMatchObject({ status: 500 });
  });
  it('countOfficers', async () => {
    db.one.mockResolvedValueOnce({ total: '7' });
    expect(await svc.countOfficers({ wardId: 2 })).toBe(7);
    expect(db.one.mock.calls[0][1]).toEqual(['active', 2]);
    db.one.mockResolvedValueOnce({ total: null });
    expect(await svc.countOfficers()).toBe(0);
    db.one.mockRejectedValueOnce(new Error('x'));
    await expect(svc.countOfficers()).rejects.toMatchObject({ status: 500 });
  });
  it('getOfficerById', async () => {
    db.oneOrNone.mockResolvedValueOnce({ officer_id: 1 });
    expect(await svc.getOfficerById(1)).toEqual({ officer_id: 1 });
    db.oneOrNone.mockRejectedValueOnce(new Error('x'));
    await expect(svc.getOfficerById(1)).rejects.toMatchObject({ status: 500 });
  });
});

describe('id lookups and access', () => {
  it('getOfficerIdByUserId / getOfficerUserId', async () => {
    db.oneOrNone.mockResolvedValueOnce({ officer_id: 4 });
    expect(await svc.getOfficerIdByUserId(1)).toBe(4);
    db.oneOrNone.mockResolvedValueOnce(null);
    expect(await svc.getOfficerIdByUserId(1)).toBeNull();
    db.oneOrNone.mockResolvedValueOnce({ user_id: 9 });
    expect(await svc.getOfficerUserId(1)).toBe(9);
    db.oneOrNone.mockResolvedValueOnce(null);
    expect(await svc.getOfficerUserId(1)).toBeNull();
  });
  it('assertOfficerAccess: 404, 403, owner, admin', async () => {
    db.oneOrNone.mockResolvedValueOnce(null);
    await expect(svc.assertOfficerAccess(1, { role: 'admin', user_id: 1 })).rejects.toMatchObject({ status: 404 });
    db.oneOrNone.mockResolvedValueOnce({ user_id: 9 });
    await expect(svc.assertOfficerAccess(1, { role: 'officer', user_id: 2 })).rejects.toMatchObject({ status: 403 });
    db.oneOrNone.mockResolvedValueOnce({ user_id: 9 });
    expect(await svc.assertOfficerAccess(1, { role: 'officer', user_id: '9' })).toBe(9);
    db.oneOrNone.mockResolvedValueOnce({ user_id: 9 });
    expect(await svc.assertOfficerAccess(1, { role: 'admin', user_id: 1 })).toBe(9);
  });
  it('profile/metrics for user: 404 when no officer, else delegates', async () => {
    db.oneOrNone.mockResolvedValueOnce(null);
    await expect(svc.getOfficerProfileForUser(1)).rejects.toMatchObject({ status: 404 });
    db.oneOrNone.mockResolvedValueOnce(null);
    await expect(svc.getOfficerMetricsForUser(1)).rejects.toMatchObject({ status: 404 });

    db.oneOrNone.mockResolvedValueOnce({ officer_id: 5 }).mockResolvedValueOnce({ officer_id: 5, name: 'N' });
    expect(await svc.getOfficerProfileForUser(1)).toEqual({ officer_id: 5, name: 'N' });
    db.oneOrNone.mockResolvedValueOnce({ officer_id: 5 }).mockResolvedValueOnce({ total_complaints: '3' });
    expect(await svc.getOfficerMetricsForUser(1)).toEqual({ total_complaints: '3' });
    expect(db.oneOrNone.mock.calls[3][1]).toEqual([5]);
  });
  it('getOfficerMetrics wraps error', async () => {
    db.oneOrNone.mockRejectedValueOnce(new Error('x'));
    await expect(svc.getOfficerMetrics(1)).rejects.toMatchObject({ status: 500 });
  });
});

describe('createOfficer', () => {
  const data = { name: 'N', email: 'e', phone: 'p', password: 'pw', employee_id: 'E1', ward_id: 0, area_name: 'A', year_of_joining: 2020 };
  it('creates user, officer and preferences in one tx', async () => {
    db._tx.one.mockResolvedValueOnce({ user_id: 8, name: 'N' }).mockResolvedValueOnce({ officer_id: 3, user_id: 8 });
    const r = await svc.createOfficer(data);
    expect(r).toEqual({ officer_id: 3, user_id: 8, name: 'N' });
    expect(db.tx).toHaveBeenCalledTimes(1);
    const userParams = db._tx.one.mock.calls[0][1];
    expect(await bcrypt.compare('pw', userParams[3])).toBe(true);
    expect(db._tx.one.mock.calls[1][1]).toEqual([8, 'E1', null, 'A', 2020]);
    expect(db._tx.none).toHaveBeenCalledWith(expect.stringContaining('user_preferences'), [8, 'p']);
  });
  it('stores the officer email trimmed and lower-cased', async () => {
    db._tx.one.mockResolvedValueOnce({ user_id: 8, name: 'N' }).mockResolvedValueOnce({ officer_id: 3, user_id: 8 });
    await svc.createOfficer({ ...data, email: '  Officer@Example.COM ' });
    expect(db._tx.one.mock.calls[0][1][1]).toBe('officer@example.com');
  });
  it('passes through constraint errors, wraps others', async () => {
    db._tx.one.mockRejectedValueOnce(Object.assign(new Error('dup'), { code: '23505' }));
    await expect(svc.createOfficer(data)).rejects.toMatchObject({ code: '23505' });
    db._tx.one.mockRejectedValueOnce(new Error('x'));
    await expect(svc.createOfficer(data)).rejects.toMatchObject({ status: 500, message: 'Failed to create officer' });
  });
});

describe('updateOfficer', () => {
  it('404 when officer missing', async () => {
    db._tx.oneOrNone.mockResolvedValue(null);
    await expect(svc.updateOfficer(1, { name: 'x' })).rejects.toMatchObject({ status: 404 });
    expect(db._tx.none).not.toHaveBeenCalled();
  });
  it('updates user when name/phone given and strips user_id', async () => {
    db._tx.oneOrNone.mockResolvedValue({ officer_id: 1, user_id: 5, status: 'active' });
    const r = await svc.updateOfficer(1, { name: 'N' });
    expect(r).toEqual({ officer_id: 1, status: 'active' });
    expect(db._tx.none.mock.calls[0][1]).toEqual([5, 'N', undefined]);
  });
  it('skips user update with only officer fields; default arg works', async () => {
    db._tx.oneOrNone.mockResolvedValue({ officer_id: 1, user_id: 5 });
    await svc.updateOfficer(1, { status: 'inactive' });
    await svc.updateOfficer(1);
    expect(db._tx.none).not.toHaveBeenCalled();
  });
});

describe('updateOfficerLocation', () => {
  it.each([[91, 0], [-91, 0], ['x', 0]])('rejects bad latitude %p', async (la, lo) => {
    await expect(svc.updateOfficerLocation(1, la, lo)).rejects.toMatchObject({ status: 400, message: /Latitude/ });
  });
  it.each([[0, 181], [0, -181], [0, 'x']])('rejects bad longitude %p,%p', async (la, lo) => {
    await expect(svc.updateOfficerLocation(1, la, lo)).rejects.toMatchObject({ status: 400, message: /Longitude/ });
  });
  it('passes lng before lat; 404 when missing; wraps errors', async () => {
    db.oneOrNone.mockResolvedValueOnce({ officer_id: 1 });
    await svc.updateOfficerLocation(1, '10', '20');
    expect(db.oneOrNone.mock.calls[0][1]).toEqual([1, 20, 10]);
    db.oneOrNone.mockResolvedValueOnce(null);
    await expect(svc.updateOfficerLocation(1, 1, 1)).rejects.toMatchObject({ status: 404 });
    db.oneOrNone.mockRejectedValueOnce(new Error('x'));
    await expect(svc.updateOfficerLocation(1, 1, 1)).rejects.toMatchObject({ status: 500 });
  });
});

describe('deactivate / delete', () => {
  it('deactivate: 404, success releases complaints, wraps error', async () => {
    db._tx.oneOrNone.mockResolvedValueOnce(null);
    await expect(svc.deactivateOfficer(1)).rejects.toMatchObject({ status: 404 });
    expect(db._tx.none).not.toHaveBeenCalled();
    db._tx.oneOrNone.mockResolvedValueOnce({ officer_id: 1, status: 'inactive' });
    expect(await svc.deactivateOfficer(1)).toEqual({ officer_id: 1, status: 'inactive' });
    expect(db._tx.none.mock.calls[0][0]).toContain("status = 'new'");
    db.tx.mockRejectedValueOnce(new Error('x'));
    await expect(svc.deactivateOfficer(1)).rejects.toMatchObject({ status: 500 });
  });
  it('delete: 404, success deletes officer then user, wraps error', async () => {
    db._tx.oneOrNone.mockResolvedValueOnce(null);
    await expect(svc.deleteOfficer(1)).rejects.toMatchObject({ status: 404 });
    db._tx.oneOrNone.mockResolvedValueOnce({ user_id: 6 });
    await svc.deleteOfficer(1);
    expect(db._tx.none.mock.calls[0][0]).toContain('DELETE FROM officers');
    expect(db._tx.none.mock.calls[1]).toEqual([expect.stringContaining('DELETE FROM users'), [6]]);
    db.tx.mockRejectedValueOnce(Object.assign(new Error('fk'), { code: '23503' }));
    await expect(svc.deleteOfficer(1)).rejects.toMatchObject({ code: '23503' });
  });
});

jest.mock('../../../src/config/database', () => ({
  db: { oneOrNone: jest.fn(), one: jest.fn(), none: jest.fn(), manyOrNone: jest.fn() },
}));

const { db } = require('../../../src/config/database');
const svc = require('../../../src/services/wardService');

const ring = [[0, 0], [1, 0], [1, 1], [0, 0]];
const poly = { type: 'Polygon', coordinates: [ring] };
const valid = { name: ' W1 ', city: 'C', state: 'S', boundaries_geojson: poly };
const polyOf = (coords) => ({ type: 'Polygon', coordinates: coords });

beforeEach(() => Object.values(db).forEach((f) => f.mockReset()));

describe('reads', () => {
  it('getAllWards with and without city', async () => {
    db.manyOrNone.mockResolvedValue([1]);
    await svc.getAllWards({ city: 'X', limit: 5, offset: 2 });
    expect(db.manyOrNone.mock.calls[0][1]).toEqual(['X', 5, 2]);
    expect(db.manyOrNone.mock.calls[0][0]).toContain('LIMIT $2 OFFSET $3');
    await svc.getAllWards();
    expect(db.manyOrNone.mock.calls[1][1]).toEqual([100, 0]);
  });
  it('getAllWards wraps errors as 500', async () => {
    db.manyOrNone.mockRejectedValue(new Error('x'));
    await expect(svc.getAllWards()).rejects.toMatchObject({ status: 500, message: 'Failed to fetch wards' });
  });
  it('countWards', async () => {
    db.one.mockResolvedValueOnce({ total: '4' });
    expect(await svc.countWards({ city: 'c' })).toBe(4);
    expect(db.one.mock.calls[0][1]).toEqual(['c']);
    db.one.mockResolvedValueOnce({ total: 'zz' });
    expect(await svc.countWards()).toBe(0);
    db.one.mockRejectedValueOnce(new Error('x'));
    await expect(svc.countWards()).rejects.toMatchObject({ status: 500 });
  });
  it('getWardById / getWardOfficers', async () => {
    db.oneOrNone.mockResolvedValue({ ward_id: 1 });
    expect(await svc.getWardById(1)).toEqual({ ward_id: 1 });
    db.oneOrNone.mockRejectedValue(new Error('x'));
    await expect(svc.getWardById(1)).rejects.toMatchObject({ status: 500 });
    db.manyOrNone.mockResolvedValue([{}]);
    expect(await svc.getWardOfficers(1)).toEqual([{}]);
    db.manyOrNone.mockRejectedValue(new Error('x'));
    await expect(svc.getWardOfficers(1)).rejects.toMatchObject({ status: 500 });
  });
});

describe('createWard', () => {
  const ok = () => {
    db.one.mockResolvedValueOnce({ ok: true });
    db.oneOrNone.mockResolvedValueOnce(null);
    db.one.mockResolvedValueOnce({ ward_id: 1 });
  };

  it('succeeds with trimmed values and normalised polygon', async () => {
    ok();
    expect(await svc.createWard(valid)).toEqual({ ward_id: 1 });
    const params = db.one.mock.calls[1][1];
    expect(params.slice(0, 3)).toEqual(['W1', 'C', 'S']);
    expect(JSON.parse(params[3])).toEqual(poly);
  });

  it.each([
    ['no name', { ...valid, name: '' }, /name is required/],
    ['non-string city', { ...valid, city: 5 }, /city is required/],
    ['long state', { ...valid, state: 'x'.repeat(256) }, /at most 255/],
    ['missing geo', { ...valid, boundaries_geojson: undefined }, /boundaries_geojson is required/],
    ['null geo', { ...valid, boundaries_geojson: null }, /boundaries_geojson is required/],
    ['bad json', { ...valid, boundaries_geojson: '{nope' }, /not valid JSON/],
    ['wrong type', { ...valid, boundaries_geojson: { type: 'Point' } }, /must be a GeoJSON Polygon/],
    ['empty rings', { ...valid, boundaries_geojson: polyOf([]) }, /at least one ring/],
    ['short ring', { ...valid, boundaries_geojson: polyOf([[[0, 0], [1, 1]]]) }, /at least 4/],
    ['non numeric pt', { ...valid, boundaries_geojson: polyOf([[[0, 0], ['a', 1], [1, 1], [0, 0]]]) }, /\[lng, lat\] numbers/],
    ['out of range', { ...valid, boundaries_geojson: polyOf([[[0, 0], [181, 1], [1, 1], [0, 0]]]) }, /out of range/],
    ['unclosed', { ...valid, boundaries_geojson: polyOf([[[0, 0], [1, 0], [1, 1], [2, 2]]]) }, /must be closed/],
  ])('rejects %s with 400', async (_n, data, re) => {
    await expect(svc.createWard(data)).rejects.toMatchObject({ status: 400, message: expect.stringMatching(re) });
  });

  it('accepts Feature and JSON string input', async () => {
    ok();
    await svc.createWard({ ...valid, boundaries_geojson: JSON.stringify({ type: 'Feature', geometry: poly }) });
    expect(JSON.parse(db.one.mock.calls[1][1][3])).toEqual(poly);
  });

  it('createWard() with no args rejects', async () => {
    await expect(svc.createWard()).rejects.toMatchObject({ status: 400 });
  });

  it('invalid geometry from DB / ST_IsValid false', async () => {
    db.one.mockRejectedValueOnce(new Error('pg'));
    await expect(svc.createWard(valid)).rejects.toMatchObject({ status: 400, message: 'Invalid GeoJSON geometry' });
    db.one.mockResolvedValueOnce({ ok: false, reason: 'Self-intersection' });
    await expect(svc.createWard(valid)).rejects.toMatchObject({ status: 400, message: 'Invalid polygon: Self-intersection' });
  });

  it('duplicate pre-check -> 409', async () => {
    db.one.mockResolvedValueOnce({ ok: true });
    db.oneOrNone.mockResolvedValueOnce({ ward_id: 2 });
    await expect(svc.createWard(valid)).rejects.toMatchObject({ status: 409 });
  });

  it('unique violation 23505 on insert -> 409', async () => {
    db.one.mockResolvedValueOnce({ ok: true });
    db.oneOrNone.mockResolvedValueOnce(null);
    db.one.mockRejectedValueOnce(Object.assign(new Error('dup'), { code: '23505' }));
    await expect(svc.createWard(valid)).rejects.toMatchObject({ status: 409 });
  });

  it('other db errors become 500', async () => {
    db.one.mockResolvedValueOnce({ ok: true });
    db.oneOrNone.mockResolvedValueOnce(null);
    db.one.mockRejectedValueOnce(new Error('conn'));
    await expect(svc.createWard(valid)).rejects.toMatchObject({ status: 500, message: 'Failed to create ward' });
  });
});

describe('updateWard', () => {
  it.each(['abc', 0, -1, 1.5])('invalid id %p', async (id) => {
    await expect(svc.updateWard(id, {})).rejects.toMatchObject({ status: 400, message: 'Invalid ward id' });
  });
  it('not found (existing)', async () => {
    db.oneOrNone.mockResolvedValueOnce(null);
    await expect(svc.updateWard(1, {})).rejects.toMatchObject({ status: 404 });
  });
  it('no-change update builds only updated_at', async () => {
    db.oneOrNone.mockResolvedValueOnce({ name: 'a', city: 'b' }).mockResolvedValueOnce({ ward_id: 1 });
    await svc.updateWard('1');
    const [sql, params] = db.oneOrNone.mock.calls[1];
    expect(sql).toContain('SET updated_at = CURRENT_TIMESTAMP WHERE');
    expect(params).toEqual([1]);
  });
  it('builds SET clauses for all fields and checks duplicates excluding self', async () => {
    db.oneOrNone.mockResolvedValueOnce({ name: 'a', city: 'b' });
    db.one.mockResolvedValueOnce({ ok: true });
    db.oneOrNone.mockResolvedValueOnce(null); // dup check
    db.oneOrNone.mockResolvedValueOnce({ ward_id: 1 });
    await svc.updateWard(1, { name: 'n', city: 'c', state: 's', boundaries_geojson: poly });
    expect(db.oneOrNone.mock.calls[1][1]).toEqual(['n', 'c', 1]);
    const [sql, params] = db.oneOrNone.mock.calls[2];
    expect(sql).toContain('name = $2, city = $3, state = $4, boundaries = ST_SetSRID(ST_GeomFromGeoJSON($5), 4326)');
    expect(params.slice(0, 4)).toEqual([1, 'n', 'c', 's']);
  });
  it('same name/city skips duplicate check; null geo ignored', async () => {
    db.oneOrNone.mockResolvedValueOnce({ name: 'a', city: 'b' }).mockResolvedValueOnce({ ward_id: 1 });
    await svc.updateWard(1, { name: 'a', boundaries_geojson: null });
    expect(db.oneOrNone).toHaveBeenCalledTimes(2);
  });
  it('duplicate -> 409, 23505 -> 409, vanished row -> 404, db error -> 500', async () => {
    db.oneOrNone.mockResolvedValueOnce({ name: 'a', city: 'b' }).mockResolvedValueOnce({ ward_id: 9 });
    await expect(svc.updateWard(1, { name: 'z' })).rejects.toMatchObject({ status: 409 });
    db.oneOrNone.mockResolvedValueOnce({ name: 'a', city: 'b' }).mockResolvedValueOnce(null)
      .mockRejectedValueOnce(Object.assign(new Error('d'), { code: '23505' }));
    await expect(svc.updateWard(1, { name: 'z' })).rejects.toMatchObject({ status: 409 });
    db.oneOrNone.mockResolvedValueOnce({ name: 'a', city: 'b' }).mockResolvedValueOnce(null);
    await expect(svc.updateWard(1, { state: 's' })).rejects.toMatchObject({ status: 404 });
    db.oneOrNone.mockRejectedValueOnce(new Error('x'));
    await expect(svc.updateWard(1, {})).rejects.toMatchObject({ status: 500 });
  });
});

describe('getWardByCoordinates', () => {
  it.each([['x', 1], [1, 'y'], [NaN, 1], [1, Infinity]])('invalid coords %p,%p', async (la, lo) => {
    await expect(svc.getWardByCoordinates(la, lo)).rejects.toMatchObject({ status: 400, message: 'Invalid coordinates' });
    expect(db.oneOrNone).not.toHaveBeenCalled();
  });
  it('passes [lng, lat]', async () => {
    db.oneOrNone.mockResolvedValue({ ward_id: 1 });
    expect(await svc.getWardByCoordinates('10.5', '20.5')).toEqual({ ward_id: 1 });
    expect(db.oneOrNone.mock.calls[0][1]).toEqual([20.5, 10.5]);
  });
  it('wraps db error', async () => {
    db.oneOrNone.mockRejectedValue(new Error('x'));
    await expect(svc.getWardByCoordinates(1, 1)).rejects.toMatchObject({ status: 500 });
  });
});

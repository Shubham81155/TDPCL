jest.mock('../../../src/config/database', () => ({ db: { oneOrNone: jest.fn(), manyOrNone: jest.fn() } }));

const { db } = require('../../../src/config/database');
const svc = require('../../../src/services/adminService');

beforeEach(() => {
  Object.values(db).forEach((f) => f.mockReset());
  db.oneOrNone.mockResolvedValue({});
  db.manyOrNone.mockResolvedValue([]);
});

const from = new Date('2024-01-01');
const to = new Date('2024-01-31');

describe('stats date predicates', () => {
  it('no filters: no WHERE, empty params', async () => {
    await svc.getComplaintStats();
    await svc.getStatsByCategory();
    expect(db.oneOrNone.mock.calls[0][0]).not.toMatch(/FROM complaints\s+WHERE/);
    expect(db.oneOrNone.mock.calls[0][1]).toEqual([]);
    expect(db.manyOrNone.mock.calls[0][0]).not.toMatch(/FROM complaints\s+WHERE/);
    expect(db.manyOrNone.mock.calls[0][1]).toEqual([]);
  });
  it('getComplaintStats binds day strings; dateTo is exclusive next day (inclusive end of day)', async () => {
    await svc.getComplaintStats({ dateFrom: from, dateTo: to });
    const [sql, params] = db.oneOrNone.mock.calls[0];
    expect(params).toEqual(['2024-01-01', '2024-01-31']);
    expect(sql).toContain('created_at >= $1::date');
    expect(sql).toContain('created_at < ($2::date + 1)');
  });
  it('only dateTo uses $1', async () => {
    await svc.getStatsByCategory({ dateTo: to });
    const [sql, params] = db.manyOrNone.mock.calls[0];
    expect(params).toEqual(['2024-01-31']);
    expect(sql).toContain('created_at < ($1::date + 1)');
    expect(sql).not.toContain('>=');
  });
  it('by-ward puts the predicate inside both sub-selects, keeping all wards', async () => {
    await svc.getStatsByWard({ dateFrom: from });
    const [sql, params] = db.manyOrNone.mock.calls[0];
    expect(params).toEqual(['2024-01-01']);
    expect(sql.match(/c\.created_at >= \$1::date/g)).toHaveLength(2);
    expect(sql).toContain('FROM wards w');
  });
  it('officer-performance keeps limit as $1 and filters in the JOIN ON clause', async () => {
    await svc.getOfficerPerformance(5, { dateFrom: from, dateTo: to });
    const [sql, params] = db.manyOrNone.mock.calls[0];
    expect(params).toEqual([5, '2024-01-01', '2024-01-31']);
    expect(sql).toMatch(/LEFT JOIN complaints c ON o\.officer_id = c\.assigned_officer_id AND c\.created_at >= \$2::date AND c\.created_at < \(\$3::date \+ 1\)/);
    expect(sql).toContain('LIMIT $1');
    expect(sql).toContain('o.officer_id');
  });
  it('accepts date strings as well as Dates', async () => {
    await svc.getComplaintStats({ dateFrom: '2024-05-06' });
    expect(db.oneOrNone.mock.calls[0][1]).toEqual(['2024-05-06']);
  });
});

describe('getHeatmapData filters', () => {
  it('unfiltered: only location predicate, LIMIT 5000, no params', async () => {
    await svc.getHeatmapData();
    const [sql, params] = db.manyOrNone.mock.calls[0];
    expect(params).toEqual([]);
    expect(sql).toContain('WHERE location IS NOT NULL');
    expect(sql).toContain('LIMIT 5000');
  });
  it('binds dates, status, category in order', async () => {
    await svc.getHeatmapData({ dateFrom: from, dateTo: to, status: 'new', category: 'litter' });
    const [sql, params] = db.manyOrNone.mock.calls[0];
    expect(params).toEqual(['2024-01-01', '2024-01-31', 'new', 'litter']);
    expect(sql).toContain('status = $3');
    expect(sql).toContain('category = $4');
  });
  it('wraps errors', async () => {
    db.manyOrNone.mockRejectedValueOnce(new Error('x'));
    await expect(svc.getHeatmapData({})).rejects.toMatchObject({ status: 500 });
  });
});

jest.mock('../../../src/config/database', () => ({
  db: { oneOrNone: jest.fn(), manyOrNone: jest.fn() },
}));

const { db } = require('../../../src/config/database');
const svc = require('../../../src/services/adminService');

beforeEach(() => Object.values(db).forEach((f) => f.mockReset()));

describe('stats queries', () => {
  it.each([
    ['getComplaintStats', 'oneOrNone', []],
    ['getStatsByCategory', 'manyOrNone', []],
    ['getStatsByWard', 'manyOrNone', []],
    ['getHeatmapData', 'manyOrNone', []],
  ])('%s returns rows and wraps errors', async (fn, method, args) => {
    db[method].mockResolvedValueOnce('rows');
    expect(await svc[fn](...args)).toBe('rows');
    db[method].mockRejectedValueOnce(new Error('x'));
    await expect(svc[fn](...args)).rejects.toMatchObject({ status: 500 });
  });

  it('getOfficerPerformance default and explicit limit', async () => {
    db.manyOrNone.mockResolvedValue([]);
    await svc.getOfficerPerformance();
    expect(db.manyOrNone.mock.calls[0][1]).toEqual([10]);
    await svc.getOfficerPerformance(3);
    expect(db.manyOrNone.mock.calls[1][1]).toEqual([3]);
    db.manyOrNone.mockRejectedValueOnce(new Error('x'));
    await expect(svc.getOfficerPerformance()).rejects.toMatchObject({ status: 500 });
  });

  it('getAuditLogs defaults / explicit / error', async () => {
    db.manyOrNone.mockResolvedValue([]);
    await svc.getAuditLogs();
    expect(db.manyOrNone.mock.calls[0][1]).toEqual([100, 0]);
    await svc.getAuditLogs({ limit: 5, offset: 2 });
    expect(db.manyOrNone.mock.calls[1][1]).toEqual([5, 2]);
    db.manyOrNone.mockRejectedValueOnce(new Error('x'));
    await expect(svc.getAuditLogs()).rejects.toMatchObject({ status: 500 });
  });
});

describe('csvCell', () => {
  it('null/undefined -> empty', () => {
    expect(svc.csvCell(null)).toBe('');
    expect(svc.csvCell(undefined)).toBe('');
  });
  it('plain values and numbers; zero kept', () => {
    expect(svc.csvCell('abc')).toBe('abc');
    expect(svc.csvCell(0)).toBe('0');
  });
  it('Date -> ISO', () => {
    expect(svc.csvCell(new Date('2024-01-02T03:04:05.000Z'))).toBe('2024-01-02T03:04:05.000Z');
  });
  it('quotes commas, quotes, newlines', () => {
    expect(svc.csvCell('a,b')).toBe('"a,b"');
    expect(svc.csvCell('say "hi"')).toBe('"say ""hi"""');
    expect(svc.csvCell('l1\nl2')).toBe('"l1\nl2"');
  });
  it.each(['=1+1', '+1', '-1', '@x', '\tx'])('neutralises formula prefix %p', (v) => {
    expect(svc.csvCell(v).startsWith("'")).toBe(true);
  });
  it('formula guard combined with quoting', () => {
    expect(svc.csvCell('=A,B')).toBe('"\'=A,B"');
  });
});

describe('exportComplaintsCsv', () => {
  const row = {
    complaint_id: 1, title: 'T, x', citizen_name: 'C', category: 'paper', urgency_level: 'low', status: 'new',
    area: 'A', ward_name: null, officer_name: null, created_at: new Date('2024-01-02T00:00:00.000Z'),
    assigned_at: null, resolved_at: null,
  };

  it('builds BOM + CRLF csv with defaults for missing ward/officer', async () => {
    db.manyOrNone.mockResolvedValue([row]);
    const csv = await svc.exportComplaintsCsv();
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const lines = csv.slice(1).split('\r\n');
    expect(lines[0]).toMatch(/^Complaint ID,Title,/);
    expect(lines[1]).toBe('1,"T, x",C,paper,low,new,A,Unknown,Unassigned,2024-01-02T00:00:00.000Z,,');
    expect(lines[2]).toBe('');
    expect(db.manyOrNone.mock.calls[0][1]).toEqual([]);
  });

  it('empty result is header only', async () => {
    db.manyOrNone.mockResolvedValue([]);
    const csv = await svc.exportComplaintsCsv({});
    expect(csv.slice(1).split('\r\n')).toHaveLength(2);
  });

  it('binds all filters in order and extends dateTo to end of day', async () => {
    db.manyOrNone.mockResolvedValue([]);
    await svc.exportComplaintsCsv({ status: 's', category: 'c', ward_id: '4', dateFrom: '2024-01-01', dateTo: '2024-01-31' });
    const [sql, params] = db.manyOrNone.mock.calls[0];
    expect(params).toHaveLength(5);
    expect(params.slice(0, 3)).toEqual(['s', 'c', 4]);
    expect(params[3]).toEqual(new Date('2024-01-01'));
    expect(params[4].getHours()).toBe(23);
    expect(params[4].getMilliseconds()).toBe(999);
    expect(sql).toContain('c.created_at <= $5');
  });

  it('ignores invalid ward_id and dates', async () => {
    db.manyOrNone.mockResolvedValue([]);
    await svc.exportComplaintsCsv({ ward_id: 'abc', dateFrom: 'nope', dateTo: 'nope' });
    expect(db.manyOrNone.mock.calls[0][1]).toEqual([]);
    await svc.exportComplaintsCsv({ ward_id: '1.5' });
    expect(db.manyOrNone.mock.calls[1][1]).toEqual([]);
  });
});

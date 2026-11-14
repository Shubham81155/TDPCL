jest.mock('../../src/config/database', () => ({
  db: { manyOrNone: jest.fn(), oneOrNone: jest.fn(), one: jest.fn(), none: jest.fn() },
  pgp: {},
}));
jest.mock('../../src/services/complaintService', () => ({}));
jest.mock('../../src/services/officerService', () => ({}));
jest.mock('../../src/middleware/auth', () => ({
  verifyToken: (req, res, next) => next(),
  checkRole: () => (req, res, next) => next(),
}));

const request = require('supertest');
const express = require('express');
const { db } = require('../../src/config/database');
const router = require('../../src/routes/admin');

const app = express();
app.use('/', router);

const row = (o = {}) => ({
  complaint_id: 1, title: 'Plain', citizen_name: 'Ann', category: 'garbage_heap',
  urgency_level: 'high', status: 'new', area: 'Zone A', ward_name: 'W1', officer_name: 'Off',
  created_at: new Date('2024-01-02T03:04:05.000Z'), assigned_at: null, resolved_at: null, ...o,
});

const get = (qs = '') =>
  request(app).get('/report/export' + qs).buffer(true).parse((res, cb) => {
    let d = ''; res.setEncoding('utf8'); res.on('data', (c) => (d += c)); res.on('end', () => cb(null, d));
  });

beforeEach(() => db.manyOrNone.mockReset());

describe('GET /report/export CSV', () => {
  test('headers, BOM, CRLF and trailing newline', async () => {
    db.manyOrNone.mockResolvedValue([row()]);
    const res = await get();
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toMatch(/text\/csv/);
    expect(res.headers['content-disposition']).toMatch(/attachment; filename="complaints-report.csv"/);
    const body = res.body;
    expect(body.charCodeAt(0)).toBe(0xfeff);
    expect(body.endsWith('\r\n')).toBe(true);
    const lines = body.slice(1).split('\r\n');
    expect(lines[0]).toBe('Complaint ID,Title,Citizen,Category,Urgency,Status,Area,Ward,Officer,Created At,Assigned At,Resolved At');
    expect(lines[1]).toBe('1,Plain,Ann,garbage_heap,high,new,Zone A,W1,Off,2024-01-02T03:04:05.000Z,,');
  });

  test('escapes commas, quotes, newlines; guards formulas; blanks nulls', async () => {
    db.manyOrNone.mockResolvedValue([
      row({ title: 'a,b', citizen_name: 'say "hi"', area: 'line1\nline2' }),
      row({ title: '=SUM(A1)', citizen_name: '+1', area: '-2', category: '@x', urgency_level: null, status: undefined }),
      row({ title: '=1,2', ward_name: null, officer_name: null }),
    ]);
    const body = (await get()).body;
    expect(body).toContain('"a,b"');
    expect(body).toContain('"say ""hi"""');
    expect(body).toContain('"line1\nline2"');
    expect(body).toContain(",'=SUM(A1),'+1,'@x,,,'-2,"); // formula guard; null urgency/status blank
    expect(body).toContain('"\'=1,2"'); // guard applied before quoting
    expect(body).toContain('Unknown,Unassigned'); // null ward/officer defaults
  });

  test('empty result gives header only', async () => {
    db.manyOrNone.mockResolvedValue([]);
    const lines = (await get()).body.slice(1).split('\r\n');
    expect(lines).toHaveLength(2);
    expect(lines[1]).toBe('');
  });

  test('filters passed as bound parameters, not concatenated', async () => {
    db.manyOrNone.mockResolvedValue([]);
    const evil = "new' OR '1'='1";
    await get(`?status=${encodeURIComponent(evil)}&category=garbage_heap&ward_id=3&dateFrom=2024-01-01&dateTo=2024-01-31`);
    const [sql, params] = db.manyOrNone.mock.calls[0];
    expect(sql).not.toContain(evil);
    expect(sql).not.toContain('garbage_heap');
    expect(sql).toMatch(/c\.status = \$1/);
    expect(sql).toMatch(/c\.category = \$2/);
    expect(sql).toMatch(/c\.ward_id = \$3/);
    expect(sql).toMatch(/c\.created_at >= \$4/);
    expect(sql).toMatch(/c\.created_at <= \$5/);
    expect(params.slice(0, 3)).toEqual([evil, 'garbage_heap', 3]);
    expect(params[3]).toBeInstanceOf(Date);
    expect(params[4]).toBeInstanceOf(Date);
    expect(params[4].getTime()).toBeGreaterThan(params[3].getTime());
  });

  test('invalid ward_id / dates are ignored; no filters means no params', async () => {
    db.manyOrNone.mockResolvedValue([]);
    await get('?ward_id=abc;DROP&dateFrom=notadate&dateTo=bad');
    const [sql, params] = db.manyOrNone.mock.calls[0];
    expect(params).toEqual([]);
    expect(sql).not.toContain('DROP');
  });

  test('db failure -> 400 JSON', async () => {
    db.manyOrNone.mockRejectedValue(new Error('db down'));
    const res = await request(app).get('/report/export');
    expect(res.status).toBe(400);
    expect(res.body).toEqual({ success: false, error: 'db down' });
  });
});

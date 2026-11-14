require('express-async-errors');
const request = require('supertest');
const express = require('express');
const AppError = require('../../src/utils/AppError');
const { parsePagination, parseId, parseOptionalDate, parseOptionalInt } = require('../../src/utils/pagination');

describe('AppError', () => {
  test('defaults and fields', () => {
    const e = new AppError('boom');
    expect(e).toBeInstanceOf(Error);
    expect(e.status).toBe(500);
    expect(e.isOperational).toBe(true);
    expect(e.details).toBeUndefined();
    expect(e.message).toBe('boom');
  });

  test('factories set status and details', () => {
    expect(AppError.badRequest('x', { a: 1 })).toMatchObject({ status: 400, details: { a: 1 } });
    expect(AppError.forbidden('x').status).toBe(403);
    expect(AppError.notFound('x').status).toBe(404);
    expect(AppError.conflict('x').status).toBe(409);
  });

  test('wrap passes AppError and constraint errors through, hides unknown errors', () => {
    const app = AppError.notFound('nope');
    expect(AppError.wrap(app, 'Failed')).toBe(app);
    const dbErr = Object.assign(new Error('dup'), { code: '23505' });
    expect(AppError.wrap(dbErr, 'Failed')).toBe(dbErr);
    const wrapped = AppError.wrap(new Error('secret SQL detail'), 'Failed to do X');
    expect(wrapped.message).toBe('Failed to do X');
    expect(wrapped.status).toBe(500);
    expect(wrapped.isOperational).toBe(false);
    expect(wrapped.cause.message).toBe('secret SQL detail');
  });
});

describe('parsePagination', () => {
  test('defaults', () => {
    expect(parsePagination({})).toEqual({ limit: 20, offset: 0 });
    expect(parsePagination(undefined, { defaultLimit: 100 })).toEqual({ limit: 100, offset: 0 });
  });

  test('clamps and is NaN-safe', () => {
    expect(parsePagination({ limit: '5000' })).toEqual({ limit: 100, offset: 0 });
    expect(parsePagination({ limit: '5000' }, { maxLimit: 1000 }).limit).toBe(1000);
    expect(parsePagination({ limit: '0' }).limit).toBe(1);
    expect(parsePagination({ limit: '-4', offset: '-9' })).toEqual({ limit: 1, offset: 0 });
    expect(parsePagination({ limit: 'abc', offset: 'x' }, { defaultLimit: 7 })).toEqual({ limit: 7, offset: 0 });
    expect(parsePagination({ limit: '10', offset: '30' })).toEqual({ limit: 10, offset: 30 });
  });
});

describe('id/date helpers', () => {
  test('parseId', () => {
    expect(parseId('12')).toBe(12);
    expect(() => parseId('abc', 'ward id')).toThrow('Invalid ward id');
    expect(() => parseId('0')).toThrow(AppError);
    expect(() => parseId('1.5')).toThrow(AppError);
  });

  test('parseOptionalInt / parseOptionalDate', () => {
    expect(parseOptionalInt('3')).toBe(3);
    expect(parseOptionalInt('x')).toBeNull();
    expect(parseOptionalInt(undefined)).toBeNull();
    expect(parseOptionalDate('')).toBeNull();
    expect(parseOptionalDate('2024-01-02')).toBeInstanceOf(Date);
    expect(() => parseOptionalDate('nope', 'dateFrom')).toThrow('Invalid dateFrom');
    // impossible calendar dates must not roll over silently
    expect(() => parseOptionalDate('2025-02-30', 'dateFrom')).toThrow('Invalid dateFrom');
    expect(() => parseOptionalDate('2025-13-01', 'dateTo')).toThrow('Invalid dateTo');
    expect(() => parseOptionalDate('2023-02-29', 'dateTo')).toThrow('Invalid dateTo');
    expect(parseOptionalDate('2024-02-29')).toBeInstanceOf(Date); // real leap day
    // full timestamps are still accepted
    expect(parseOptionalDate('2024-01-02T10:00:00Z')).toBeInstanceOf(Date);
  });
});

describe('AppError through a router', () => {
  const build = () => {
    const app = express();
    const router = express.Router();
    router.get('/missing', async () => {
      throw AppError.notFound('Complaint not found');
    });
    router.get('/conflict', async () => {
      throw new AppError('dup', 409, { field: 'name' });
    });
    router.get('/boom', async () => {
      throw new Error('internal');
    });
    app.use('/', router);
    // minimal local error handler mirroring the central one's contract
    // eslint-disable-next-line no-unused-vars
    app.use((err, req, res, next) => {
      const status = err.isOperational ? err.status : 500;
      res.status(status).json({
        success: false,
        error: err.isOperational ? err.message : 'Internal Server Error',
        ...(err.details !== undefined && { details: err.details }),
      });
    });
    return app;
  };

  test('404 AppError becomes 404 JSON', async () => {
    const res = await request(build()).get('/missing');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ success: false, error: 'Complaint not found' });
  });

  test('details are carried', async () => {
    const res = await request(build()).get('/conflict');
    expect(res.status).toBe(409);
    expect(res.body.details).toEqual({ field: 'name' });
  });

  test('unknown errors are 500 without leaking', async () => {
    const res = await request(build()).get('/boom');
    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Internal Server Error');
  });
});

describe('parseDateRange', () => {
  const { parseDateRange } = require('../../src/utils/pagination');
  test('empty -> nulls; valid -> Dates; invalid / reversed -> 400', () => {
    expect(parseDateRange({})).toEqual({ dateFrom: null, dateTo: null });
    expect(parseDateRange()).toEqual({ dateFrom: null, dateTo: null });
    expect(parseDateRange({ dateFrom: '2024-01-01', dateTo: '2024-01-01' }).dateTo).toBeInstanceOf(Date);
    expect(() => parseDateRange({ dateFrom: 'x' })).toThrow('Invalid dateFrom');
    expect(() => parseDateRange({ dateTo: 'x' })).toThrow('Invalid dateTo');
    expect(() => parseDateRange({ dateFrom: '2024-02-01', dateTo: '2024-01-01' })).toThrow(/must not be after/);
  });
});

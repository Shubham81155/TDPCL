jest.mock('../../../src/config/database', () => ({ db: { none: jest.fn(), oneOrNone: jest.fn() } }));
jest.mock('../../../src/utils/logger', () => ({ warn: jest.fn(), info: jest.fn(), error: jest.fn(), debug: jest.fn() }));
jest.mock('../../../src/services/garbageClassifierService', () => ({
  classifyGarbageImage: jest.fn(),
  isClassifierEnabled: jest.fn(),
}));

const { db } = require('../../../src/config/database');
const logger = require('../../../src/utils/logger');
const classifier = require('../../../src/services/garbageClassifierService');
const svc = require('../../../src/services/classificationService');

const params = { complaintId: 7, buffer: Buffer.from('x'), fileName: 'a.png' };
const flush = () => new Promise((r) => setImmediate(r));

beforeEach(() => {
  jest.clearAllMocks();
  classifier.isClassifierEnabled.mockReturnValue(true);
  db.none.mockResolvedValue();
});

describe('classifyAndStore', () => {
  it('writes label and confidence for the complaint, and nothing else', async () => {
    classifier.classifyGarbageImage.mockResolvedValue({ label: 'litter', category: 'litter', confidence: 0.9, source: 'model' });
    await expect(svc.classifyAndStore(params)).resolves.toBe(true);
    expect(classifier.classifyGarbageImage).toHaveBeenCalledWith(params.buffer, 'a.png');
    expect(db.none).toHaveBeenCalledTimes(1);
    expect(db.none).toHaveBeenCalledWith(svc.UPDATE_SQL, ['litter', 0.9, 7]);
    expect(svc.UPDATE_SQL).not.toMatch(/category\s*=/);
    expect(svc.UPDATE_SQL).not.toMatch(/SET\s+category/);
  });

  it('does nothing when disabled', async () => {
    classifier.isClassifierEnabled.mockReturnValue(false);
    await expect(svc.classifyAndStore(params)).resolves.toBe(false);
    expect(classifier.classifyGarbageImage).not.toHaveBeenCalled();
    expect(db.none).not.toHaveBeenCalled();
  });

  it('logs once and writes nothing on a fallback result', async () => {
    classifier.classifyGarbageImage.mockResolvedValue({ source: 'fallback', warning: 'timed out' });
    await expect(svc.classifyAndStore(params)).resolves.toBe(false);
    expect(db.none).not.toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn.mock.calls[0][1]).toMatchObject({ complaintId: 7, reason: 'timed out' });
  });

  it('reports missing model/script when fallback has no warning', async () => {
    classifier.classifyGarbageImage.mockResolvedValue({ source: 'fallback' });
    await svc.classifyAndStore(params);
    expect(logger.warn.mock.calls[0][1].reason).toMatch(/not found/);
  });

  it('never throws when the DB update fails', async () => {
    classifier.classifyGarbageImage.mockResolvedValue({ label: 'a', confidence: 0.1, source: 'model' });
    db.none.mockRejectedValue(new Error('db down'));
    await expect(svc.classifyAndStore(params)).resolves.toBe(false);
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('never throws when the classifier itself throws', async () => {
    classifier.classifyGarbageImage.mockRejectedValue(new Error('boom'));
    await expect(svc.classifyAndStore(params)).resolves.toBe(false);
  });
});

describe('scheduleClassification', () => {
  it('returns synchronously and runs the work afterwards', async () => {
    classifier.classifyGarbageImage.mockResolvedValue({ label: 'a', confidence: 0.5, source: 'model' });
    expect(svc.scheduleClassification(params)).toBeUndefined();
    expect(classifier.classifyGarbageImage).not.toHaveBeenCalled();
    await flush();
    await flush();
    expect(db.none).toHaveBeenCalledWith(svc.UPDATE_SQL, ['a', 0.5, 7]);
  });

  it('does not schedule anything when disabled', async () => {
    classifier.isClassifierEnabled.mockReturnValue(false);
    svc.scheduleClassification(params);
    await flush();
    expect(classifier.classifyGarbageImage).not.toHaveBeenCalled();
  });

  it('never throws even if the enabled check throws', () => {
    classifier.isClassifierEnabled.mockImplementation(() => { throw new Error('x'); });
    expect(() => svc.scheduleClassification(params)).not.toThrow();
    expect(logger.warn).toHaveBeenCalled();
  });
});

const { EventEmitter } = require('events');

jest.mock('child_process', () => ({ spawn: jest.fn() }));
jest.mock('fs', () => {
  const real = jest.requireActual('fs');
  return {
    ...real,
    existsSync: jest.fn(),
    promises: { ...real.promises, writeFile: jest.fn(), unlink: jest.fn() },
  };
});

const fs = require('fs');
const { spawn } = require('child_process');
const { classifyGarbageImage } = require('../../../src/services/garbageClassifierService');

const fakeChild = ({ stdout = '', stderr = '', code = 0, error } = {}) => {
  const child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  setImmediate(() => {
    if (error) return child.emit('error', error);
    if (stdout) child.stdout.emit('data', Buffer.from(stdout));
    if (stderr) child.stderr.emit('data', Buffer.from(stderr));
    return child.emit('close', code);
  });
  return child;
};

beforeEach(() => {
  jest.clearAllMocks();
  fs.existsSync.mockReturnValue(true);
  fs.promises.writeFile.mockResolvedValue();
  fs.promises.unlink.mockResolvedValue();
});

const FALLBACK = { label: 'Unclassified', category: 'unclassified', confidence: 0, source: 'fallback' };

it('falls back when model or script is missing', async () => {
  fs.existsSync.mockReturnValue(false);
  expect(await classifyGarbageImage(Buffer.from('x'))).toEqual(FALLBACK);
  expect(spawn).not.toHaveBeenCalled();
});

it('returns normalised model output', async () => {
  spawn.mockReturnValue(fakeChild({ stdout: JSON.stringify({ label: 'Plastic Bottle', category: 'Plastic Bottle!', confidence: 0.9 }) }));
  const r = await classifyGarbageImage(Buffer.from('x'), 'pic.png');
  expect(r).toEqual({ label: 'Plastic Bottle', category: 'plastic_bottle', confidence: 0.9, source: 'model' });
  expect(fs.promises.writeFile.mock.calls[0][0]).toMatch(/\.png$/);
  expect(fs.promises.unlink).toHaveBeenCalled();
});

it('rejects sparse/invalid output (strict validation)', async () => {
  spawn.mockReturnValueOnce(fakeChild({ stdout: JSON.stringify({ label: 'Glass' }) }));
  expect(await classifyGarbageImage(Buffer.from('x'))).toMatchObject({ source: 'fallback' });
  spawn.mockReturnValueOnce(fakeChild({ stdout: '{}' }));
  expect(await classifyGarbageImage(Buffer.from('x'))).toMatchObject({ label: 'Unclassified', category: 'unclassified', source: 'fallback' });
});

it.each([
  ['non-zero exit with stderr', { code: 1, stderr: 'boom' }, 'boom'],
  ['non-zero exit without stderr', { code: 2 }, 'exited with code 2'],
  ['invalid json', { stdout: 'not json' }, 'Invalid classifier output'],
  ['spawn error', { error: new Error('ENOENT') }, 'ENOENT'],
  ['error field in output', { stdout: JSON.stringify({ error: 'bad model' }) }, 'bad model'],
])('falls back on %s', async (_n, opts, warning) => {
  spawn.mockReturnValue(fakeChild(opts));
  const r = await classifyGarbageImage(Buffer.from('x'));
  expect(r).toMatchObject(FALLBACK);
  expect(r.warning).toContain(warning);
});

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
const svc = require('../../../src/services/garbageClassifierService');

const ENV_KEYS = ['CLASSIFIER_ENABLED', 'GARBAGE_MODEL_PATH', 'PYTHON_EXECUTABLE', 'CLASSIFIER_SCRIPT', 'CLASSIFIER_TIMEOUT_MS', 'GARBAGE_CLASS_LABELS'];
let saved;

const child = ({ stdout, stderr, code = 0, never = false } = {}) => {
  const c = new EventEmitter();
  c.stdout = new EventEmitter();
  c.stderr = new EventEmitter();
  c.kill = jest.fn();
  if (!never) {
    setImmediate(() => {
      if (stdout !== undefined) c.stdout.emit('data', Buffer.from(stdout));
      if (stderr) c.stderr.emit('data', Buffer.from(stderr));
      c.emit('close', code);
    });
  }
  return c;
};

beforeEach(() => {
  saved = {};
  ENV_KEYS.forEach((k) => { saved[k] = process.env[k]; delete process.env[k]; });
  jest.clearAllMocks();
  fs.existsSync.mockReturnValue(true);
  fs.promises.writeFile.mockResolvedValue();
  fs.promises.unlink.mockResolvedValue();
});
afterEach(() => {
  ENV_KEYS.forEach((k) => { if (saved[k] === undefined) delete process.env[k]; else process.env[k] = saved[k]; });
});

describe('isClassifierEnabled', () => {
  it('true when CLASSIFIER_ENABLED=true even if the model is missing', () => {
    process.env.CLASSIFIER_ENABLED = 'true';
    fs.existsSync.mockReturnValue(false);
    expect(svc.isClassifierEnabled()).toBe(true);
  });
  it('false when explicitly disabled even if the model exists', () => {
    process.env.CLASSIFIER_ENABLED = 'false';
    expect(svc.isClassifierEnabled()).toBe(false);
  });
  it('auto-detects the model file when unset', () => {
    fs.existsSync.mockReturnValue(true);
    expect(svc.isClassifierEnabled()).toBe(true);
    fs.existsSync.mockReturnValue(false);
    expect(svc.isClassifierEnabled()).toBe(false);
  });
});

describe('classifyGarbageImage', () => {
  it('falls back without spawning when the model is absent', async () => {
    fs.existsSync.mockReturnValue(false);
    const r = await svc.classifyGarbageImage(Buffer.from('x'));
    expect(r).toEqual({ label: 'Unclassified', category: 'unclassified', confidence: 0, source: 'fallback' });
    expect(spawn).not.toHaveBeenCalled();
    expect(fs.promises.writeFile).not.toHaveBeenCalled();
  });

  it('honours PYTHON_EXECUTABLE / CLASSIFIER_SCRIPT and omits -u for non-python scripts', async () => {
    process.env.PYTHON_EXECUTABLE = 'node';
    process.env.CLASSIFIER_SCRIPT = '/x/fake_classifier.js';
    process.env.GARBAGE_MODEL_PATH = '/m/model.h5';
    spawn.mockReturnValue(child({ stdout: '{"label":"litter","category":"litter","confidence":0.5}' }));
    const r = await svc.classifyGarbageImage(Buffer.from('x'), 'a.png');
    expect(r).toEqual({ label: 'litter', category: 'litter', confidence: 0.5, source: 'model' });
    const [cmd, args] = spawn.mock.calls[0];
    expect(cmd).toBe('node');
    expect(args).not.toContain('-u');
    expect(args[0]).toMatch(/fake_classifier\.js$/);
    expect(args).toEqual(expect.arrayContaining(['--model', '/m/model.h5', '--image']));
  });

  it('uses -u for the default python script and passes labels', async () => {
    process.env.GARBAGE_CLASS_LABELS = 'a,b';
    spawn.mockReturnValue(child({ stdout: '{"label":"a","confidence":1}' }));
    await svc.classifyGarbageImage(Buffer.from('x'));
    const [cmd, args] = spawn.mock.calls[0];
    expect(cmd).toBe('python');
    expect(args[0]).toBe('-u');
    expect(args[args.length - 1]).toBe('a,b');
  });

  it('parses the last stdout line when libraries print noise first', async () => {
    spawn.mockReturnValue(child({ stdout: 'warming up\n{"label":"glass","confidence":0.7}\n' }));
    expect(await svc.classifyGarbageImage(Buffer.from('x'))).toMatchObject({ label: 'glass', source: 'model' });
  });

  it.each([
    ['confidence > 1', { label: 'a', confidence: 1.5 }],
    ['confidence < 0', { label: 'a', confidence: -0.1 }],
    ['confidence string', { label: 'a', confidence: '0.9' }],
    ['confidence NaN-ish', { label: 'a', confidence: null }],
    ['label too long', { label: 'x'.repeat(101), confidence: 0.5 }],
    ['label not a string', { label: 5, confidence: 0.5 }],
    ['empty label', { label: '  ', confidence: 0.5 }],
    ['array', [1, 2]],
  ])('rejects bad output: %s', async (_n, out) => {
    spawn.mockReturnValue(child({ stdout: JSON.stringify(out) }));
    const r = await svc.classifyGarbageImage(Buffer.from('x'));
    expect(r.source).toBe('fallback');
    expect(r.warning).toMatch(/Invalid classifier output/);
  });

  it('rejects non-JSON output', async () => {
    spawn.mockReturnValue(child({ stdout: 'garbage {{' }));
    expect((await svc.classifyGarbageImage(Buffer.from('x'))).warning).toMatch(/Invalid classifier output/);
  });

  it('kills the child and falls back on timeout; temp file still removed', async () => {
    jest.useFakeTimers();
    try {
      process.env.CLASSIFIER_TIMEOUT_MS = '500';
      const c = child({ never: true });
      spawn.mockReturnValue(c);
      const p = svc.classifyGarbageImage(Buffer.from('x'));
      await jest.advanceTimersByTimeAsync(10); // let writeFile resolve and spawn happen
      await jest.advanceTimersByTimeAsync(600);
      const r = await p;
      expect(c.kill).toHaveBeenCalledWith('SIGKILL');
      expect(r).toMatchObject({ source: 'fallback' });
      expect(r.warning).toMatch(/timed out after 500ms/);
      expect(fs.promises.unlink).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('defaults timeout to 20000 for invalid values', () => {
    expect(svc.getTimeoutMs()).toBe(20000);
    process.env.CLASSIFIER_TIMEOUT_MS = 'abc';
    expect(svc.getTimeoutMs()).toBe(20000);
    process.env.CLASSIFIER_TIMEOUT_MS = '1234';
    expect(svc.getTimeoutMs()).toBe(1234);
  });

  it('always deletes the temp file, on success and on failure', async () => {
    spawn.mockReturnValueOnce(child({ stdout: '{"label":"a","confidence":0.1}' }));
    await svc.classifyGarbageImage(Buffer.from('x'));
    spawn.mockReturnValueOnce(child({ code: 1, stderr: 'boom' }));
    await svc.classifyGarbageImage(Buffer.from('x'));
    expect(fs.promises.unlink).toHaveBeenCalledTimes(2);
    const written = fs.promises.writeFile.mock.calls.map((c) => c[0]);
    expect(fs.promises.unlink.mock.calls.map((c) => c[0])).toEqual(written);
  });

  it('falls back (and still cleans up) when writing the temp file fails', async () => {
    fs.promises.writeFile.mockRejectedValue(new Error('disk full'));
    const r = await svc.classifyGarbageImage(Buffer.from('x'));
    expect(r.warning).toBe('disk full');
    expect(spawn).not.toHaveBeenCalled();
    expect(fs.promises.unlink).toHaveBeenCalled();
  });

  it('survives unlink failure', async () => {
    fs.promises.unlink.mockRejectedValue(new Error('locked'));
    spawn.mockReturnValue(child({ stdout: '{"label":"a","confidence":0.1}' }));
    await expect(svc.classifyGarbageImage(Buffer.from('x'))).resolves.toMatchObject({ source: 'model' });
  });
});

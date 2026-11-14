// src/services/garbageClassifierService.js
// Runs the optional TensorFlow garbage classifier (scripts/classify_garbage.py) as a child process.
//
// Stdout contract (one JSON object on stdout, exit code 0):
//   { "label": string, "category": string, "confidence": number }
// On failure the script prints { "error": string } and exits 1.
//
// Configuration is read from process.env at call time:
//   CLASSIFIER_ENABLED, GARBAGE_MODEL_PATH, PYTHON_EXECUTABLE, CLASSIFIER_SCRIPT,
//   CLASSIFIER_TIMEOUT_MS, GARBAGE_CLASS_LABELS.

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');

const DEFAULT_CATEGORY = 'unclassified';
const DEFAULT_LABEL = 'Unclassified';
const DEFAULT_TIMEOUT_MS = 20000;
const MAX_LABEL_LENGTH = 100;
const MAX_STDOUT_BYTES = 64 * 1024;

const normalizeCategory = (value = '') => {
  const normalized = value
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

  return normalized || DEFAULT_CATEGORY;
};

const getModelPath = () =>
  process.env.GARBAGE_MODEL_PATH || path.resolve(__dirname, '../../../garbage_classifier.h5');

const getScriptPath = () =>
  process.env.CLASSIFIER_SCRIPT
    ? path.resolve(process.env.CLASSIFIER_SCRIPT)
    : path.resolve(__dirname, '../../scripts/classify_garbage.py');

const getTimeoutMs = () => {
  const n = Number(process.env.CLASSIFIER_TIMEOUT_MS);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_TIMEOUT_MS;
};

const fallback = (warning) => ({
  label: DEFAULT_LABEL,
  category: DEFAULT_CATEGORY,
  confidence: 0,
  source: 'fallback',
  ...(warning && { warning }),
});

// Enabled when CLASSIFIER_ENABLED=true, or when it is unset and the model file exists.
// Any other explicit value (false, 0, ...) disables it.
const isClassifierEnabled = () => {
  const flag = process.env.CLASSIFIER_ENABLED;
  if (flag !== undefined && flag !== '') {
    return String(flag).trim().toLowerCase() === 'true';
  }
  return fs.existsSync(getModelPath());
};

// Strict validation of the script JSON. Returns { label, category, confidence } or throws.
const validateOutput = (output) => {
  if (!output || typeof output !== 'object' || Array.isArray(output)) {
    throw new Error('Invalid classifier output: not an object');
  }
  if (output.error) {
    throw new Error(String(output.error));
  }
  const { label, category, confidence } = output;
  if (typeof label !== 'string' || !label.trim() || label.trim().length > MAX_LABEL_LENGTH) {
    throw new Error('Invalid classifier output: bad label');
  }
  if (typeof confidence !== 'number' || !Number.isFinite(confidence) || confidence < 0 || confidence > 1) {
    throw new Error('Invalid classifier output: bad confidence');
  }
  return {
    label: label.trim(),
    category: normalizeCategory(typeof category === 'string' && category ? category : label),
    confidence,
  };
};

const parseStdout = (stdout) => {
  const text = stdout.trim();
  try {
    return JSON.parse(text);
  } catch (e) {
    // Tolerate library noise on stdout: the contract JSON is the last non-empty line.
    const lines = text.split(/\r?\n/).filter(Boolean);
    try {
      return JSON.parse(lines[lines.length - 1]);
    } catch (e2) {
      throw new Error(`Invalid classifier output: ${text.slice(0, 200) || e.message}`);
    }
  }
};

const runChild = (command, args, timeoutMs) =>
  new Promise((resolve, reject) => {
    let settled = false;
    let timer;
    const done = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      fn(value);
    };

    const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
    let stdout = '';
    let stderr = '';

    timer = setTimeout(() => {
      try { child.kill('SIGKILL'); } catch (e) { /* already gone */ }
      done(reject, new Error(`Classifier timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stdout.on('data', (chunk) => {
      if (stdout.length < MAX_STDOUT_BYTES) stdout += chunk.toString();
    });
    child.stderr.on('data', (chunk) => {
      if (stderr.length < MAX_STDOUT_BYTES) stderr += chunk.toString();
    });
    child.on('error', (error) => done(reject, error));
    child.on('close', (code) => {
      if (code !== 0) {
        done(reject, new Error(stderr || `Classifier exited with code ${code}`));
        return;
      }
      try {
        done(resolve, parseStdout(stdout));
      } catch (error) {
        done(reject, error);
      }
    });
  });

/**
 * Classify an image buffer. Never throws: any failure yields the 'fallback' result
 * (with a `warning`). When the model or script file is absent nothing is spawned.
 */
const classifyGarbageImage = async (imageBuffer, fileName = 'upload.jpg') => {
  const modelPath = getModelPath();
  const scriptPath = getScriptPath();

  if (!fs.existsSync(modelPath) || !fs.existsSync(scriptPath)) {
    return fallback();
  }

  const extension = path.extname(fileName) || '.jpg';
  const tempFilePath = path.join(
    os.tmpdir(),
    `garbage-${Date.now()}-${crypto.randomBytes(6).toString('hex')}${extension}`
  );

  try {
    await fs.promises.writeFile(tempFilePath, imageBuffer);

    const pythonCommand = process.env.PYTHON_EXECUTABLE || 'python';
    const labels = process.env.GARBAGE_CLASS_LABELS || '';
    // '-u' (unbuffered) is a python flag; node (used by the test stand-in) rejects it.
    const interpreterArgs = scriptPath.toLowerCase().endsWith('.py') ? ['-u'] : [];
    const args = [...interpreterArgs, scriptPath, '--model', modelPath, '--image', tempFilePath, '--labels', labels];

    const output = await runChild(pythonCommand, args, getTimeoutMs());
    return { ...validateOutput(output), source: 'model' };
  } catch (error) {
    return fallback(error.message);
  } finally {
    await fs.promises.unlink(tempFilePath).catch(() => null);
  }
};

module.exports = {
  classifyGarbageImage,
  isClassifierEnabled,
  validateOutput,
  getModelPath,
  getScriptPath,
  getTimeoutMs,
};

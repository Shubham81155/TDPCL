const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

const DEFAULT_CATEGORY = 'unclassified';
const DEFAULT_LABEL = 'Unclassified';

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

const getScriptPath = () => path.resolve(__dirname, '../../scripts/classify_garbage.py');

const classifyGarbageImage = async (imageBuffer, fileName = 'upload.jpg') => {
  const modelPath = getModelPath();
  const scriptPath = getScriptPath();

  if (!fs.existsSync(modelPath) || !fs.existsSync(scriptPath)) {
    return {
      label: DEFAULT_LABEL,
      category: DEFAULT_CATEGORY,
      confidence: 0,
      source: 'fallback',
    };
  }

  const extension = path.extname(fileName) || '.jpg';
  const tempFilePath = path.join(os.tmpdir(), `garbage-${Date.now()}${extension}`);

  await fs.promises.writeFile(tempFilePath, imageBuffer);

  try {
    const pythonCommand = process.env.PYTHON_EXECUTABLE || 'python';
    const labels = process.env.GARBAGE_CLASS_LABELS || '';

    const output = await new Promise((resolve, reject) => {
      const child = spawn(pythonCommand, ['-u', scriptPath, '--model', modelPath, '--image', tempFilePath, '--labels', labels], {
        stdio: ['ignore', 'pipe', 'pipe'],
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (chunk) => {
        stdout += chunk.toString();
      });

      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      child.on('error', (error) => {
        reject(error);
      });

      child.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(stderr || `Classifier exited with code ${code}`));
          return;
        }

        try {
          resolve(JSON.parse(stdout.trim()));
        } catch (error) {
          reject(new Error(`Invalid classifier output: ${stdout || error.message}`));
        }
      });
    });

    if (output.error) {
      throw new Error(output.error);
    }

    return {
      label: output.label || DEFAULT_LABEL,
      category: normalizeCategory(output.category || output.label),
      confidence: Number(output.confidence || 0),
      source: 'model',
    };
  } catch (error) {
    return {
      label: DEFAULT_LABEL,
      category: DEFAULT_CATEGORY,
      confidence: 0,
      source: 'fallback',
      warning: error.message,
    };
  } finally {
    fs.promises.unlink(tempFilePath).catch(() => null);
  }
};

module.exports = {
  classifyGarbageImage,
};

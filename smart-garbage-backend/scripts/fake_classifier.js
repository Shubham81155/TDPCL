#!/usr/bin/env node
// Test-only stand-in for scripts/classify_garbage.py. Same CLI and stdout contract:
//   args: --model <path> --image <path> [--labels csv]
//   stdout: {"label": string, "category": string, "confidence": number}  (exit 0)
//   failure: {"error": string} (exit 1)
// Env knobs: FAKE_CLASSIFIER_DELAY_MS, FAKE_CLASSIFIER_MODE=ok|crash|garbage|hang,
//            FAKE_CLASSIFIER_PIDFILE (append own pid, for leak checks).
const fs = require('fs');

const arg = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
};

if (process.env.FAKE_CLASSIFIER_PIDFILE) {
  try { fs.appendFileSync(process.env.FAKE_CLASSIFIER_PIDFILE, `${process.pid}\n`); } catch (e) { /* ignore */ }
}

const mode = process.env.FAKE_CLASSIFIER_MODE || 'ok';
const delay = Number(process.env.FAKE_CLASSIFIER_DELAY_MS) || 0;

setTimeout(() => {
  const image = arg('image');
  if (!image || !fs.existsSync(image)) {
    console.log(JSON.stringify({ error: 'image not found' }));
    process.exit(1);
  }
  if (mode === 'crash') {
    console.error('fake classifier crashed');
    process.exit(3);
  }
  if (mode === 'hang') {
    setInterval(() => {}, 1000); // never exits on its own; the caller must kill it
    return;
  }
  if (mode === 'garbage') {
    console.log('this is not json {{{');
    return;
  }
  const labels = (arg('labels') || 'garbage_heap,litter,dumping_site').split(',').filter(Boolean);
  const label = labels[0] || 'garbage_heap';
  console.log(JSON.stringify({ label, category: label.toLowerCase().replace(/[^a-z0-9]+/g, '_'), confidence: 0.8765 }));
}, delay);

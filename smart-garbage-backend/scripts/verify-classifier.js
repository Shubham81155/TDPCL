#!/usr/bin/env node
// End-to-end proof of the optional classifier wiring WITHOUT the real TensorFlow model.
// Starts a second backend (PORT=5056) pointed at scripts/fake_classifier.js, creates tagged
// temporary DB rows, submits real multipart complaints and asserts behaviour. Always cleans up.
//
//   node scripts/verify-classifier.js
//
// Exit code 0 only if every assertion passed and 0 tagged rows / files / child processes remain.

const { spawn } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const bcrypt = require('bcryptjs');

const ROOT = path.resolve(__dirname, '..');
process.chdir(ROOT);
require('dotenv').config({ path: path.join(ROOT, '.env') });
const { db, pgp } = require('../src/config/database');

const PORT = 5056;
const BASE = `http://127.0.0.1:${PORT}`;
const TAG = `clfverify${Date.now()}`;
const EMAIL = `${TAG}@example.com`;
const PASSWORD = 'Verify#12345';
const FAKE = path.join(__dirname, 'fake_classifier.js');
const IMAGE = path.join(ROOT, 'complaint_test.png');
const UPLOAD_DIR = path.join(ROOT, 'uploads', 'complaints');
const PIDFILE = path.join(os.tmpdir(), `${TAG}-pids.txt`);
const TIMEOUT_MS = 3000;
const CITIZEN_CATEGORY = 'plastics';

const children = new Set();
const failures = [];
const uploadedFiles = new Set();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const check = (name, cond, detail = '') => {
  console.log(`  [${cond ? 'PASS' : 'FAIL'}] ${name}${detail ? ` (${detail})` : ''}`);
  if (!cond) failures.push(name);
};
const tempImages = () => new Set(fs.readdirSync(os.tmpdir()).filter((f) => /^garbage-.*\.(png|jpg)$/.test(f)));
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch (e) { return e.code === 'EPERM'; } };

const startServer = (extraEnv) =>
  new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['src/index.js'], {
      cwd: ROOT,
      env: {
        ...process.env,
        PORT: String(PORT),
        HOST: '127.0.0.1',
        NODE_ENV: 'development',
        LOG_LEVEL: 'info',
        CLASSIFIER_ENABLED: 'true',
        PYTHON_EXECUTABLE: 'node',
        CLASSIFIER_SCRIPT: FAKE,
        GARBAGE_MODEL_PATH: FAKE,
        CLASSIFIER_TIMEOUT_MS: String(TIMEOUT_MS),
        FAKE_CLASSIFIER_PIDFILE: PIDFILE,
        ...extraEnv,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });
    children.add(child);
    child.logs = '';
    const onData = (d) => {
      child.logs += d.toString();
      if (child.logs.includes('Server listening')) resolve(child);
    };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('exit', (code) => {
      children.delete(child);
      reject(new Error(`server exited early (${code}): ${child.logs.slice(-500)}`));
    });
    setTimeout(() => reject(new Error(`server start timeout: ${child.logs.slice(-500)}`)), 30000);
  });

const stopServer = async (child) => {
  if (!child) return;
  child.removeAllListeners('exit');
  child.kill();
  await new Promise((r) => { child.once('exit', r); setTimeout(r, 3000); });
  if (child.exitCode === null) child.kill('SIGKILL');
  children.delete(child);
};

const login = async () => {
  const res = await fetch(`${BASE}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  });
  const json = await res.json();
  const token = json.accessToken || json.token || json.access_token;
  if (!token) throw new Error(`login failed: ${res.status} ${JSON.stringify(json)}`);
  return token;
};

const submit = async (token, title) => {
  const form = new FormData();
  form.append('image', new Blob([fs.readFileSync(IMAGE)], { type: 'image/png' }), 'complaint_test.png');
  form.append('latitude', '19.0760');
  form.append('longitude', '72.8777');
  form.append('category', CITIZEN_CATEGORY);
  form.append('title', `${TAG} ${title}`);
  form.append('description', `${TAG} classifier verification`);
  const start = Date.now();
  const res = await fetch(`${BASE}/api/complaints`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
  const ms = Date.now() - start;
  const json = await res.json().catch(() => ({}));
  const id = json.complaint && json.complaint.complaint_id;
  if (json.complaint && json.complaint.image_path) uploadedFiles.add(path.basename(json.complaint.image_path));
  return { status: res.status, ms, id, json };
};

const getRow = (id) =>
  db.one('SELECT category, classified_label, classification_confidence FROM complaints WHERE complaint_id = $1', [id]);

const waitForLabel = async (id, maxMs) => {
  const end = Date.now() + maxMs;
  while (Date.now() < end) {
    const row = await getRow(id);
    if (row.classified_label !== null) return row;
    await sleep(150);
  }
  return getRow(id);
};

const scenario = async (name, env, fn) => {
  console.log(`\nScenario: ${name}`);
  let server;
  try {
    server = await startServer(env);
    const token = await login();
    await fn(token, server);
  } catch (err) {
    check(`${name} ran without error`, false, err.message);
  } finally {
    await stopServer(server);
  }
};

const cleanup = async () => {
  for (const c of children) { try { c.kill('SIGKILL'); } catch (e) { /* gone */ } }
  children.clear();
  let leftover = -1;
  try {
    const users = await db.any('SELECT user_id FROM users WHERE email LIKE $1', [`${TAG}%`]);
    const ids = users.map((u) => u.user_id);
    if (ids.length) {
      const complaints = await db.any('SELECT complaint_id, image_path FROM complaints WHERE user_id IN ($1:csv)', [ids]);
      complaints.forEach((c) => c.image_path && uploadedFiles.add(path.basename(c.image_path)));
      const cids = complaints.map((c) => c.complaint_id);
      if (cids.length) await db.none('DELETE FROM complaint_history WHERE complaint_id IN ($1:csv)', [cids]);
      if (cids.length) await db.none('DELETE FROM notifications WHERE complaint_id IN ($1:csv)', [cids]).catch(() => null);
      await db.none('DELETE FROM complaints WHERE user_id IN ($1:csv)', [ids]);
      await db.none('DELETE FROM user_preferences WHERE user_id IN ($1:csv)', [ids]);
      await db.none('DELETE FROM audit_logs WHERE user_id IN ($1:csv)', [ids]);
      await db.none('DELETE FROM password_resets WHERE user_id IN ($1:csv)', [ids]);
      await db.none('DELETE FROM users WHERE user_id IN ($1:csv)', [ids]);
    }
    for (const f of uploadedFiles) fs.rmSync(path.join(UPLOAD_DIR, f), { force: true });
    fs.rmSync(PIDFILE, { force: true });
    const left = await db.one(
      `SELECT (SELECT count(*) FROM users WHERE email LIKE $1)
            + (SELECT count(*) FROM complaints WHERE title LIKE $2) AS n`,
      [`${TAG}%`, `${TAG}%`]
    );
    const files = [...uploadedFiles].filter((f) => fs.existsSync(path.join(UPLOAD_DIR, f))).length;
    leftover = Number(left.n) + files;
  } catch (err) {
    console.error('cleanup error:', err.message);
  }
  console.log(`\nLeftover tagged rows/files: ${leftover}`);
  if (leftover !== 0) failures.push('cleanup leftover != 0');
  try { pgp.end(); } catch (e) { /* ignore */ }
};

(async () => {
  console.log(`Classifier verification (tag ${TAG}, stand-in classifier, NOT the real model)`);
  const tmpBefore = tempImages();
  try {
    const user = await db.one(
      `INSERT INTO users (name, email, phone, password_hash, role, status)
       VALUES ($1, $2, $3, $4, 'citizen', 'active') RETURNING user_id`,
      [`${TAG} citizen`, EMAIL, '9000000000', await bcrypt.hash(PASSWORD, 8)]
    );
    console.log(`created temp citizen user_id=${user.user_id}`);

    await scenario('ok + slow classifier (delay 2500ms)', { FAKE_CLASSIFIER_DELAY_MS: '2500', CLASSIFIER_TIMEOUT_MS: '20000' }, async (token) => {
      const r = await submit(token, 'slow-ok');
      check('HTTP 201', r.status === 201, `status ${r.status}`);
      check('response returned before classifier finished (< 1500ms vs 2500ms delay)', r.ms < 1500, `${r.ms}ms`);
      const immediate = await getRow(r.id);
      check('columns still NULL immediately after response', immediate.classified_label === null);
      const row = await waitForLabel(r.id, 10000);
      check('classified_label filled', row.classified_label === 'garbage_heap', String(row.classified_label));
      check('classification_confidence filled', Number(row.classification_confidence) === 0.8765, String(row.classification_confidence));
      check('citizen category unchanged', row.category === CITIZEN_CATEGORY, row.category);
    });

    for (const [mode, extra] of [['crash', {}], ['garbage', {}], ['hang', {}]]) {
      await scenario(`FAKE_CLASSIFIER_MODE=${mode}`, { FAKE_CLASSIFIER_MODE: mode, ...extra }, async (token, server) => {
        const r = await submit(token, mode);
        check('HTTP 201', r.status === 201, `status ${r.status}`);
        check('response fast', r.ms < 1500, `${r.ms}ms`);
        // hang: wait past the 3000ms timeout so the kill has happened
        await sleep(mode === 'hang' ? TIMEOUT_MS + 2500 : 2500);
        const row = await getRow(r.id);
        check('classified_label stays NULL', row.classified_label === null);
        check('classification_confidence stays NULL', row.classification_confidence === null);
        check('citizen category unchanged', row.category === CITIZEN_CATEGORY, row.category);
        const warned = /image classification skipped/.test(server.logs);
        const warnCount = (server.logs.match(/image classification skipped/g) || []).length;
        check('failure logged exactly once via structured logger', warned && warnCount === 1, `count ${warnCount}`);
        if (mode === 'hang') check('timeout reported', /timed out/.test(server.logs));
      });
    }

    console.log('\nLeak checks');
    await sleep(500);
    const pids = fs.existsSync(PIDFILE) ? fs.readFileSync(PIDFILE, 'utf8').split(/\s+/).filter(Boolean).map(Number) : [];
    check('fake classifier processes were spawned', pids.length >= 4, `${pids.length} spawned`);
    const stillAlive = pids.filter(alive);
    check('no classifier child process left running', stillAlive.length === 0, stillAlive.join(','));
    const newTemp = [...tempImages()].filter((f) => !tmpBefore.has(f));
    check('no temp image files remain', newTemp.length === 0, newTemp.join(','));
  } catch (err) {
    check('verification setup', false, err.stack || err.message);
  } finally {
    await cleanup();
  }
  console.log(failures.length ? `\nFAILED: ${failures.join('; ')}` : '\nALL CHECKS PASSED');
  process.exit(failures.length ? 1 : 0);
})();

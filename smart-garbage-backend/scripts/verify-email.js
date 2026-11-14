#!/usr/bin/env node
// scripts/verify-email.js
// End-to-end proof that email delivery works: local SMTP sink + a second backend instance (PORT 5055)
// + tagged temporary DB users. Cleans up everything it created. Exit code != 0 on any failed assertion.
// Usage: node scripts/verify-email.js   (see docs/EMAIL.md)

const path = require('node:path');
const fs = require('node:fs');
const { spawn } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..');
require('dotenv').config({ path: path.join(ROOT, '.env') });

const bcrypt = require('bcryptjs');
const pgp = require('pg-promise')();
const { createSink } = require('./dev-smtp-sink');

const SMTP_PORT = parseInt(process.env.SINK_SMTP_PORT, 10) || 1025;
const HTTP_PORT = parseInt(process.env.SINK_HTTP_PORT, 10) || 8025;
const APP_PORT = 5055;
const BASE = `http://127.0.0.1:${APP_PORT}`;
const TAG = `emailverify_${Date.now()}`;
const PASSWORD = 'Verify#12345';
const NEW_PASSWORD = 'NewVerify#678';
const XSS_NAME = `<script>alert("${TAG}")</script>`;
const FRONTEND = 'http://localhost:3000';

const db = pgp({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'smart_garbage_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
});

let passed = 0;
let failed = 0;
const check = (name, ok, detail = '') => {
  if (ok) { passed += 1; console.log(`  PASS ${name}`); }
  else { failed += 1; console.log(`  FAIL ${name}${detail ? ` -> ${detail}` : ''}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const waitFor = async (fn, timeoutMs = 20000, stepMs = 200) => {
  const end = Date.now() + timeoutMs;
  for (;;) {
    const v = await fn();
    if (v) return v;
    if (Date.now() > end) return null;
    await sleep(stepMs);
  }
};

const emailOf = (role) => `${TAG}_${role}@verify.example.com`.toLowerCase();
const mailTo = (sink, addr, subjectPart) =>
  sink.messages.find(
    (m) => m.to.some((t) => t.toLowerCase() === String(addr).toLowerCase()) && (!subjectPart || m.subject.includes(subjectPart))
  );

const post = (url, body, headers = {}) =>
  fetch(`${BASE}${url}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });

const cleanup = async () => {
  const users = await db.any('SELECT user_id FROM users WHERE email LIKE $1', [`${TAG}%`]);
  const ids = users.map((u) => u.user_id);
  if (ids.length) {
    const complaints = await db.any('SELECT complaint_id, image_path FROM complaints WHERE user_id IN ($1:csv)', [ids]);
    for (const c of complaints) {
      const base = path.basename(String(c.image_path || ''));
      const file = path.join(ROOT, 'uploads', 'complaints', base);
      if (base && fs.existsSync(file)) fs.unlinkSync(file);
    }
    const cids = complaints.map((c) => c.complaint_id);
    if (cids.length) {
      await db.none('DELETE FROM complaint_history WHERE complaint_id IN ($1:csv)', [cids]);
      await db.none('DELETE FROM notifications WHERE complaint_id IN ($1:csv)', [cids]);
    }
    await db.none('DELETE FROM complaint_history WHERE changed_by IN ($1:csv)', [ids]);
    await db.none('DELETE FROM complaints WHERE user_id IN ($1:csv)', [ids]);
    await db.none('DELETE FROM notification_logs WHERE user_id IN ($1:csv)', [ids]);
    await db.none('DELETE FROM notifications WHERE user_id IN ($1:csv)', [ids]);
    await db.none('DELETE FROM officers WHERE user_id IN ($1:csv)', [ids]);
    await db.none('DELETE FROM user_preferences WHERE user_id IN ($1:csv)', [ids]);
    await db.none('DELETE FROM audit_logs WHERE user_id IN ($1:csv)', [ids]);
    await db.none('DELETE FROM password_resets WHERE user_id IN ($1:csv)', [ids]);
    await db.none('DELETE FROM users WHERE user_id IN ($1:csv)', [ids]);
  }
  const left = await db.one(
    `SELECT (SELECT COUNT(*) FROM users WHERE email LIKE $1)
          + (SELECT COUNT(*) FROM complaints WHERE title LIKE $1) AS n`,
    [`${TAG}%`]
  );
  return Number(left.n);
};

const main = async () => {
  const sink = createSink({ smtpPort: SMTP_PORT, httpPort: HTTP_PORT });
  let child;
  let childLog = '';
  let sinkRunning = false;
  let leftover = -1;

  try {
    await sink.start();
    sinkRunning = true;
    console.log(`sink up: SMTP ${SMTP_PORT}, HTTP ${HTTP_PORT}`);

    child = spawn(process.execPath, ['src/index.js'], {
      cwd: ROOT,
      env: {
        ...process.env,
        PORT: String(APP_PORT),
        NODE_ENV: 'development',
        EMAIL_SERVICE: 'smtp',
        SMTP_HOST: '127.0.0.1',
        SMTP_PORT: String(SMTP_PORT),
        SMTP_SECURE: 'false',
        EMAIL_FROM: 'noreply@test.local',
        FRONTEND_URL: FRONTEND,
        PUBLIC_FILE_BASE_URL: BASE,
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    child.stdout.on('data', (d) => { childLog += d; });
    child.stderr.on('data', (d) => { childLog += d; });
    const up = await waitFor(async () => {
      try { return (await fetch(`${BASE}/health`)).ok; } catch (e) { return false; }
    }, 30000);
    if (!up) throw new Error(`backend on ${APP_PORT} did not start\n${childLog}`);
    console.log(`backend up on ${APP_PORT}`);

    // --- tagged users ---
    const hash = await bcrypt.hash(PASSWORD, 10);
    const mk = (role, name) =>
      db.one(
        `INSERT INTO users (name, email, phone, password_hash, role, status)
         VALUES ($1, $2, '9000000000', $3, $4, 'active') RETURNING user_id`,
        [name, emailOf(role), hash, role]
      );
    await mk('citizen', XSS_NAME);
    await mk('admin', `${TAG} Admin`);
    const officerUser = await mk('officer', `${TAG} Officer`);
    await db.none(`INSERT INTO officers (user_id, employee_id, status) VALUES ($1, $2, 'active')`, [
      officerUser.user_id,
      TAG.slice(0, 50),
    ]);

    // --- (a) forgot / reset password ---
    console.log('(a) password reset');
    const fp = await post('/api/auth/forgot-password', { email: emailOf('citizen') });
    check('forgot-password returns 200', fp.status === 200, String(fp.status));
    const resetMail = await waitFor(() => mailTo(sink, emailOf('citizen'), 'Reset your password'));
    check('reset mail captured for citizen', !!resetMail);
    if (resetMail) {
      check('from is EMAIL_FROM', resetMail.from === 'noreply@test.local', resetMail.from);
      const m = resetMail.body.match(/href="([^"]*\/reset-password\?token=([0-9a-f]+))"/);
      check('link uses FRONTEND_URL and /reset-password?token=', !!m && m[1].startsWith(`${FRONTEND}/reset-password?token=`), m && m[1]);
      if (m) {
        const rp = await post('/api/auth/reset-password', { token: m[2], newPassword: NEW_PASSWORD });
        check('token from mail works with reset-password', rp.status === 200, `${rp.status} ${await rp.text()}`);
        const relogin = await post('/api/auth/login', { email: emailOf('citizen'), password: NEW_PASSWORD });
        check('login with the new password works', relogin.status === 200, String(relogin.status));
        const reuse = await post('/api/auth/reset-password', { token: m[2], newPassword: 'Another#678' });
        check('token cannot be reused', reuse.status === 400, String(reuse.status));
      }
    }

    // --- (b) complaint submission ---
    console.log('(b) complaint submission');
    const login = await post('/api/auth/login', { email: emailOf('citizen'), password: NEW_PASSWORD });
    const lj = await login.json();
    const token = lj.accessToken || lj.token;
    check('citizen login returns token', !!token);
    sink.messages.length = 0;
    const png = fs.readFileSync(path.join(ROOT, 'complaint_test.png'));
    const form = new FormData();
    form.append('image', new Blob([png], { type: 'image/png' }), 'complaint_test.png');
    form.append('latitude', '19.0760');
    form.append('longitude', '72.8777');
    form.append('category', 'plastics');
    form.append('title', `${TAG} complaint`);
    form.append('description', 'email verification');
    const sub = await fetch(`${BASE}/api/complaints`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    const sj = await sub.json().catch(() => ({}));
    check('complaint submitted (201)', sub.status === 201, `${sub.status} ${JSON.stringify(sj)}`);
    const result = sj.complaint || {};
    const cid = result.complaint_id;
    check('complaint id returned', !!cid);

    if (cid) {
      const citizenMail = await waitFor(() => mailTo(sink, emailOf('citizen'), `Complaint #${cid} Submitted`));
      check('citizen confirmation mail captured', !!citizenMail);

      const officer = result.officer;
      if (officer && officer.email) {
        const om = await waitFor(() => mailTo(sink, officer.email, `New Complaint Assigned: #${cid}`));
        check(`officer assignment mail captured (${officer.email})`, !!om);
      } else {
        console.log('  SKIP officer assignment mail (no officer assigned)');
      }

      const admins = await db.any(`SELECT email FROM users WHERE role = 'admin' AND email IS NOT NULL`);
      const missing = [];
      for (const a of admins) {
        const got = await waitFor(() => mailTo(sink, a.email, `New Complaint Submitted: #${cid}`), 20000);
        if (!got) missing.push(a.email);
      }
      check(`admin notification mail for every admin (${admins.length})`, missing.length === 0, `missing: ${missing.join(',')}`);
      check('tagged admin received notification', !!mailTo(sink, emailOf('admin'), `New Complaint Submitted: #${cid}`));

      // --- (c) escaping ---
      console.log('(c) HTML escaping');
      const adminMail = mailTo(sink, emailOf('admin'), `#${cid}`);
      const bodies = [citizenMail, adminMail].filter(Boolean).map((m) => m.body);
      check(
        'escaped name present in received mail',
        bodies.some((b) => b.includes('&lt;script&gt;alert(&quot;')),
        bodies.map((b) => b.slice(0, 200)).join('|')
      );
      check('no raw <script> in any received mail', !sink.messages.some((m) => m.body.includes('<script>')));
    }

    // --- (d) delivery failure does not break requests ---
    console.log('(d) sink stopped');
    await sink.stop();
    sinkRunning = false;
    const t0 = Date.now();
    const fp2 = await post('/api/auth/forgot-password', { email: emailOf('citizen') });
    const dt = Date.now() - t0;
    check('forgot-password still 200 with sink down', fp2.status === 200, String(fp2.status));
    check(`responds quickly (${dt} ms < 5000)`, dt < 5000);
  } catch (err) {
    failed += 1;
    console.log(`  FAIL unexpected error: ${err.stack || err.message}`);
    if (childLog) console.log(`--- backend log ---\n${childLog.slice(-3000)}`);
  } finally {
    if (child && child.exitCode === null) {
      child.kill();
      await sleep(500);
      if (child.exitCode === null && process.platform === 'win32') {
        spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
      }
    }
    if (sinkRunning) await sink.stop().catch(() => {});
    await sleep(500); // let any fire-and-forget DB writes of the child settle before deleting
    try { leftover = await cleanup(); } catch (e) { console.log(`cleanup error: ${e.message}`); }
    console.log(`cleanup: leftover tagged rows = ${leftover}`);
    if (leftover !== 0) failed += 1;
    pgp.end();
  }
  console.log(`\n${passed} passed, ${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
};

main();

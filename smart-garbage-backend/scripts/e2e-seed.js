#!/usr/bin/env node
/* eslint-disable no-console */
// scripts/e2e-seed.js
//
// Creates / removes the TAGGED fixtures used by the Cypress E2E suite.
//
//   node scripts/e2e-seed.js up     create (or refresh) users + ward, write the credentials fixture
//   node scripts/e2e-seed.js down   delete EVERYTHING tagged, print leftover counts (must be 0)
//
// Tagging (what makes cleanup exact):
//   users   : email LIKE 'e2e\_%@example.com'   (the seeded ones plus anything the specs register/create)
//   wards   : city  = 'e2e_city'                (the seeded ward plus any ward the specs create)
//   officers: employee_id LIKE 'E2E-%' or owned by a tagged user
// Nothing else is ever touched, so it is safe to run next to real data.
//
// Env:
//   E2E_PASSWORD      shared password for the seeded users (default below; must be >= 6 chars)
//   E2E_FIXTURE_PATH  where to write the credentials JSON
//                     (default ../../smart-garbage-frontend/cypress/fixtures/users.generated.json)
// DB connection comes from the backend .env (same variables the API uses).

const path = require('path');
const fs = require('fs');

require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const bcrypt = require('bcryptjs');
const { db, pgp } = require('../src/config/database');

const DEFAULT_PASSWORD = 'E2e!Passw0rd#2026';
const PASSWORD = process.env.E2E_PASSWORD || DEFAULT_PASSWORD;

const EMAIL_PATTERN = 'e2e\\_%@example.com'; // LIKE pattern, backslash escapes the underscore
const WARD_CITY = 'e2e_city';
const WARD_NAME = 'e2e_ward_seed';
const WARD_STATE = 'e2e_state';
// Small bounding box (south, west, north, east) in the Gulf of Guinea: no real ward overlaps it.
const BBOX = { south: 0.1, west: 0.1, north: 0.11, east: 0.11 };
const CENTER = { latitude: 0.105, longitude: 0.105 };

const UPLOAD_ROOT = path.resolve(__dirname, '../uploads');
const FIXTURE_PATH = path.resolve(
  process.env.E2E_FIXTURE_PATH ||
    path.join(__dirname, '../../smart-garbage-frontend/cypress/fixtures/users.generated.json')
);

const USERS = [
  { key: 'admin', name: 'E2E Admin', email: 'e2e_admin@example.com', role: 'admin', phone: '9000000001' },
  { key: 'officer', name: 'E2E Officer', email: 'e2e_officer@example.com', role: 'officer', phone: '9000000002' },
  { key: 'citizen', name: 'E2E Citizen', email: 'e2e_citizen@example.com', role: 'citizen', phone: '9000000003' },
];

// ---------------------------------------------------------------- helpers

const taggedUserIds = (t) => `SELECT user_id FROM users WHERE email LIKE '${EMAIL_PATTERN}'`;
const taggedWardIds = `SELECT ward_id FROM wards WHERE city = '${WARD_CITY}'`;

// Resolve an image URL stored in the DB to a file inside uploads/ (never outside it).
const uploadFileFor = (imagePath) => {
  if (!imagePath) return null;
  const marker = '/uploads/';
  const idx = String(imagePath).indexOf(marker);
  if (idx === -1) return null; // e.g. an S3 URL: not ours to delete
  const rel = decodeURIComponent(String(imagePath).slice(idx + marker.length).split('?')[0]);
  const target = path.resolve(UPLOAD_ROOT, rel);
  if (!target.startsWith(UPLOAD_ROOT + path.sep)) return null;
  return target;
};

const countLeftovers = async (t) => {
  const q = async (sql) => Number((await t.one(sql)).n);
  return {
    users: await q(`SELECT count(*) AS n FROM users WHERE email LIKE '${EMAIL_PATTERN}'`),
    officers: await q(
      `SELECT count(*) AS n FROM officers WHERE employee_id LIKE 'E2E-%' OR user_id IN (${taggedUserIds()})`
    ),
    wards: await q(`SELECT count(*) AS n FROM wards WHERE city = '${WARD_CITY}'`),
    complaints: await q(
      `SELECT count(*) AS n FROM complaints WHERE user_id IN (${taggedUserIds()}) OR ward_id IN (${taggedWardIds})`
    ),
    complaint_history: await q(
      `SELECT count(*) AS n FROM complaint_history
        WHERE changed_by IN (${taggedUserIds()})
           OR complaint_id IN (SELECT complaint_id FROM complaints WHERE user_id IN (${taggedUserIds()}))`
    ),
    user_preferences: await q(`SELECT count(*) AS n FROM user_preferences WHERE user_id IN (${taggedUserIds()})`),
    audit_logs: await q(`SELECT count(*) AS n FROM audit_logs WHERE user_id IN (${taggedUserIds()})`),
    password_resets: await q(`SELECT count(*) AS n FROM password_resets WHERE user_id IN (${taggedUserIds()})`),
    notifications: await q(`SELECT count(*) AS n FROM notifications WHERE user_id IN (${taggedUserIds()})`),
    notification_logs: await q(`SELECT count(*) AS n FROM notification_logs WHERE user_id IN (${taggedUserIds()})`),
  };
};

// ---------------------------------------------------------------- down

const down = async () => {
  const files = [];
  const deleted = {};

  await db.tx(async (t) => {
    const del = async (label, sql) => {
      const r = await t.result(sql);
      deleted[label] = r.rowCount;
    };

    // Remember image files before the complaint rows disappear.
    const imgs = await t.manyOrNone(
      `SELECT image_path, resolution_image_path FROM complaints
        WHERE user_id IN (${taggedUserIds()}) OR ward_id IN (${taggedWardIds})`
    );
    imgs.forEach((r) => {
      [r.image_path, r.resolution_image_path].forEach((p) => {
        const f = uploadFileFor(p);
        if (f) files.push(f);
      });
    });

    const complaintIds = `SELECT complaint_id FROM complaints
                           WHERE user_id IN (${taggedUserIds()}) OR ward_id IN (${taggedWardIds})`;

    await del('notifications', `DELETE FROM notifications WHERE user_id IN (${taggedUserIds()}) OR complaint_id IN (${complaintIds})`);
    await del('notification_logs', `DELETE FROM notification_logs WHERE user_id IN (${taggedUserIds()})`);
    await del(
      'complaint_history',
      `DELETE FROM complaint_history WHERE complaint_id IN (${complaintIds}) OR changed_by IN (${taggedUserIds()})`
    );
    await del(
      'complaints',
      `DELETE FROM complaints WHERE user_id IN (${taggedUserIds()}) OR ward_id IN (${taggedWardIds})`
    );
    await del('audit_logs', `DELETE FROM audit_logs WHERE user_id IN (${taggedUserIds()})`);
    await del('password_resets', `DELETE FROM password_resets WHERE user_id IN (${taggedUserIds()})`);
    await del('user_preferences', `DELETE FROM user_preferences WHERE user_id IN (${taggedUserIds()})`);
    await del(
      'officers',
      `DELETE FROM officers WHERE employee_id LIKE 'E2E-%' OR user_id IN (${taggedUserIds()})`
    );
    await del('users', `DELETE FROM users WHERE email LIKE '${EMAIL_PATTERN}'`);
    // Real officers that were pointed at a tagged ward (should never happen) must not block the delete.
    await t.none(`UPDATE officers SET assigned_ward_id = NULL WHERE assigned_ward_id IN (${taggedWardIds})`);
    await del('wards', `DELETE FROM wards WHERE city = '${WARD_CITY}'`);
  });

  let filesRemoved = 0;
  [...new Set(files)].forEach((f) => {
    try {
      fs.unlinkSync(f);
      filesRemoved += 1;
    } catch (e) {
      if (e.code !== 'ENOENT') console.warn(`could not remove ${f}: ${e.message}`);
    }
  });

  try {
    fs.unlinkSync(FIXTURE_PATH);
  } catch (e) {
    /* already gone */
  }

  const leftover = await countLeftovers(db);
  console.log('[e2e-seed] down: rows deleted', JSON.stringify(deleted));
  console.log(`[e2e-seed] down: upload files removed: ${filesRemoved}`);
  console.log('[e2e-seed] down: leftover counts', JSON.stringify(leftover));
  const total = Object.values(leftover).reduce((a, b) => a + b, 0);
  if (total !== 0) {
    console.error(`[e2e-seed] down: FAILED, ${total} tagged row(s) remain`);
    process.exitCode = 1;
  } else {
    console.log('[e2e-seed] down: OK, 0 leftovers');
  }
};

// ---------------------------------------------------------------- up

const up = async () => {
  const hash = await bcrypt.hash(PASSWORD, 10);

  const out = await db.tx(async (t) => {
    // Ward (idempotent by name+city, case-insensitive like the unique index).
    let ward = await t.oneOrNone(
      'SELECT ward_id FROM wards WHERE LOWER(name) = LOWER($1) AND LOWER(city) = LOWER($2)',
      [WARD_NAME, WARD_CITY]
    );
    if (ward) {
      await t.none(
        `UPDATE wards SET state = $2, boundaries = ST_MakeEnvelope($3, $4, $5, $6, 4326) WHERE ward_id = $1`,
        [ward.ward_id, WARD_STATE, BBOX.west, BBOX.south, BBOX.east, BBOX.north]
      );
    } else {
      ward = await t.one(
        `INSERT INTO wards (name, city, state, boundaries)
         VALUES ($1, $2, $3, ST_MakeEnvelope($4, $5, $6, $7, 4326)) RETURNING ward_id`,
        [WARD_NAME, WARD_CITY, WARD_STATE, BBOX.west, BBOX.south, BBOX.east, BBOX.north]
      );
    }

    const created = {};
    for (const u of USERS) {
      const row = await t.one(
        `INSERT INTO users (name, email, phone, password_hash, role, status)
         VALUES ($1, $2, $3, $4, $5, 'active')
         ON CONFLICT (email) DO UPDATE
           SET name = EXCLUDED.name, phone = EXCLUDED.phone, password_hash = EXCLUDED.password_hash,
               role = EXCLUDED.role, status = 'active', deleted_at = NULL
         RETURNING user_id`,
        [u.name, u.email, u.phone, hash, u.role]
      );
      created[u.key] = { ...u, user_id: row.user_id };
    }

    const officer = await t.one(
      `INSERT INTO officers (user_id, employee_id, assigned_ward_id, assigned_area_name, year_of_joining, status, location)
       VALUES ($1, 'E2E-0001', $2, 'E2E Area', 2020, 'active', ST_SetSRID(ST_MakePoint($3, $4), 4326))
       ON CONFLICT (user_id) DO UPDATE
         SET employee_id = EXCLUDED.employee_id, assigned_ward_id = EXCLUDED.assigned_ward_id,
             assigned_area_name = EXCLUDED.assigned_area_name, status = 'active', location = EXCLUDED.location
       RETURNING officer_id`,
      [created.officer.user_id, ward.ward_id, CENTER.longitude, CENTER.latitude]
    );
    created.officer.officer_id = officer.officer_id;

    return { created, ward_id: ward.ward_id };
  });

  const fixture = {
    password: PASSWORD,
    ward: { ward_id: out.ward_id, name: WARD_NAME, city: WARD_CITY, ...BBOX, ...CENTER },
    tags: { emailPrefix: 'e2e_', wardCity: WARD_CITY },
  };
  USERS.forEach((u) => {
    const c = out.created[u.key];
    fixture[u.key] = {
      user_id: c.user_id,
      officer_id: c.officer_id,
      name: u.name,
      email: u.email,
      role: u.role,
      password: PASSWORD,
    };
  });

  fs.mkdirSync(path.dirname(FIXTURE_PATH), { recursive: true });
  fs.writeFileSync(FIXTURE_PATH, JSON.stringify(fixture, null, 2));
  console.log(`[e2e-seed] up: ok (users: ${USERS.map((u) => u.email).join(', ')}; ward_id ${out.ward_id})`);
  console.log(`[e2e-seed] up: credentials written to ${FIXTURE_PATH}`);
};

// ---------------------------------------------------------------- main

const main = async () => {
  const cmd = process.argv[2];
  if (cmd !== 'up' && cmd !== 'down') {
    console.error('usage: node scripts/e2e-seed.js <up|down>');
    process.exitCode = 2;
    return;
  }
  if (PASSWORD.length < 6) {
    console.error('E2E_PASSWORD must be at least 6 characters');
    process.exitCode = 2;
    return;
  }
  if (process.env.NODE_ENV === 'production') {
    console.error('refusing to run against NODE_ENV=production');
    process.exitCode = 2;
    return;
  }
  try {
    await (cmd === 'up' ? up() : down());
  } catch (err) {
    console.error(`[e2e-seed] ${cmd} failed:`, err.message);
    process.exitCode = 1;
  } finally {
    pgp.end();
  }
};

main();

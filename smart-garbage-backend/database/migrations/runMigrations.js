// database/migrations/runMigrations.js
// Applies the *.sql files in this folder in name order, once each.
// Usage: npm run migrate
// Applied files are recorded in the schema_migrations table. If the database
// already contains the schema (created before this runner existed), the
// files that were applied by hand (001-004) are recorded as applied.

const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { db, pgp } = require('../../src/config/database');

const BASELINE = [
  '001_initial_schema.sql',
  '002_sample_data.sql',
  '003_test_users.sql',
  '004_add_ai_classification_fields.sql',
];

(async () => {
  try {
    await db.none(`CREATE TABLE IF NOT EXISTS schema_migrations (
      filename VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )`);

    const applied = new Set((await db.manyOrNone('SELECT filename FROM schema_migrations')).map((r) => r.filename));
    const hasSchema = (await db.one("SELECT to_regclass('public.users') IS NOT NULL AS ok")).ok;

    if (applied.size === 0 && hasSchema) {
      for (const f of BASELINE) {
        await db.none('INSERT INTO schema_migrations(filename) VALUES($1) ON CONFLICT DO NOTHING', [f]);
        applied.add(f);
      }
      console.log('Existing schema detected: recorded 001-004 as already applied');
    }

    const files = fs.readdirSync(__dirname).filter((f) => f.endsWith('.sql')).sort();
    let ran = 0;
    for (const file of files) {
      if (applied.has(file)) continue;
      const sql = fs.readFileSync(path.join(__dirname, file), 'utf8');
      await db.tx(async (t) => {
        await t.none(sql);
        await t.none('INSERT INTO schema_migrations(filename) VALUES($1)', [file]);
      });
      console.log(`Applied ${file}`);
      ran += 1;
    }
    console.log(ran ? `Done: ${ran} migration(s) applied` : 'Database is up to date');
    pgp.end();
  } catch (err) {
    console.error('Migration failed:', err.message);
    pgp.end();
    process.exit(1);
  }
})();

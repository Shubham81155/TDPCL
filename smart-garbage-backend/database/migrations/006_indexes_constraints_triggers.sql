-- 006_indexes_constraints_triggers.sql
-- Idempotent hardening migration. Safe to run repeatedly (IF NOT EXISTS / guarded DO blocks).
--
-- 1. INDEXES (driven by WHERE/JOIN/ORDER BY in src/):
--    idx_complaints_ward_id            complaints.ward_id filter + wards LEFT JOIN complaints (admin stats, list filters)
--    idx_complaints_officer_status     (assigned_officer_id, status): workload counts, officer complaint lists
--    idx_complaints_status_created     (status, created_at DESC): filtered lists ORDER BY created_at DESC LIMIT n
--    idx_complaints_category           category filter / GROUP BY category
--    idx_officers_ward_status          (assigned_ward_id, status): ward officer lookups, ward filter on officer list
--    idx_officers_status               officers.status = 'active' (assignment, stats)
--    idx_password_resets_expires_unused  partial index on unused tokens (cleanup / expiry scans)
--    idx_users_email_lower             authService forgot-password does LOWER(email) = LOWER($1); plain email index can't serve it
--    DROP idx_users_email              redundant: users.email already has a UNIQUE constraint (own index).
--    (audit_logs(entity_type, entity_id) intentionally NOT added: columns are only selected, never filtered on.)
--    (idx_complaints_officer_id from 001 is now a strict prefix of idx_complaints_officer_status; kept to stay non-destructive.)
--
-- 2. WARD DUPLICATE RACE: UNIQUE (lower(name), lower(city)) on wards. wardService does check-then-insert,
--    which races; the unique index makes the DB the arbiter. Pre-existing case-insensitive duplicates are
--    renamed ("<name> (duplicate <ward_id>)", lowest ward_id keeps its name) with a NOTICE, or, if the session
--    sets  SET sg.abort_on_ward_duplicates = 'on'  the migration aborts with a clear message listing them.
--
-- 3. CHECK CONSTRAINTS the app already guarantees, added NOT VALID (enforced for new rows immediately),
--    then VALIDATEd only if no existing row violates them (otherwise a WARNING, constraint stays NOT VALID,
--    so legacy data can never break the migration). Status/urgency values are already enforced by the
--    complaint_status / urgency_level / officer_status / user_status / user_role ENUM types.
--
-- 4. updated_at maintenance: set_updated_at() trigger function (no-op for rows without an updated_at field)
--    plus BEFORE UPDATE triggers on every table that actually has an updated_at column.

-- ---------------------------------------------------------------- 1. indexes
CREATE INDEX IF NOT EXISTS idx_complaints_ward_id         ON complaints(ward_id);
CREATE INDEX IF NOT EXISTS idx_complaints_officer_status  ON complaints(assigned_officer_id, status);
CREATE INDEX IF NOT EXISTS idx_complaints_status_created  ON complaints(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_complaints_category        ON complaints(category);
CREATE INDEX IF NOT EXISTS idx_officers_ward_status       ON officers(assigned_ward_id, status);
CREATE INDEX IF NOT EXISTS idx_officers_status            ON officers(status);
CREATE INDEX IF NOT EXISTS idx_password_resets_expires_unused
    ON password_resets(expires_at) WHERE used_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_email_lower          ON users(LOWER(email));
DROP INDEX IF EXISTS idx_users_email;

-- ---------------------------------------------------------------- 2. unique wards
DO $$
DECLARE
    dup RECORD;
    n   INTEGER := 0;
BEGIN
    IF to_regclass('public.uq_wards_name_city_ci') IS NOT NULL THEN
        RETURN;
    END IF;

    IF current_setting('sg.abort_on_ward_duplicates', true) = 'on' THEN
        SELECT count(*) INTO n FROM wards w
         WHERE EXISTS (SELECT 1 FROM wards o
                        WHERE LOWER(o.name) = LOWER(w.name) AND LOWER(o.city) = LOWER(w.city)
                          AND o.ward_id < w.ward_id);
        IF n > 0 THEN
            RAISE EXCEPTION 'Migration 006 aborted: % duplicate ward row(s) differ only by case in (name, city). Merge or rename them, then re-run.', n;
        END IF;
    END IF;

    FOR dup IN
        SELECT w.ward_id, w.name FROM wards w
         WHERE EXISTS (SELECT 1 FROM wards o
                        WHERE LOWER(o.name) = LOWER(w.name) AND LOWER(o.city) = LOWER(w.city)
                          AND o.ward_id < w.ward_id)
         ORDER BY w.ward_id
    LOOP
        UPDATE wards SET name = dup.name || ' (duplicate ' || dup.ward_id || ')'
         WHERE ward_id = dup.ward_id;
        RAISE NOTICE 'Renamed duplicate ward % ("%") to "% (duplicate %)"', dup.ward_id, dup.name, dup.name, dup.ward_id;
    END LOOP;

    CREATE UNIQUE INDEX uq_wards_name_city_ci ON wards (LOWER(name), LOWER(city));
END $$;

-- ---------------------------------------------------------------- 3. checks
DO $$
DECLARE
    c RECORD;
    bad BIGINT;
BEGIN
    FOR c IN
        SELECT * FROM (VALUES
            ('complaints',      'chk_complaints_latitude',   'latitude BETWEEN -90 AND 90'),
            ('complaints',      'chk_complaints_longitude',  'longitude BETWEEN -180 AND 180'),
            ('complaints',      'chk_complaints_confidence', 'classification_confidence IS NULL OR classification_confidence BETWEEN 0 AND 1'),
            ('officers',        'chk_officers_year_joined',  'year_of_joining IS NULL OR year_of_joining BETWEEN 1950 AND 2100'),
            ('password_resets', 'chk_password_resets_expiry','created_at IS NULL OR expires_at > created_at')
        ) AS t(tbl, cname, expr)
    LOOP
        IF EXISTS (SELECT 1 FROM pg_constraint
                    WHERE conname = c.cname AND conrelid = ('public.' || c.tbl)::regclass) THEN
            CONTINUE;
        END IF;
        EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I CHECK (%s) NOT VALID', c.tbl, c.cname, c.expr);
        EXECUTE format('SELECT count(*) FROM %I WHERE NOT (%s)', c.tbl, c.expr) INTO bad;
        IF bad = 0 THEN
            EXECUTE format('ALTER TABLE %I VALIDATE CONSTRAINT %I', c.tbl, c.cname);
        ELSE
            RAISE WARNING 'Constraint % left NOT VALID: % existing row(s) in % violate it (new rows are still checked)', c.cname, bad, c.tbl;
        END IF;
    END LOOP;
END $$;

-- ---------------------------------------------------------------- 4. updated_at triggers
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
BEGIN
    -- no-op if the table has no updated_at column
    IF to_jsonb(NEW) ? 'updated_at' THEN
        NEW.updated_at := CURRENT_TIMESTAMP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
    t RECORD;
BEGIN
    FOR t IN
        SELECT c.table_name FROM information_schema.columns c
          JOIN information_schema.tables tb
            ON tb.table_schema = c.table_schema AND tb.table_name = c.table_name AND tb.table_type = 'BASE TABLE'
         WHERE c.table_schema = 'public' AND c.column_name = 'updated_at'
    LOOP
        IF NOT EXISTS (SELECT 1 FROM pg_trigger
                        WHERE tgname = 'trg_' || t.table_name || '_updated_at'
                          AND tgrelid = ('public.' || quote_ident(t.table_name))::regclass) THEN
            EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()',
                           'trg_' || t.table_name || '_updated_at', t.table_name);
        END IF;
    END LOOP;
END $$;

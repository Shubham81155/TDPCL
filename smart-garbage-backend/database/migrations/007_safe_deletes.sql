-- 007_safe_deletes.sql
-- Make deleting officers and users safe.
--
-- Problem: complaints.assigned_officer_id, complaint_history.changed_by and
-- audit_logs.user_id referenced officers/users with NO ACTION, so deleting an
-- officer who ever handled a complaint (or a user who ever changed a status)
-- failed with a foreign-key error. History and audit rows must outlive the
-- person, so the reference is nulled instead of blocking the delete.
--
-- Also adds the missing foreign key officers.assigned_ward_id -> wards.
-- It is added NOT VALID (checks new rows) and only validated when the existing
-- data is clean, so orphaned legacy rows cannot make the migration fail.
-- Idempotent: safe to run more than once.

DO $$
BEGIN
  -- complaints.assigned_officer_id -> officers ON DELETE SET NULL
  ALTER TABLE complaints DROP CONSTRAINT IF EXISTS complaints_assigned_officer_id_fkey;
  ALTER TABLE complaints
    ADD CONSTRAINT complaints_assigned_officer_id_fkey
    FOREIGN KEY (assigned_officer_id) REFERENCES officers(officer_id) ON DELETE SET NULL;

  -- complaint_history.changed_by -> users ON DELETE SET NULL
  ALTER TABLE complaint_history DROP CONSTRAINT IF EXISTS complaint_history_changed_by_fkey;
  ALTER TABLE complaint_history
    ADD CONSTRAINT complaint_history_changed_by_fkey
    FOREIGN KEY (changed_by) REFERENCES users(user_id) ON DELETE SET NULL;

  -- audit_logs.user_id -> users ON DELETE SET NULL
  ALTER TABLE audit_logs DROP CONSTRAINT IF EXISTS audit_logs_user_id_fkey;
  ALTER TABLE audit_logs
    ADD CONSTRAINT audit_logs_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES users(user_id) ON DELETE SET NULL;
END $$;

DO $$
DECLARE
  orphans integer;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'officers_assigned_ward_id_fkey') THEN
    ALTER TABLE officers
      ADD CONSTRAINT officers_assigned_ward_id_fkey
      FOREIGN KEY (assigned_ward_id) REFERENCES wards(ward_id) ON DELETE SET NULL NOT VALID;
  END IF;

  SELECT count(*) INTO orphans
  FROM officers o
  WHERE o.assigned_ward_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM wards w WHERE w.ward_id = o.assigned_ward_id);

  IF orphans = 0 THEN
    ALTER TABLE officers VALIDATE CONSTRAINT officers_assigned_ward_id_fkey;
  ELSE
    RAISE WARNING 'officers_assigned_ward_id_fkey left NOT VALID: % officer(s) point to a missing ward', orphans;
  END IF;
END $$;

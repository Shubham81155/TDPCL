-- 008_unique_email_lower.sql
-- One mailbox, one account: users.email is already UNIQUE, but only case-sensitively, so
-- "Jane@x.com" and "jane@x.com" could both register. The application now stores and matches emails in
-- lower case; this adds the database guarantee.
--
-- Safe on existing data: if legacy rows already collide ignoring case, the index is NOT created
-- (and a warning lists the colliding addresses) so the migration still succeeds. Merge or rename
-- those accounts, then re-run this statement by hand:
--   CREATE UNIQUE INDEX uq_users_email_lower ON users (LOWER(email));
DO $$
DECLARE
  dupes text;
BEGIN
  SELECT string_agg(e, ', ') INTO dupes
  FROM (
    SELECT LOWER(email) AS e FROM users GROUP BY LOWER(email) HAVING count(*) > 1
  ) d;

  IF dupes IS NULL THEN
    CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email_lower ON users (LOWER(email));
  ELSE
    RAISE WARNING 'uq_users_email_lower NOT created: accounts collide ignoring case: %', dupes;
  END IF;
END $$;

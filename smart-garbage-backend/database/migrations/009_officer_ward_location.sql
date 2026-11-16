-- 009_officer_ward_location.sql
-- Support automatic complaint routing by ward / area / distance.
--
--  * officers.location_source records where an officer's location came from:
--      'ward'     defaulted to the centroid of their ward (can be recomputed when the ward changes)
--      'reported' sent by the officer themself (never overwritten automatically)
--  * Backfill: officers created before this change have no ward (the admin API used to drop it).
--    Match them to a ward when their assigned_area_name is that ward's name ("Ward 1" or "Ward 1 - Central"),
--    then default a missing location to the ward centroid.
ALTER TABLE officers ADD COLUMN IF NOT EXISTS location_source VARCHAR(10);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'officers_location_source_check') THEN
    ALTER TABLE officers ADD CONSTRAINT officers_location_source_check
      CHECK (location_source IS NULL OR location_source IN ('ward', 'reported'));
  END IF;
END $$;

-- Existing officer-reported locations
UPDATE officers SET location_source = 'reported' WHERE location IS NOT NULL AND location_source IS NULL;

-- Officers without a ward: match by area name, only when exactly one ward matches
UPDATE officers o
SET assigned_ward_id = m.ward_id
FROM (
  SELECT o2.officer_id, MIN(w.ward_id) AS ward_id
  FROM officers o2
  JOIN wards w
    ON LOWER(TRIM(o2.assigned_area_name)) = LOWER(TRIM(w.name))
    OR starts_with(LOWER(TRIM(o2.assigned_area_name)), LOWER(TRIM(w.name)) || ' ')
    OR starts_with(LOWER(TRIM(o2.assigned_area_name)), LOWER(TRIM(w.name)) || '-')
  WHERE o2.assigned_ward_id IS NULL
  GROUP BY o2.officer_id
  HAVING COUNT(*) = 1
) m
WHERE o.officer_id = m.officer_id;

-- Default a missing location to the ward centroid
UPDATE officers o
SET location = ST_Centroid(w.boundaries), location_source = 'ward'
FROM wards w
WHERE o.assigned_ward_id = w.ward_id AND o.location IS NULL AND w.boundaries IS NOT NULL;

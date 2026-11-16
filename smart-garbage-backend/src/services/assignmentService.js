// src/services/assignmentService.js
// Assignment Service - Geolocation-based complaint routing to officers

const { db } = require('../config/database');
const AppError = require('../utils/AppError');

const logger = require('../utils/logger');

const OPEN_STATUSES = "('resolved', 'rejected')";
const ASSIGN_LOCK_KEY = 74120001; // pg_advisory_xact_lock key: serialises auto-assignment decisions

const numEnv = (name, fallback) => {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

// Tunables (env): see docs/ARCHITECTURE.md "Complaint assignment"
const settings = () => ({
  maxRadiusMeters: numEnv('ASSIGN_MAX_RADIUS_KM', 10) * 1000,
  maxOpenPerOfficer: Math.floor(numEnv('ASSIGN_MAX_OPEN_PER_OFFICER', 20)),
});

// Distances closer than this are treated as equal so the less busy officer wins the tie
const DISTANCE_BUCKET_METERS = 100;

const TIER_LABELS = { 1: 'ward match', 2: 'area match', 3: 'nearest officer' };

/**
 * Pick the officer for a complaint (runs inside the assignment transaction).
 *
 * Tiers, strictly in this order:
 *   1. active officer whose assigned ward is the complaint's ward
 *   2. active officer with no ward whose assigned area name matches the complaint's ward / area name
 *   3. nearest active officer with a known location, within ASSIGN_MAX_RADIUS_KM
 * Inside the winning tier: officers under the open-complaint cap first, then nearest (distances within
 * 100 m tie), then fewest open complaints. Officers without a location sort after those with one.
 */
const selectOfficer = async (t, complaint, cfg = settings()) =>
  t.oneOrNone(
    `WITH ctx AS (
       SELECT $1::geography AS pt,
              NULLIF(LOWER(TRIM($3::text)), '') AS area_key
     ),
     cand AS (
       SELECT
         o.officer_id, o.user_id,
         u.name AS officer_name, u.phone AS officer_phone, u.email AS officer_email,
         CASE
           WHEN $2::int IS NOT NULL AND o.assigned_ward_id = $2::int THEN 1
           WHEN o.assigned_ward_id IS NULL AND ctx.area_key IS NOT NULL
                AND o.assigned_area_name IS NOT NULL AND (
                  LOWER(TRIM(o.assigned_area_name)) = ctx.area_key
                  OR starts_with(LOWER(TRIM(o.assigned_area_name)), ctx.area_key || ' ')
                  OR starts_with(LOWER(TRIM(o.assigned_area_name)), ctx.area_key || '-')
                ) THEN 2
           ELSE 3
         END AS tier,
         CASE WHEN o.location IS NULL THEN NULL
              ELSE ST_Distance(o.location::geography, ctx.pt) END AS distance_meters,
         (SELECT COUNT(*) FROM complaints c
           WHERE c.assigned_officer_id = o.officer_id AND c.status NOT IN ${OPEN_STATUSES}) AS current_workload
       FROM officers o
       JOIN users u ON u.user_id = o.user_id
       CROSS JOIN ctx
       WHERE o.status = 'active'
     )
     SELECT officer_id, user_id, officer_name, officer_phone, officer_email, tier, distance_meters, current_workload
     FROM cand
     WHERE tier < 3 OR (distance_meters IS NOT NULL AND distance_meters <= $4)
     ORDER BY tier,
              (current_workload >= $5),
              (distance_meters IS NULL),
              ROUND(distance_meters / ${DISTANCE_BUCKET_METERS}),
              current_workload,
              officer_id
     LIMIT 1`,
    [
      `POINT(${complaint.longitude} ${complaint.latitude})`,
      complaint.ward_id,
      complaint.ward_name || complaint.area,
      cfg.maxRadiusMeters,
      cfg.maxOpenPerOfficer,
    ]
  );

const describeReason = (officer) => {
  const label = TIER_LABELS[officer.tier] || 'auto';
  if (officer.distance_meters === null || officer.distance_meters === undefined) return label;
  const km = Number(officer.distance_meters) / 1000;
  return `${label}, ${km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`} away`;
};

/**
 * Auto-assign a complaint (ward -> area -> nearest, see selectOfficer).
 * Decisions are serialised with an advisory lock so concurrent submissions see each other's workload and
 * cannot assign the same complaint twice. `onlyIfUnassigned` (used by retries) skips complaints that
 * already have an officer; it returns null in that case.
 */
const autoAssignComplaint = async (complaintId, { onlyIfUnassigned = false } = {}) => {
  try {
    return await db.tx(async (t) => {
      await t.any('SELECT pg_advisory_xact_lock($1)', [ASSIGN_LOCK_KEY]);

      const complaint = await t.oneOrNone(
        `SELECT c.complaint_id, c.latitude, c.longitude, c.ward_id, c.area, c.status,
                c.assigned_officer_id, w.name AS ward_name
         FROM complaints c LEFT JOIN wards w ON w.ward_id = c.ward_id
         WHERE c.complaint_id = $1`,
        [complaintId]
      );

      if (!complaint) {
        throw AppError.notFound('Complaint not found');
      }
      if (onlyIfUnassigned && complaint.assigned_officer_id) {
        return null;
      }

      const officer = await selectOfficer(t, complaint);

      if (!officer) {
        throw AppError.conflict('No available officers found for this area');
      }

      const assigned = await t.one(
        `UPDATE complaints
         SET assigned_officer_id = $1,
             status = 'assigned',
             assigned_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE complaint_id = $2
         RETURNING complaint_id, assigned_officer_id, status, assigned_at`,
        [officer.officer_id, complaintId]
      );

      const reason = describeReason(officer);
      await t.none(
        `INSERT INTO complaint_history (complaint_id, old_status, new_status, changed_by, comment)
         VALUES ($1, $2, 'assigned', NULL, $3)`,
        [complaintId, complaint.status, `Auto-assigned to Officer: ${officer.officer_name} (${reason})`]
      );

      return {
        ...assigned,
        officer: {
          officer_id: officer.officer_id,
          name: officer.officer_name,
          phone: officer.officer_phone,
          email: officer.officer_email,
          distance_meters:
            officer.distance_meters === null || officer.distance_meters === undefined
              ? null
              : Math.round(officer.distance_meters),
          current_workload: parseInt(officer.current_workload || 0),
          match: TIER_LABELS[officer.tier] || 'auto',
        },
      };
    });
  } catch (error) {
    throw AppError.wrap(error, 'Auto-assignment failed');
  }
};

/**
 * Retry assignment for every complaint still waiting for an officer (status 'new', no officer), oldest first.
 * "No officer available" is not an error here: those complaints just stay in the queue.
 * Returns { checked, assigned, remaining }.
 */
const assignUnassigned = async ({ limit = 200 } = {}) => {
  const rows = await db.manyOrNone(
    `SELECT complaint_id FROM complaints
     WHERE assigned_officer_id IS NULL AND status = 'new'
     ORDER BY created_at ASC, complaint_id ASC
     LIMIT $1`,
    [limit]
  );
  let assigned = 0;
  for (const { complaint_id: id } of rows) {
    try {
      const result = await autoAssignComplaint(id, { onlyIfUnassigned: true });
      if (result) assigned += 1;
    } catch (err) {
      if (err.status !== 409) logger.warn('assignUnassigned: failed for complaint', { complaintId: id, err });
    }
  }
  return { checked: rows.length, assigned, remaining: rows.length - assigned };
};

// Best-effort wrapper for hooks (officer created / back from leave / ward changed): never rejects.
const retryUnassignedSafely = async () => {
  try {
    return await assignUnassigned();
  } catch (err) {
    logger.warn('retry of unassigned complaints failed', { err });
    return null;
  }
};

/**
 * Find nearest officers to a location
 * Returns list of officers sorted by distance
 */
const findNearestOfficers = async (latitude, longitude, wardId, limit = 5) => {
  try {
    const officers = await db.manyOrNone(
      `SELECT 
        o.officer_id, o.user_id,
        u.name as officer_name, u.phone as officer_phone,
        o.assigned_area_name,
        ST_Distance(o.location::geography, $1::geography) AS distance_meters,
        COUNT(c.complaint_id) FILTER (WHERE c.status NOT IN ('resolved', 'rejected')) AS current_workload
       FROM officers o
       JOIN users u ON o.user_id = u.user_id
       LEFT JOIN complaints c ON o.officer_id = c.assigned_officer_id
       WHERE o.status = 'active'
         AND ($2::int IS NULL OR o.assigned_ward_id = $2::int)
       GROUP BY o.officer_id, u.name, u.phone, o.assigned_area_name, distance_meters
       ORDER BY distance_meters ASC
       LIMIT $3`,
      [`POINT(${longitude} ${latitude})`, wardId, limit]
    );

    return officers;
  } catch (error) {
    throw AppError.wrap(error, 'Failed to find nearby officers');
  }
};

/**
 * Manually assign complaint to specific officer
 * Used by admin for override assignment
 */
const manualAssign = async (complaintId, officerId, assignedBy) => {
  try {
    // Check if officer exists
    const officer = await db.oneOrNone(
      'SELECT officer_id FROM officers WHERE officer_id = $1',
      [officerId]
    );

    if (!officer) {
      throw AppError.notFound('Officer not found');
    }

    // Get old assignment
    const complaint = await db.oneOrNone(
      'SELECT assigned_officer_id, status FROM complaints WHERE complaint_id = $1',
      [complaintId]
    );

    if (!complaint) {
      throw AppError.notFound('Complaint not found');
    }

    // Update assignment
    const updated = await db.one(
      `UPDATE complaints 
       SET assigned_officer_id = $1,
           status = 'assigned',
           assigned_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE complaint_id = $2
       RETURNING complaint_id, assigned_officer_id, status`,
      [officerId, complaintId]
    );

    // Log in history
    const comment = complaint.assigned_officer_id
      ? `Reassigned from Officer ${complaint.assigned_officer_id} to ${officerId}`
      : `Manually assigned to Officer ${officerId}`;

    await db.none(
      `INSERT INTO complaint_history (complaint_id, old_status, new_status, changed_by, comment)
       VALUES ($1, $2, 'assigned', $3, $4)`,
      [complaintId, complaint.status, assignedBy, comment]
    );

    return updated;
  } catch (error) {
    throw AppError.wrap(error, 'Manual assignment failed');
  }
};

/**
 * Get officer's current workload statistics
 */
const getOfficerWorkload = async (officerId) => {
  try {
    const workload = await db.oneOrNone(
      `SELECT 
        COUNT(*) FILTER (WHERE status = 'assigned') AS pending_count,
        COUNT(*) FILTER (WHERE status = 'in_progress') AS in_progress_count,
        COUNT(*) FILTER (WHERE status = 'resolved') AS resolved_count,
        COUNT(*) FILTER (WHERE status NOT IN ('resolved', 'rejected')) AS total_active,
        AVG(EXTRACT(EPOCH FROM (resolved_at - assigned_at))/3600) AS avg_resolution_hours
       FROM complaints
       WHERE assigned_officer_id = $1`,
      [officerId]
    );

    return workload;
  } catch (error) {
    throw AppError.wrap(error, 'Failed to get workload');
  }
};

/**
 * Balance workload between officers in a ward
 * Reassign complaints from overloaded officers to less busy ones
 */
const balanceWorkload = async (wardId) => {
  try {
    // Get officers in ward sorted by workload
    const officers = await db.manyOrNone(
      `SELECT 
        o.officer_id,
        COUNT(c.complaint_id) FILTER (WHERE c.status NOT IN ('resolved', 'rejected')) AS current_load
       FROM officers o
       LEFT JOIN complaints c ON o.officer_id = c.assigned_officer_id
       WHERE o.assigned_ward_id = $1 AND o.status = 'active'
       GROUP BY o.officer_id
       ORDER BY current_load DESC`,
      [wardId]
    );

    if (officers.length < 2) {
      return { message: 'Not enough officers to balance' };
    }

    const mostBusy = officers[0];
    const leastBusy = officers[officers.length - 1];
    const loadDifference = mostBusy.current_load - leastBusy.current_load;

    // If difference is >= 2, reassign one complaint
    if (loadDifference >= 2) {
      const complaint = await db.oneOrNone(
        `SELECT complaint_id FROM complaints
         WHERE assigned_officer_id = $1 
         AND status NOT IN ('resolved', 'rejected')
         ORDER BY created_at ASC
         LIMIT 1`,
        [mostBusy.officer_id]
      );

      if (complaint) {
        await manualAssign(complaint.complaint_id, leastBusy.officer_id, null);
        return { 
          message: 'Workload balanced',
          reassigned: complaint.complaint_id,
          from: mostBusy.officer_id,
          to: leastBusy.officer_id,
        };
      }
    }

    return { message: 'Workload is balanced' };
  } catch (error) {
    throw AppError.wrap(error, 'Workload balancing failed');
  }
};

module.exports = {
  autoAssignComplaint,
  assignUnassigned,
  retryUnassignedSafely,
  selectOfficer,
  findNearestOfficers,
  manualAssign,
  getOfficerWorkload,
  balanceWorkload,
};

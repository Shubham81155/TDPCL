// src/services/officerService.js
// Officer Service - Officer management and operations

const bcrypt = require('bcryptjs');
const { db } = require('../config/database');
const AppError = require('../utils/AppError');
const { normalizeEmail } = require('../utils/email');
const { retryUnassignedSafely } = require('./assignmentService');

const officerFilter = ({ status = 'active', wardId } = {}) => {
  const params = [];
  let where = '1=1';
  if (status) {
    params.push(status);
    where += ` AND o.status = $${params.length}`;
  }
  if (wardId) {
    params.push(wardId);
    where += ` AND o.assigned_ward_id = $${params.length}`;
  }
  return { where, params };
};

// Get all officers with details
const getAllOfficers = async (filters = {}) => {
  const { limit = 100, offset = 0 } = filters;
  const { where, params } = officerFilter(filters);
  params.push(limit, offset);

  try {
    return await db.manyOrNone(
      `SELECT
        o.officer_id, o.user_id,
        u.name, u.email, u.phone,
        o.employee_id, o.assigned_ward_id, o.assigned_area_name,
        o.year_of_joining, o.status,
        ST_X(o.location::geometry) as longitude,
        ST_Y(o.location::geometry) as latitude,
        COUNT(c.complaint_id) FILTER (WHERE c.status NOT IN ('resolved', 'rejected')) AS active_complaints,
        COUNT(c.complaint_id) FILTER (WHERE c.status = 'resolved') AS resolved_complaints,
        w.name as ward_name
      FROM officers o
      JOIN users u ON o.user_id = u.user_id
      LEFT JOIN wards w ON o.assigned_ward_id = w.ward_id
      LEFT JOIN complaints c ON o.officer_id = c.assigned_officer_id
      WHERE ${where}
      GROUP BY o.officer_id, u.user_id, w.ward_id
      ORDER BY o.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
  } catch (error) {
    throw AppError.wrap(error, 'Failed to fetch officers');
  }
};

// Total officers matching the same filters as getAllOfficers (ignores limit/offset)
const countOfficers = async (filters = {}) => {
  const { where, params } = officerFilter(filters);
  try {
    const row = await db.one(
      `SELECT COUNT(*) AS total
       FROM officers o
       JOIN users u ON o.user_id = u.user_id
       WHERE ${where}`,
      params
    );
    return parseInt(row.total, 10) || 0;
  } catch (error) {
    throw AppError.wrap(error, 'Failed to count officers');
  }
};

// Get officer by ID (null if not found)
const getOfficerById = async (officerId) => {
  try {
    return await db.oneOrNone(
      `SELECT
        o.officer_id, o.user_id,
        u.name, u.email, u.phone,
        o.employee_id, o.assigned_ward_id,
        o.assigned_area_name, o.year_of_joining, o.status,
        ST_X(o.location::geometry) as longitude,
        ST_Y(o.location::geometry) as latitude,
        w.name as ward_name
       FROM officers o
       JOIN users u ON o.user_id = u.user_id
       LEFT JOIN wards w ON o.assigned_ward_id = w.ward_id
       WHERE o.officer_id = $1`,
      [officerId]
    );
  } catch (error) {
    throw AppError.wrap(error, 'Failed to fetch officer');
  }
};

// officer_id for a logged-in user, or null
const getOfficerIdByUserId = async (userId) => {
  const row = await db.oneOrNone('SELECT officer_id FROM officers WHERE user_id = $1', [userId]);
  return row ? row.officer_id : null;
};

// user_id that owns an officer record, or null if the officer does not exist
const getOfficerUserId = async (officerId) => {
  const row = await db.oneOrNone('SELECT user_id FROM officers WHERE officer_id = $1', [officerId]);
  return row ? row.user_id : null;
};

// Throws 404 if the officer is missing, 403 if the caller is neither admin nor the officer.
const assertOfficerAccess = async (officerId, user) => {
  const ownerUserId = await getOfficerUserId(officerId);
  if (ownerUserId === null) throw AppError.notFound('Officer not found');
  if (user.role !== 'admin' && Number(user.user_id) !== Number(ownerUserId)) {
    throw AppError.forbidden('Not authorized');
  }
  return ownerUserId;
};

// Current officer's profile / metrics resolved from the logged-in user
const getOfficerProfileForUser = async (userId) => {
  const officerId = await getOfficerIdByUserId(userId);
  if (!officerId) throw AppError.notFound('Officer profile not found');
  return getOfficerById(officerId);
};

const getOfficerMetricsForUser = async (userId) => {
  const officerId = await getOfficerIdByUserId(userId);
  if (!officerId) throw AppError.notFound('Officer profile not found');
  return getOfficerMetrics(officerId);
};

// Ward lookup for officer forms: the ward must exist; its name becomes the officer's area name.
const requireWard = async (t, wardId) => {
  const ward = await t.oneOrNone('SELECT ward_id, name FROM wards WHERE ward_id = $1', [wardId]);
  if (!ward) throw AppError.badRequest('Ward not found');
  return ward;
};

// Default an officer's location to the centroid of their ward. Locations the officer reported
// themself (location_source = 'reported') are never overwritten.
const applyWardCentroid = (t, officerId) =>
  t.none(
    `UPDATE officers o
     SET location = ST_Centroid(w.boundaries), location_source = 'ward'
     FROM wards w
     WHERE o.officer_id = $1 AND w.ward_id = o.assigned_ward_id AND w.boundaries IS NOT NULL
       AND (o.location IS NULL OR o.location_source IS DISTINCT FROM 'reported')`,
    [officerId]
  );

// Put an officer's open complaints back in the auto-assignment queue (status 'new', no officer) and log it.
const releaseOpenComplaints = async (t, officerId, statuses, reason) => {
  const rows = await t.manyOrNone(
    `SELECT complaint_id, status FROM complaints
     WHERE assigned_officer_id = $1 AND status::text IN ($2:csv)
     FOR UPDATE`,
    [officerId, statuses]
  );
  if (!rows.length) return 0;
  await t.none(
    `UPDATE complaints
     SET assigned_officer_id = NULL, status = 'new', updated_at = CURRENT_TIMESTAMP
     WHERE complaint_id = ANY($1::int[])`,
    [rows.map((r) => r.complaint_id)]
  );
  await t.none(
    `INSERT INTO complaint_history (complaint_id, old_status, new_status, changed_by, comment)
     SELECT x.c, x.s, 'new', NULL, $3
     FROM unnest($1::int[], $2::text[]) AS x(c, s)`,
    [rows.map((r) => r.complaint_id), rows.map((r) => r.status), reason]
  );
  return rows.length;
};

const OPEN_STATUSES = ['new', 'assigned', 'pending', 'in_progress'];

// Create new officer (Admin only). User + officer + preferences are created atomically.
const createOfficer = async (officerData) => {
  const { name, email, phone, password, employee_id, ward_id, area_name, year_of_joining } = officerData;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    const created = await db.tx(async (t) => {
      // A ward is the source of truth: its name becomes the area name and its centroid the default location.
      const ward = ward_id ? await requireWard(t, ward_id) : null;
      const user = await t.one(
        `INSERT INTO users (name, email, phone, password_hash, role, status)
         VALUES ($1, $2, $3, $4, 'officer', 'active')
         RETURNING user_id, name, email, phone`,
        [name, normalizeEmail(email), phone, hashedPassword]
      );

      const officer = await t.one(
        `INSERT INTO officers (user_id, employee_id, assigned_ward_id, assigned_area_name, year_of_joining, status)
         VALUES ($1, $2, $3, $4, $5, 'active')
         RETURNING officer_id, user_id, employee_id`,
        [user.user_id, employee_id, ward ? ward.ward_id : null, ward ? ward.name : area_name, year_of_joining]
      );
      if (ward) await applyWardCentroid(t, officer.officer_id);

      await t.none(
        `INSERT INTO user_preferences (user_id, sms_phone)
         VALUES ($1, $2)`,
        [user.user_id, phone]
      );

      return { ...officer, ...user };
    });

    // A new officer may unblock complaints that were waiting for someone in their area
    await retryUnassignedSafely();
    return created;
  } catch (error) {
    throw AppError.wrap(error, 'Failed to create officer');
  }
};

// Update officer
const updateOfficer = async (officerId, updateData = {}) => {
  const { name, phone, assigned_ward_id, status } = updateData;
  let { assigned_area_name } = updateData;
  const hasWard = assigned_ward_id !== undefined && assigned_ward_id !== null && assigned_ward_id !== '';

  try {
    const result = await db.tx(async (t) => {
      // Choosing a ward also sets the area name (kept in sync) and re-centres a non-reported location
      if (hasWard) {
        const ward = await requireWard(t, assigned_ward_id);
        assigned_area_name = ward.name;
      }
      const officer = await t.oneOrNone(
        `UPDATE officers
         SET assigned_ward_id = COALESCE($2, assigned_ward_id),
             assigned_area_name = COALESCE($3, assigned_area_name),
             status = COALESCE($4, status),
             updated_at = CURRENT_TIMESTAMP
         WHERE officer_id = $1
         RETURNING officer_id, user_id, assigned_ward_id, assigned_area_name, status`,
        [officerId, hasWard ? assigned_ward_id : null, assigned_area_name, status]
      );
      if (!officer) throw AppError.notFound('Officer not found');
      if (hasWard) await applyWardCentroid(t, officerId);

      // An officer who is away should not hold work they have not started; queue it for re-assignment
      let released = 0;
      if (status === 'on_leave') {
        released = await releaseOpenComplaints(t, officerId, ['assigned'], 'Officer on leave: returned to the assignment queue');
      } else if (status === 'inactive') {
        released = await releaseOpenComplaints(t, officerId, OPEN_STATUSES, 'Officer deactivated: returned to the assignment queue');
      }

      if (name || phone) {
        await t.none(
          `UPDATE users
           SET name = COALESCE($2, name),
               phone = COALESCE($3, phone),
               updated_at = CURRENT_TIMESTAMP
           WHERE user_id = $1`,
          [officer.user_id, name, phone]
        );
      }

      // Preserve the original response shape (user_id was not returned before)
      const { user_id, ...rest } = officer; // eslint-disable-line no-unused-vars
      return { rest, released };
    });

    // Back from leave, new ward or released work: let the queue pick it up
    if (hasWard || status === 'active' || result.released > 0) await retryUnassignedSafely();
    return result.rest;
  } catch (error) {
    throw AppError.wrap(error, 'Failed to update officer');
  }
};

// Update officer location (parameterised; coordinates must be finite numbers in range)
const updateOfficerLocation = async (officerId, latitude, longitude) => {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    throw AppError.badRequest('Latitude must be a number between -90 and 90');
  }
  if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
    throw AppError.badRequest('Longitude must be a number between -180 and 180');
  }

  try {
    const updated = await db.oneOrNone(
      `UPDATE officers
       SET location = ST_SetSRID(ST_MakePoint($2::float8, $3::float8), 4326),
           location_source = 'reported',
           updated_at = CURRENT_TIMESTAMP
       WHERE officer_id = $1
       RETURNING officer_id, updated_at`,
      [officerId, lng, lat]
    );
    if (!updated) throw AppError.notFound('Officer not found');
    return updated;
  } catch (error) {
    throw AppError.wrap(error, 'Failed to update officer location');
  }
};

// Get officer performance metrics
const getOfficerMetrics = async (officerId) => {
  try {
    return await db.oneOrNone(
      `SELECT
        COUNT(*) FILTER (WHERE status = 'assigned') AS pending_count,
        COUNT(*) FILTER (WHERE status = 'in_progress') AS in_progress_count,
        COUNT(*) FILTER (WHERE status = 'resolved') AS resolved_count,
        COUNT(*) FILTER (WHERE status = 'rejected') AS rejected_count,
        COUNT(*) AS total_complaints,
        ROUND(AVG(EXTRACT(EPOCH FROM (COALESCE(resolved_at, NOW()) - assigned_at))/3600)::numeric, 2) AS avg_resolution_hours,
        MIN(assigned_at) AS first_complaint_date,
        MAX(resolved_at) AS last_resolved_date
       FROM complaints
       WHERE assigned_officer_id = $1`,
      [officerId]
    );
  } catch (error) {
    throw AppError.wrap(error, 'Failed to get officer metrics');
  }
};

// Deactivate officer and release their open complaints
const deactivateOfficer = async (officerId) => {
  try {
    const updated = await db.tx(async (t) => {
      const row = await t.oneOrNone(
        `UPDATE officers
         SET status = 'inactive',
             updated_at = CURRENT_TIMESTAMP
         WHERE officer_id = $1
         RETURNING officer_id, status`,
        [officerId]
      );
      if (!row) throw AppError.notFound('Officer not found');

      await releaseOpenComplaints(t, officerId, OPEN_STATUSES, 'Officer deactivated: returned to the assignment queue');
      return row;
    });
    await retryUnassignedSafely();
    return updated;
  } catch (error) {
    throw AppError.wrap(error, 'Failed to deactivate officer');
  }
};

// Delete officer record and its user account
const deleteOfficer = async (officerId) => {
  try {
    await db.tx(async (t) => {
      const officer = await t.oneOrNone('SELECT user_id FROM officers WHERE officer_id = $1', [officerId]);
      if (!officer) throw AppError.notFound('Officer not found');
      // Deleting would leave 'assigned' complaints with no officer; queue them for re-assignment instead
      await releaseOpenComplaints(t, officerId, OPEN_STATUSES, 'Officer removed: returned to the assignment queue');
      await t.none('DELETE FROM officers WHERE officer_id = $1', [officerId]);
      await t.none('DELETE FROM users WHERE user_id = $1', [officer.user_id]);
    });
    await retryUnassignedSafely();
  } catch (error) {
    throw AppError.wrap(error, 'Failed to delete officer');
  }
};

module.exports = {
  getAllOfficers,
  countOfficers,
  getOfficerById,
  getOfficerIdByUserId,
  getOfficerUserId,
  assertOfficerAccess,
  getOfficerProfileForUser,
  getOfficerMetricsForUser,
  createOfficer,
  updateOfficer,
  updateOfficerLocation,
  getOfficerMetrics,
  deactivateOfficer,
  deleteOfficer,
};

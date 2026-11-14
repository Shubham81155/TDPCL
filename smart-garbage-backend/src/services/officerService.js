// src/services/officerService.js
// Officer Service - Officer management and operations

const bcrypt = require('bcryptjs');
const { db } = require('../config/database');
const AppError = require('../utils/AppError');

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

// Create new officer (Admin only). User + officer + preferences are created atomically.
const createOfficer = async (officerData) => {
  const { name, email, phone, password, employee_id, ward_id, area_name, year_of_joining } = officerData;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);

    return await db.tx(async (t) => {
      const user = await t.one(
        `INSERT INTO users (name, email, phone, password_hash, role, status)
         VALUES ($1, $2, $3, $4, 'officer', 'active')
         RETURNING user_id, name, email, phone`,
        [name, email, phone, hashedPassword]
      );

      const officer = await t.one(
        `INSERT INTO officers (user_id, employee_id, assigned_ward_id, assigned_area_name, year_of_joining, status)
         VALUES ($1, $2, $3, $4, $5, 'active')
         RETURNING officer_id, user_id, employee_id`,
        [user.user_id, employee_id, ward_id || null, area_name, year_of_joining]
      );

      await t.none(
        `INSERT INTO user_preferences (user_id, sms_phone)
         VALUES ($1, $2)`,
        [user.user_id, phone]
      );

      return { ...officer, ...user };
    });
  } catch (error) {
    throw AppError.wrap(error, 'Failed to create officer');
  }
};

// Update officer
const updateOfficer = async (officerId, updateData = {}) => {
  const { name, phone, assigned_ward_id, assigned_area_name, status } = updateData;

  try {
    return await db.tx(async (t) => {
      const officer = await t.oneOrNone(
        `UPDATE officers
         SET assigned_ward_id = COALESCE($2, assigned_ward_id),
             assigned_area_name = COALESCE($3, assigned_area_name),
             status = COALESCE($4, status),
             updated_at = CURRENT_TIMESTAMP
         WHERE officer_id = $1
         RETURNING officer_id, user_id, assigned_ward_id, assigned_area_name, status`,
        [officerId, assigned_ward_id, assigned_area_name, status]
      );
      if (!officer) throw AppError.notFound('Officer not found');

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
      const { user_id, ...result } = officer; // eslint-disable-line no-unused-vars
      return result;
    });
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
    return await db.tx(async (t) => {
      const updated = await t.oneOrNone(
        `UPDATE officers
         SET status = 'inactive',
             updated_at = CURRENT_TIMESTAMP
         WHERE officer_id = $1
         RETURNING officer_id, status`,
        [officerId]
      );
      if (!updated) throw AppError.notFound('Officer not found');

      await t.none(
        `UPDATE complaints
         SET assigned_officer_id = NULL,
             status = 'new',
             updated_at = CURRENT_TIMESTAMP
         WHERE assigned_officer_id = $1 AND status NOT IN ('resolved', 'rejected')`,
        [officerId]
      );

      return updated;
    });
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
      await t.none('DELETE FROM officers WHERE officer_id = $1', [officerId]);
      await t.none('DELETE FROM users WHERE user_id = $1', [officer.user_id]);
    });
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

// src/services/officerService.js
// Officer Service - Officer management and operations

const { db } = require('../config/database');

// Get all officers with details
const getAllOfficers = async (filters = {}) => {
  const { status = 'active', wardId, limit = 100, offset = 0 } = filters;

  let query = `
    SELECT 
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
    WHERE 1=1
  `;

  const params = [];
  let paramIndex = 1;

  if (status) {
    query += ` AND o.status = $${paramIndex}`;
    params.push(status);
    paramIndex++;
  }

  if (wardId) {
    query += ` AND o.assigned_ward_id = $${paramIndex}`;
    params.push(wardId);
    paramIndex++;
  }

  query += ` GROUP BY o.officer_id, u.user_id, w.ward_id
    ORDER BY o.created_at DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(limit, offset);

  try {
    const officers = await db.manyOrNone(query, params);
    return officers;
  } catch (error) {
    throw new Error(`Failed to fetch officers: ${error.message}`);
  }
};

// Get officer by ID
const getOfficerById = async (officerId) => {
  try {
    const officer = await db.oneOrNone(
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

    return officer;
  } catch (error) {
    throw new Error(`Failed to fetch officer: ${error.message}`);
  }
};

// Create new officer (Admin only)
const createOfficer = async (officerData) => {
  const { name, email, phone, password, employee_id, ward_id, area_name, year_of_joining } = officerData;

  try {
    // Create user account
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await db.one(
      `INSERT INTO users (name, email, phone, password_hash, role, status)
       VALUES ($1, $2, $3, $4, 'officer', 'active')
       RETURNING user_id, name, email, phone`,
      [name, email, phone, hashedPassword]
    );

    // Create officer record
    const officer = await db.one(
      `INSERT INTO officers (user_id, employee_id, assigned_ward_id, assigned_area_name, year_of_joining, status)
       VALUES ($1, $2, $3, $4, $5, 'active')
       RETURNING officer_id, user_id, employee_id`,
      [user.user_id, employee_id, ward_id || null, area_name, year_of_joining]
    );

    // Create user preferences
    await db.none(
      `INSERT INTO user_preferences (user_id, sms_phone)
       VALUES ($1, $2)`,
      [user.user_id, phone]
    );

    return { ...officer, ...user };
  } catch (error) {
    throw new Error(`Failed to create officer: ${error.message}`);
  }
};

// Update officer
const updateOfficer = async (officerId, updateData) => {
  const { name, phone, assigned_ward_id, assigned_area_name, status } = updateData;

  try {
    const officer = await db.one(
      `UPDATE officers 
       SET assigned_ward_id = COALESCE($2, assigned_ward_id),
           assigned_area_name = COALESCE($3, assigned_area_name),
           status = COALESCE($4, status),
           updated_at = CURRENT_TIMESTAMP
       WHERE officer_id = $1
       RETURNING officer_id, assigned_ward_id, assigned_area_name, status`,
      [officerId, assigned_ward_id, assigned_area_name, status]
    );

    // Update user info if needed
    if (name || phone) {
      const officerRecord = await db.oneOrNone(
        'SELECT user_id FROM officers WHERE officer_id = $1',
        [officerId]
      );

      if (officerRecord) {
        await db.none(
          `UPDATE users 
           SET name = COALESCE($2, name),
               phone = COALESCE($3, phone),
               updated_at = CURRENT_TIMESTAMP
           WHERE user_id = $1`,
          [officerRecord.user_id, name, phone]
        );
      }
    }

    return officer;
  } catch (error) {
    throw new Error(`Failed to update officer: ${error.message}`);
  }
};

// Update officer location
const updateOfficerLocation = async (officerId, latitude, longitude) => {
  try {
    const updated = await db.one(
      `UPDATE officers 
       SET location = ST_GeomFromText('POINT(${longitude} ${latitude})', 4326),
           updated_at = CURRENT_TIMESTAMP
       WHERE officer_id = $1
       RETURNING officer_id, updated_at`,
      [officerId]
    );

    return updated;
  } catch (error) {
    throw new Error(`Failed to update officer location: ${error.message}`);
  }
};

// Get officer performance metrics
const getOfficerMetrics = async (officerId) => {
  try {
    const metrics = await db.oneOrNone(
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

    return metrics;
  } catch (error) {
    throw new Error(`Failed to get officer metrics: ${error.message}`);
  }
};

// Deactivate officer
const deactivateOfficer = async (officerId) => {
  try {
    const updated = await db.one(
      `UPDATE officers 
       SET status = 'inactive',
           updated_at = CURRENT_TIMESTAMP
       WHERE officer_id = $1
       RETURNING officer_id, status`,
      [officerId]
    );

    // Reassign their complaints
    await db.none(
      `UPDATE complaints 
       SET assigned_officer_id = NULL,
           status = 'new',
           updated_at = CURRENT_TIMESTAMP
       WHERE assigned_officer_id = $1 AND status NOT IN ('resolved', 'rejected')`,
      [officerId]
    );

    return updated;
  } catch (error) {
    throw new Error(`Failed to deactivate officer: ${error.message}`);
  }
};

module.exports = {
  getAllOfficers,
  getOfficerById,
  createOfficer,
  updateOfficer,
  updateOfficerLocation,
  getOfficerMetrics,
  deactivateOfficer,
};

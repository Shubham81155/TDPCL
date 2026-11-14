// src/services/wardService.js
// Ward Service - Ward/Area management

const { db } = require('../config/database');

// Get all wards
const getAllWards = async (filters = {}) => {
  const { city, limit = 100, offset = 0 } = filters;

  let query = `
    SELECT 
      ward_id, name, city, state,
      ST_AsGeoJSON(boundaries) as boundaries_geojson,
      COUNT(o.officer_id) as officer_count,
      COUNT(c.complaint_id) as complaint_count,
      created_at
    FROM wards w
    LEFT JOIN officers o ON w.ward_id = o.assigned_ward_id AND o.status = 'active'
    LEFT JOIN complaints c ON w.ward_id = c.ward_id
    WHERE 1=1
  `;

  const params = [];
  let paramIndex = 1;

  if (city) {
    query += ` AND w.city = $${paramIndex}`;
    params.push(city);
    paramIndex++;
  }

  query += ` GROUP BY w.ward_id
    ORDER BY w.created_at DESC
    LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(limit, offset);

  try {
    const wards = await db.manyOrNone(query, params);
    return wards;
  } catch (error) {
    throw new Error(`Failed to fetch wards: ${error.message}`);
  }
};

// Get ward by ID
const getWardById = async (wardId) => {
  try {
    const ward = await db.oneOrNone(
      `SELECT 
        ward_id, name, city, state,
        ST_AsGeoJSON(boundaries) as boundaries_geojson,
        created_at, updated_at
       FROM wards WHERE ward_id = $1`,
      [wardId]
    );

    return ward;
  } catch (error) {
    throw new Error(`Failed to fetch ward: ${error.message}`);
  }
};

// Create new ward
const createWard = async (wardData) => {
  const { name, city, state, boundaries_geojson } = wardData;

  try {
    const ward = await db.one(
      `INSERT INTO wards (name, city, state, boundaries)
       VALUES ($1, $2, $3, ST_GeomFromGeoJSON($4))
       RETURNING ward_id, name, city, state, created_at`,
      [name, city, state, JSON.stringify(boundaries_geojson)]
    );

    return ward;
  } catch (error) {
    throw new Error(`Failed to create ward: ${error.message}`);
  }
};

// Update ward
const updateWard = async (wardId, updateData) => {
  const { name, city, state, boundaries_geojson } = updateData;

  try {
    let query = `UPDATE wards SET updated_at = CURRENT_TIMESTAMP`;
    const params = [wardId];
    let paramIndex = 2;

    if (name) {
      query += `, name = $${paramIndex}`;
      params.push(name);
      paramIndex++;
    }

    if (city) {
      query += `, city = $${paramIndex}`;
      params.push(city);
      paramIndex++;
    }

    if (state) {
      query += `, state = $${paramIndex}`;
      params.push(state);
      paramIndex++;
    }

    if (boundaries_geojson) {
      query += `, boundaries = ST_GeomFromGeoJSON($${paramIndex})`;
      params.push(JSON.stringify(boundaries_geojson));
      paramIndex++;
    }

    query += ` WHERE ward_id = $1
      RETURNING ward_id, name, city, state, updated_at`;

    const ward = await db.one(query, params);
    return ward;
  } catch (error) {
    throw new Error(`Failed to update ward: ${error.message}`);
  }
};

// Get ward by coordinates (point in polygon query)
const getWardByCoordinates = async (latitude, longitude) => {
  try {
    const ward = await db.oneOrNone(
      `SELECT ward_id, name, city, state
       FROM wards
       WHERE ST_Contains(boundaries, ST_GeomFromText('POINT(${longitude} ${latitude})', 4326))
       LIMIT 1`,
      []
    );

    return ward;
  } catch (error) {
    throw new Error(`Failed to find ward by coordinates: ${error.message}`);
  }
};

// Get officers in a ward
const getWardOfficers = async (wardId) => {
  try {
    const officers = await db.manyOrNone(
      `SELECT 
        o.officer_id, o.user_id,
        u.name, u.email, u.phone,
        o.employee_id, o.status,
        COUNT(c.complaint_id) FILTER (WHERE c.status NOT IN ('resolved', 'rejected')) AS active_complaints
       FROM officers o
       JOIN users u ON o.user_id = u.user_id
       LEFT JOIN complaints c ON o.officer_id = c.assigned_officer_id
       WHERE o.assigned_ward_id = $1 AND o.status = 'active'
       GROUP BY o.officer_id, u.user_id`,
      [wardId]
    );

    return officers;
  } catch (error) {
    throw new Error(`Failed to fetch ward officers: ${error.message}`);
  }
};

module.exports = {
  getAllWards,
  getWardById,
  createWard,
  updateWard,
  getWardByCoordinates,
  getWardOfficers,
};

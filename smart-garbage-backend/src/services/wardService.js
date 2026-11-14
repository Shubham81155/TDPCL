// src/services/wardService.js
// Ward Service - Ward/Area management

const { db } = require('../config/database');
const AppError = require('../utils/AppError');

// Get all wards
const getAllWards = async (filters = {}) => {
  const { city, limit = 100, offset = 0 } = filters;

  const params = [];
  let where = '1=1';
  if (city) {
    params.push(city);
    where += ` AND w.city = $${params.length}`;
  }
  params.push(limit, offset);

  // Correlated sub-selects avoid the officers x complaints join fan-out
  try {
    return await db.manyOrNone(
      `SELECT 
        w.ward_id, w.name, w.city, w.state,
        ST_AsGeoJSON(w.boundaries) as boundaries_geojson,
        (SELECT COUNT(*) FROM officers o
          WHERE o.assigned_ward_id = w.ward_id AND o.status = 'active') as officer_count,
        (SELECT COUNT(*) FROM complaints c WHERE c.ward_id = w.ward_id) as complaint_count,
        w.created_at
      FROM wards w
      WHERE ${where}
      ORDER BY w.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params
    );
  } catch (error) {
    throw AppError.wrap(error, 'Failed to fetch wards');
  }
};

// Total wards matching the same filters as getAllWards (ignores limit/offset)
const countWards = async (filters = {}) => {
  const { city } = filters;
  try {
    const row = city
      ? await db.one('SELECT COUNT(*) AS total FROM wards WHERE city = $1', [city])
      : await db.one('SELECT COUNT(*) AS total FROM wards');
    return parseInt(row.total, 10) || 0;
  } catch (error) {
    throw AppError.wrap(error, 'Failed to count wards');
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
    throw AppError.wrap(error, 'Failed to fetch ward');
  }
};

class WardError extends AppError {
  constructor(message, status = 400) {
    super(message, status);
  }
}

const cleanText = (value, label) => {
  if (typeof value !== 'string' || !value.trim()) {
    throw new WardError(`${label} is required`);
  }
  const v = value.trim();
  if (v.length > 255) throw new WardError(`${label} must be at most 255 characters`);
  return v;
};

// Parse and validate a GeoJSON Polygon (object or JSON string). Returns a JSON string.
const normalizePolygon = (input) => {
  let geo = input;
  if (typeof geo === 'string') {
    try {
      geo = JSON.parse(geo);
    } catch (e) {
      throw new WardError('boundaries_geojson is not valid JSON');
    }
  }
  if (geo && geo.type === 'Feature') geo = geo.geometry;
  if (!geo || typeof geo !== 'object' || geo.type !== 'Polygon') {
    throw new WardError('boundaries_geojson must be a GeoJSON Polygon');
  }
  const rings = geo.coordinates;
  if (!Array.isArray(rings) || rings.length === 0) {
    throw new WardError('Polygon must have at least one ring');
  }
  for (const ring of rings) {
    if (!Array.isArray(ring) || ring.length < 4) {
      throw new WardError('Each polygon ring needs at least 4 positions');
    }
    for (const pt of ring) {
      if (
        !Array.isArray(pt) || pt.length < 2 ||
        typeof pt[0] !== 'number' || typeof pt[1] !== 'number' ||
        !Number.isFinite(pt[0]) || !Number.isFinite(pt[1])
      ) {
        throw new WardError('Polygon positions must be [lng, lat] numbers');
      }
      if (pt[0] < -180 || pt[0] > 180 || pt[1] < -90 || pt[1] > 90) {
        throw new WardError('Polygon coordinates out of range (lng -180..180, lat -90..90)');
      }
    }
    const first = ring[0];
    const last = ring[ring.length - 1];
    if (first[0] !== last[0] || first[1] !== last[1]) {
      throw new WardError('Polygon rings must be closed (first and last position equal)');
    }
  }
  return JSON.stringify({
    type: 'Polygon',
    coordinates: rings.map((r) => r.map((p) => [p[0], p[1]])),
  });
};

const assertValidGeometry = async (geoJsonString) => {
  let row;
  try {
    row = await db.one(
      `SELECT ST_IsValid(g) AS ok, ST_IsValidReason(g) AS reason
       FROM (SELECT ST_SetSRID(ST_GeomFromGeoJSON($1), 4326) AS g) t`,
      [geoJsonString]
    );
  } catch (error) {
    throw new WardError('Invalid GeoJSON geometry');
  }
  if (!row.ok) throw new WardError(`Invalid polygon: ${row.reason}`);
};

// The unique index uq_wards_name_city_ci closes the race the pre-check cannot:
// the loser of two simultaneous requests gets a 409 instead of a raw DB error.
const mapUniqueViolation = (error) => {
  if (error && error.code === '23505') {
    return new WardError('A ward with this name already exists in this city', 409);
  }
  return error;
};

const assertNoDuplicate = async (name, city, excludeId = null) => {
  const dup = await db.oneOrNone(
    `SELECT ward_id FROM wards
     WHERE LOWER(name) = LOWER($1) AND LOWER(city) = LOWER($2)
       AND ($3::int IS NULL OR ward_id <> $3::int)
     LIMIT 1`,
    [name, city, excludeId]
  );
  if (dup) throw new WardError(`A ward named "${name}" already exists in ${city}`, 409);
};

// Create new ward
const createWard = async (wardData = {}) => {
  try {
    const name = cleanText(wardData.name, 'name');
    const city = cleanText(wardData.city, 'city');
    const state = cleanText(wardData.state, 'state');
    if (wardData.boundaries_geojson === undefined || wardData.boundaries_geojson === null) {
      throw new WardError('boundaries_geojson is required');
    }
    const geo = normalizePolygon(wardData.boundaries_geojson);
    await assertValidGeometry(geo);
    await assertNoDuplicate(name, city);

    return await db.one(
      `INSERT INTO wards (name, city, state, boundaries)
       VALUES ($1, $2, $3, ST_SetSRID(ST_GeomFromGeoJSON($4), 4326))
       RETURNING ward_id, name, city, state, created_at`,
      [name, city, state, geo]
    );
  } catch (error) {
    throw AppError.wrap(mapUniqueViolation(error), 'Failed to create ward');
  }
};

// Update ward
const updateWard = async (wardId, updateData = {}) => {
  try {
    const id = Number(wardId);
    if (!Number.isInteger(id) || id <= 0) throw new WardError('Invalid ward id');

    const existing = await db.oneOrNone('SELECT name, city FROM wards WHERE ward_id = $1', [id]);
    if (!existing) throw new WardError('Ward not found', 404);

    const sets = ['updated_at = CURRENT_TIMESTAMP'];
    const params = [id];
    const add = (col, expr, value) => {
      params.push(value);
      sets.push(`${col} = ${expr.replace('?', `$${params.length}`)}`);
    };

    let name = existing.name;
    let city = existing.city;
    if (updateData.name !== undefined) {
      name = cleanText(updateData.name, 'name');
      add('name', '?', name);
    }
    if (updateData.city !== undefined) {
      city = cleanText(updateData.city, 'city');
      add('city', '?', city);
    }
    if (updateData.state !== undefined) {
      add('state', '?', cleanText(updateData.state, 'state'));
    }
    if (updateData.boundaries_geojson !== undefined && updateData.boundaries_geojson !== null) {
      const geo = normalizePolygon(updateData.boundaries_geojson);
      await assertValidGeometry(geo);
      add('boundaries', 'ST_SetSRID(ST_GeomFromGeoJSON(?), 4326)', geo);
    }

    if (name !== existing.name || city !== existing.city) {
      await assertNoDuplicate(name, city, id);
    }

    const ward = await db.oneOrNone(
      `UPDATE wards SET ${sets.join(', ')} WHERE ward_id = $1
       RETURNING ward_id, name, city, state, updated_at`,
      params
    );
    if (!ward) throw new WardError('Ward not found', 404);
    return ward;
  } catch (error) {
    throw AppError.wrap(mapUniqueViolation(error), 'Failed to update ward');
  }
};

// Get ward by coordinates (point in polygon query)
const getWardByCoordinates = async (latitude, longitude) => {
  try {
    const lng = Number(longitude);
    const lat = Number(latitude);
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
      throw AppError.badRequest('Invalid coordinates');
    }
    const ward = await db.oneOrNone(
      `SELECT ward_id, name, city, state
       FROM wards
       WHERE ST_Contains(boundaries, ST_SetSRID(ST_MakePoint($1, $2), 4326))
       LIMIT 1`,
      [lng, lat]
    );

    return ward;
  } catch (error) {
    throw AppError.wrap(error, 'Failed to find ward by coordinates');
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
    throw AppError.wrap(error, 'Failed to fetch ward officers');
  }
};

module.exports = {
  getAllWards,
  countWards,
  getWardById,
  createWard,
  updateWard,
  getWardByCoordinates,
  getWardOfficers,
  WardError,
};

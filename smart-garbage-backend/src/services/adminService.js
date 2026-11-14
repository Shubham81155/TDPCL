// src/services/adminService.js
// Admin dashboard statistics, audit logs and CSV report export

const { db } = require('../config/database');
const AppError = require('../utils/AppError');

// Whole-day bounds on complaints.created_at (timestamp without time zone).
// dateFrom/dateTo are Dates parsed from YYYY-MM-DD; only their calendar day is
// used: created_at >= day(dateFrom) AND created_at < day(dateTo) + 1 day, so
// dateTo is inclusive through 23:59:59.999. `alias` prefixes the column.
const dayString = (d) => (d instanceof Date ? d : new Date(d)).toISOString().slice(0, 10);

const dateConditions = ({ dateFrom, dateTo } = {}, params, alias = '') => {
  const col = `${alias}created_at`;
  const conds = [];
  if (dateFrom) {
    params.push(dayString(dateFrom));
    conds.push(`${col} >= $${params.length}::date`);
  }
  if (dateTo) {
    params.push(dayString(dateTo));
    conds.push(`${col} < ($${params.length}::date + 1)`);
  }
  return conds;
};

const whereOf = (conds) => (conds.length ? `WHERE ${conds.join(' AND ')}` : '');
const andOf = (conds) => conds.map((c) => ` AND ${c}`).join('');

const getComplaintStats = async (filters = {}) => {
  const params = [];
  const where = whereOf(dateConditions(filters, params));
  try {
    return await db.oneOrNone(
      `SELECT
        COUNT(*) as total_complaints,
        COUNT(*) FILTER (WHERE status = 'new') as new_count,
        COUNT(*) FILTER (WHERE status = 'assigned') as assigned_count,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_count,
        COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress_count,
        COUNT(*) FILTER (WHERE status = 'resolved') as resolved_count,
        COUNT(*) FILTER (WHERE status = 'rejected') as rejected_count,
        COUNT(*) FILTER (WHERE urgency_level = 'high') as high_urgency_count,
        COUNT(*) FILTER (WHERE urgency_level = 'medium') as medium_urgency_count,
        COUNT(*) FILTER (WHERE urgency_level = 'low') as low_urgency_count,
        ROUND(AVG(EXTRACT(EPOCH FROM (COALESCE(resolved_at, NOW()) - created_at))/3600)::numeric, 2) as avg_resolution_hours
       FROM complaints ${where}`,
      params
    );
  } catch (error) {
    throw AppError.wrap(error, 'Failed to load complaint statistics');
  }
};

const getStatsByCategory = async (filters = {}) => {
  const params = [];
  const where = whereOf(dateConditions(filters, params));
  try {
    return await db.manyOrNone(
      `SELECT
        category,
        COUNT(*) as count,
        COUNT(*) FILTER (WHERE status = 'resolved') as resolved
       FROM complaints ${where}
       GROUP BY category
       ORDER BY count DESC`,
      params
    );
  } catch (error) {
    throw AppError.wrap(error, 'Failed to load category statistics');
  }
};

// Counts are computed in separate sub-selects: joining complaints and officers
// together multiplied every count by the number of officers in the ward.
const getStatsByWard = async (filters = {}) => {
  const params = [];
  const dateSql = andOf(dateConditions(filters, params, 'c.'));
  try {
    return await db.manyOrNone(
      `SELECT
        w.ward_id, w.name,
        (SELECT COUNT(*) FROM complaints c WHERE c.ward_id = w.ward_id${dateSql}) as total_complaints,
        (SELECT COUNT(*) FROM complaints c WHERE c.ward_id = w.ward_id AND c.status = 'resolved'${dateSql}) as resolved,
        (SELECT COUNT(*) FROM officers o WHERE o.assigned_ward_id = w.ward_id AND o.status = 'active') as officer_count
       FROM wards w
       ORDER BY total_complaints DESC`,
      params
    );
  } catch (error) {
    throw AppError.wrap(error, 'Failed to load ward statistics');
  }
};

const getOfficerPerformance = async (limit = 10, filters = {}) => {
  const params = [limit];
  // The date predicate lives in the LEFT JOIN ... ON so officers with no
  // complaints in range are still listed (with zero counts).
  const dateSql = andOf(dateConditions(filters, params, 'c.'));
  try {
    return await db.manyOrNone(
      `SELECT
        o.officer_id, o.user_id,
        u.name as officer_name,
        COUNT(c.complaint_id) as total_complaints,
        COUNT(c.complaint_id) FILTER (WHERE c.status = 'resolved') as resolved,
        COUNT(c.complaint_id) FILTER (WHERE c.status NOT IN ('resolved', 'rejected')) as active,
        ROUND(AVG(EXTRACT(EPOCH FROM (COALESCE(c.resolved_at, NOW()) - c.assigned_at))/3600)::numeric, 2) as avg_resolution_hours,
        ROUND(((COUNT(c.complaint_id) FILTER (WHERE c.status = 'resolved')::float / NULLIF(COUNT(c.complaint_id), 0)) * 100)::numeric, 2) as resolution_rate
       FROM officers o
       LEFT JOIN users u ON o.user_id = u.user_id
       LEFT JOIN complaints c ON o.officer_id = c.assigned_officer_id${dateSql}
       WHERE o.status = 'active'
       GROUP BY o.officer_id, u.name
       ORDER BY resolved DESC
       LIMIT $1`,
      params
    );
  } catch (error) {
    throw AppError.wrap(error, 'Failed to load officer performance');
  }
};

const HEATMAP_LIMIT = 5000;

const getHeatmapData = async ({ dateFrom, dateTo, status, category } = {}) => {
  const params = [];
  const conds = ['location IS NOT NULL', ...dateConditions({ dateFrom, dateTo }, params)];
  if (status) {
    params.push(status);
    conds.push(`status = $${params.length}`);
  }
  if (category) {
    params.push(category);
    conds.push(`category = $${params.length}`);
  }
  try {
    return await db.manyOrNone(
      `SELECT
        ST_X(location::geometry) as longitude,
        ST_Y(location::geometry) as latitude,
        COUNT(*) as complaint_count,
        MAX(CASE WHEN urgency_level = 'high' THEN 1 ELSE 0 END) as has_urgent
       FROM complaints
       WHERE ${conds.join(' AND ')}
       GROUP BY ST_X(location::geometry), ST_Y(location::geometry)
       HAVING COUNT(*) > 0
       ORDER BY complaint_count DESC
       LIMIT ${HEATMAP_LIMIT}`,
      params
    );
  } catch (error) {
    throw AppError.wrap(error, 'Failed to load heatmap data');
  }
};

const getAuditLogs = async ({ limit = 100, offset = 0 } = {}) => {
  try {
    return await db.manyOrNone(
      `SELECT
        al.log_id, al.user_id,
        u.name as user_name,
        al.action, al.entity_type, al.entity_id,
        al.ip_address, al.created_at
       FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.user_id
       ORDER BY al.created_at DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );
  } catch (error) {
    throw AppError.wrap(error, 'Failed to load audit logs');
  }
};

// CSV cell escaping (quotes, commas, newlines) + spreadsheet formula-injection guard
const csvCell = (value) => {
  if (value === null || value === undefined) return '';
  let text = value instanceof Date ? value.toISOString() : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

const CSV_HEADER = ['Complaint ID', 'Title', 'Citizen', 'Category', 'Urgency', 'Status', 'Area', 'Ward', 'Officer', 'Created At', 'Assigned At', 'Resolved At'];

// Build the CSV (with BOM, CRLF line endings) for the filtered complaints report.
// All filters are bound parameters; invalid ward_id/date values are ignored.
const exportComplaintsCsv = async ({ status, category, ward_id, dateFrom, dateTo } = {}) => {
  let query = `
      SELECT
        c.complaint_id, c.title, u.name as citizen_name,
        c.category, c.urgency_level, c.status, c.area,
        c.created_at, c.assigned_at, c.resolved_at,
        o_user.name as officer_name,
        w.name as ward_name
      FROM complaints c
      LEFT JOIN users u ON c.user_id = u.user_id
      LEFT JOIN officers o ON c.assigned_officer_id = o.officer_id
      LEFT JOIN users o_user ON o.user_id = o_user.user_id
      LEFT JOIN wards w ON c.ward_id = w.ward_id
      WHERE 1=1
    `;

  const params = [];
  const add = (clause, value) => {
    params.push(value);
    query += ` AND ${clause.replace('?', `$${params.length}`)}`;
  };

  if (status) add('c.status = ?', status);
  if (category) add('c.category = ?', category);
  if (ward_id && Number.isInteger(Number(ward_id))) add('c.ward_id = ?', Number(ward_id));
  if (dateFrom && !isNaN(new Date(dateFrom))) add('c.created_at >= ?', new Date(dateFrom));
  if (dateTo && !isNaN(new Date(dateTo))) {
    const end = new Date(dateTo);
    end.setHours(23, 59, 59, 999);
    add('c.created_at <= ?', end);
  }

  query += ' ORDER BY c.created_at DESC';

  const data = await db.manyOrNone(query, params);

  const lines = data.map((r) =>
    [r.complaint_id, r.title, r.citizen_name, r.category, r.urgency_level, r.status, r.area,
      r.ward_name || 'Unknown', r.officer_name || 'Unassigned', r.created_at, r.assigned_at, r.resolved_at]
      .map(csvCell)
      .join(',')
  );

  return '\uFEFF' + [CSV_HEADER.join(','), ...lines].join('\r\n') + '\r\n';
};

module.exports = {
  getComplaintStats,
  getStatsByCategory,
  getStatsByWard,
  getOfficerPerformance,
  getHeatmapData,
  getAuditLogs,
  csvCell,
  exportComplaintsCsv,
};

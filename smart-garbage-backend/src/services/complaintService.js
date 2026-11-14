// src/services/complaintService.js
// Complaint Service - CRUD operations and complaint management

const { db } = require('../config/database');
const AppError = require('../utils/AppError');
const { sendComplaintStatusUpdateEmail } = require('./notificationService');

const OFFICER_STATUSES = ['pending', 'in_progress', 'resolved', 'rejected'];

// Small helper to build "WHERE ... AND ..." clauses with positional params.
const createFilter = (baseClause, baseParams = []) => {
  const params = [...baseParams];
  let where = baseClause;
  const add = (clause, value) => {
    params.push(value);
    where += ` AND ${clause.replace('?', `$${params.length}`)}`;
  };
  return { params, add, get where() { return where; } };
};

const pageClause = (params, limit, offset) => {
  params.push(limit, offset);
  return `LIMIT $${params.length - 1} OFFSET $${params.length}`;
};

const countRows = async (fromWhere, params) => {
  const row = await db.one(`SELECT COUNT(*) AS total FROM ${fromWhere}`, params);
  return parseInt(row.total, 10) || 0;
};

// Create new complaint
const createComplaint = async (complaintData) => {
  const {
    user_id,
    title,
    description,
    image_path,
    latitude,
    longitude,
    area,
    ward_id = null,
    category,
    urgency_level = 'medium',
  } = complaintData;

  try {
    // Create GIS point from coordinates
    return await db.one(
      `INSERT INTO complaints (
        user_id, title, description, image_path,
        location, latitude, longitude, area,
        category, urgency_level, status, created_at, ward_id
      ) VALUES ($1, $2, $3, $4,
        ST_SetSRID(ST_MakePoint($6::float8, $5::float8), 4326),
        $5, $6, $7, $8, $9, 'new', CURRENT_TIMESTAMP, $10)
       RETURNING complaint_id, user_id, title, description,
                 image_path, latitude, longitude, area,
                 category,
                 urgency_level, status, created_at, ward_id`,
      [user_id, title, description, image_path, latitude, longitude, area, category, urgency_level, ward_id]
    );
  } catch (error) {
    throw AppError.wrap(error, 'Failed to create complaint');
  }
};

// Get complaint by ID
const getComplaintById = async (complaintId) => {
  try {
    return await db.oneOrNone(
      `SELECT
        c.complaint_id, c.user_id, c.title, c.description,
        c.image_path, c.latitude, c.longitude, c.area,
        c.category, c.classified_label, c.classification_confidence,
        c.urgency_level, c.assigned_officer_id,
        c.status, c.resolution_description, c.resolution_image_path,
        c.created_at, c.assigned_at, c.started_at, c.resolved_at,
        u.name as citizen_name, u.email as citizen_email, u.phone as citizen_phone,
        o.user_id as officer_user_id, ou.name as assigned_officer
       FROM complaints c
       LEFT JOIN users u ON c.user_id = u.user_id
       LEFT JOIN officers o ON c.assigned_officer_id = o.officer_id
       LEFT JOIN users ou ON o.user_id = ou.user_id
       WHERE c.complaint_id = $1`,
      [complaintId]
    );
  } catch (error) {
    throw AppError.wrap(error, 'Failed to get complaint');
  }
};

const userFilter = (userId, { status, category, dateFrom, dateTo } = {}) => {
  const f = createFilter('c.user_id = $1', [userId]);
  if (status) f.add('c.status = ?', status);
  if (category) f.add('c.category = ?', category);
  if (dateFrom) f.add('c.created_at >= ?', dateFrom);
  if (dateTo) f.add('c.created_at <= ?', dateTo);
  return f;
};

// Get complaints by user (citizen)
const getComplaintsByUser = async (userId, filters = {}) => {
  const { limit = 20, offset = 0 } = filters;
  const f = userFilter(userId, filters);
  const params = f.params;
  const page = pageClause(params, limit, offset);

  try {
    return await db.manyOrNone(
      `SELECT
        c.complaint_id, c.user_id, c.title, c.description,
        c.image_path, c.latitude, c.longitude, c.area,
        c.category, c.classified_label, c.classification_confidence,
        c.urgency_level, c.assigned_officer_id,
        c.status, c.resolution_image_path,
        c.created_at, c.assigned_at, c.resolved_at
      FROM complaints c
      WHERE ${f.where}
      ORDER BY c.created_at DESC ${page}`,
      params
    );
  } catch (error) {
    throw AppError.wrap(error, 'Failed to get complaints');
  }
};

// Total rows matching the same filters as getComplaintsByUser (ignores limit/offset)
const countComplaintsByUser = async (userId, filters = {}) => {
  const f = userFilter(userId, filters);
  try {
    return await countRows(`complaints c WHERE ${f.where}`, f.params);
  } catch (error) {
    throw AppError.wrap(error, 'Failed to count complaints');
  }
};

// Counts of a citizen's complaints by status group, as numbers (one aggregate query)
const getComplaintSummaryByUser = async (userId) => {
  try {
    const row = await db.one(
      `SELECT
        COUNT(*)::int AS total,
        (COUNT(*) FILTER (WHERE status IN ('new', 'pending', 'assigned')))::int AS pending,
        (COUNT(*) FILTER (WHERE status = 'in_progress'))::int AS in_progress,
        (COUNT(*) FILTER (WHERE status = 'resolved'))::int AS resolved,
        (COUNT(*) FILTER (WHERE status = 'rejected'))::int AS rejected
       FROM complaints
       WHERE user_id = $1`,
      [userId]
    );
    const n = (v) => Number(v) || 0;
    return {
      total: n(row.total),
      pending: n(row.pending),
      in_progress: n(row.in_progress),
      resolved: n(row.resolved),
      rejected: n(row.rejected),
    };
  } catch (error) {
    throw AppError.wrap(error, 'Failed to get complaint summary');
  }
};

// Get complaints assigned to officer
const getOfficerComplaints = async (officerId, filters = {}) => {
  const { status, limit = 20, offset = 0 } = filters;
  const f = createFilter('c.assigned_officer_id = $1', [officerId]);
  if (status) f.add('c.status = ?', status);
  const params = f.params;
  const page = pageClause(params, limit, offset);

  try {
    return await db.manyOrNone(
      `SELECT
        c.complaint_id, c.user_id, c.title, c.description,
        c.image_path, c.latitude, c.longitude, c.area,
        c.category, c.classified_label, c.classification_confidence,
        c.urgency_level, c.status,
        c.created_at, c.assigned_at, c.started_at,
        u.name as citizen_name, u.email as citizen_email, u.phone as citizen_phone
      FROM complaints c
      LEFT JOIN users u ON c.user_id = u.user_id
      WHERE ${f.where}
      ORDER BY c.created_at DESC ${page}`,
      params
    );
  } catch (error) {
    throw AppError.wrap(error, 'Failed to get officer complaints');
  }
};

// Resolve the officers.officer_id for a logged-in user (or null)
const getOfficerIdForUser = async (userId) => {
  const row = await db.oneOrNone('SELECT officer_id FROM officers WHERE user_id = $1', [userId]);
  return row ? row.officer_id : null;
};

// Complaints assigned to the officer identified by their user id
const getAssignedComplaintsForUser = async (userId, filters = {}) => {
  const officerId = await getOfficerIdForUser(userId);
  if (!officerId) throw AppError.notFound('Officer profile not found');
  return getOfficerComplaints(officerId, filters);
};

// Update complaint status
const updateComplaintStatus = async (complaintId, newStatus, changedBy, comment) => {
  try {
    return await db.tx(async (t) => {
      const complaint = await t.oneOrNone(
        'SELECT status FROM complaints WHERE complaint_id = $1',
        [complaintId]
      );

      if (!complaint) {
        throw AppError.notFound('Complaint not found');
      }

      const oldStatus = complaint.status;

      const updated = await t.one(
        `UPDATE complaints
         SET status = $1${newStatus === 'assigned' ? ', assigned_at = CURRENT_TIMESTAMP' : ''}
             ${newStatus === 'in_progress' ? ', started_at = CURRENT_TIMESTAMP' : ''}
             ${newStatus === 'resolved' ? ', resolved_at = CURRENT_TIMESTAMP' : ''},
             updated_at = CURRENT_TIMESTAMP
         WHERE complaint_id = $2
         RETURNING complaint_id, status, updated_at`,
        [newStatus, complaintId]
      );

      await t.none(
        `INSERT INTO complaint_history (complaint_id, old_status, new_status, changed_by, comment)
         VALUES ($1, $2, $3, $4, $5)`,
        [complaintId, oldStatus, newStatus, changedBy, comment || null]
      );

      return updated;
    });
  } catch (error) {
    throw AppError.wrap(error, 'Failed to update complaint status');
  }
};

// Officer-facing status update: validates status, checks assignment, updates,
// and sends the citizen a (non-blocking) status email.
const updateStatusByOfficer = async (complaintId, status, userId, comment) => {
  if (!OFFICER_STATUSES.includes(status)) {
    throw AppError.badRequest('Invalid status');
  }

  const owned = await db.oneOrNone(
    `SELECT o.officer_id FROM officers o
     JOIN complaints c ON c.assigned_officer_id = o.officer_id
     WHERE o.user_id = $1 AND c.complaint_id = $2`,
    [userId, complaintId]
  );
  if (!owned) {
    throw AppError.forbidden('This complaint is not assigned to you');
  }

  const updated = await updateComplaintStatus(complaintId, status, userId, comment);

  // Email the citizen without blocking or failing the request
  (async () => {
    const citizen = await db.oneOrNone(
      `SELECT u.name AS citizen_name, u.email AS citizen_email
       FROM complaints c JOIN users u ON c.user_id = u.user_id
       WHERE c.complaint_id = $1`,
      [complaintId]
    );
    if (citizen && citizen.citizen_email) {
      await sendComplaintStatusUpdateEmail(citizen.citizen_email, citizen.citizen_name, complaintId, status);
    }
  })().catch((err) => {
    console.error('Email error (non-blocking):', err.message);
  });

  return updated;
};

// Resolve complaint with image
const resolveComplaint = async (complaintId, resolutionImage, comments, officerId, changedByUserId) => {
  try {
    return await db.tx(async (t) => {
      const current = await t.oneOrNone(
        'SELECT status FROM complaints WHERE complaint_id = $1 AND assigned_officer_id = $2 FOR UPDATE',
        [complaintId, officerId]
      );
      if (!current) {
        throw AppError.notFound('Complaint not found or not assigned to you');
      }

      const updated = await t.one(
        `UPDATE complaints
         SET status = 'resolved',
             resolution_image_path = $1,
             resolution_description = $2,
             resolved_at = CURRENT_TIMESTAMP,
             updated_at = CURRENT_TIMESTAMP
         WHERE complaint_id = $3
         RETURNING complaint_id, status, resolved_at`,
        [resolutionImage, comments, complaintId]
      );

      // changed_by references users.user_id (not officers.officer_id)
      await t.none(
        `INSERT INTO complaint_history (complaint_id, old_status, new_status, changed_by, comment)
         VALUES ($1, $2, 'resolved', $3, $4)`,
        [complaintId, current.status, changedByUserId, comments || null]
      );

      return updated;
    });
  } catch (error) {
    throw AppError.wrap(error, 'Failed to resolve complaint');
  }
};

// Officer-facing resolve (looks up the officer profile from the user id)
const resolveComplaintForUser = async (complaintId, resolutionImage, comments, userId) => {
  if (!resolutionImage) {
    throw AppError.badRequest('Resolution image is required');
  }
  const officerId = await getOfficerIdForUser(userId);
  if (!officerId) throw AppError.notFound('Officer profile not found');
  return resolveComplaint(complaintId, resolutionImage, comments, officerId, userId);
};

// Get complaint status history
const getComplaintHistory = async (complaintId) => {
  try {
    return await db.manyOrNone(
      `SELECT
        history_id, complaint_id, old_status, new_status,
        changed_by, comment, created_at
       FROM complaint_history
       WHERE complaint_id = $1
       ORDER BY created_at ASC`,
      [complaintId]
    );
  } catch (error) {
    throw AppError.wrap(error, 'Failed to get complaint history');
  }
};

// Fetch a complaint and enforce that the caller owns it, is the assigned
// officer, or is an admin. Throws 404/403.
const getAuthorizedComplaint = async (complaintId, user, forbiddenMessage = 'Not authorized to view this complaint') => {
  const complaint = await getComplaintById(complaintId);
  if (!complaint) throw AppError.notFound('Complaint not found');

  const currentUserId = Number(user.user_id);
  const isOwner = currentUserId === Number(complaint.user_id);
  const isAssignedOfficer = currentUserId === Number(complaint.officer_user_id);
  if (!isOwner && !isAssignedOfficer && user.role !== 'admin') {
    throw AppError.forbidden(forbiddenMessage);
  }
  return complaint;
};

const allFilter = ({ status, category, ward_id, dateFrom, dateTo } = {}) => {
  const f = createFilter('1=1');
  if (status) f.add('c.status = ?', status);
  if (category) f.add('c.category = ?', category);
  if (ward_id) f.add('c.ward_id = ?', ward_id);
  if (dateFrom) f.add('c.created_at >= ?', dateFrom);
  if (dateTo) f.add('c.created_at <= ?', dateTo);
  return f;
};

// Get all complaints for admin (with filters)
const getAllComplaints = async (filters = {}) => {
  const { limit = 100, offset = 0 } = filters;
  const f = allFilter(filters);
  const params = f.params;
  const page = pageClause(params, limit, offset);

  try {
    return await db.manyOrNone(
      `SELECT
        c.complaint_id, c.user_id, c.title, c.description,
        c.image_path, c.latitude, c.longitude, c.area, c.ward_id,
        c.category, c.classified_label, c.classification_confidence,
        c.urgency_level, c.assigned_officer_id,
        c.status, c.created_at, c.resolved_at,
        u.name as citizen_name, o.user_id as officer_user_id
      FROM complaints c
      LEFT JOIN users u ON c.user_id = u.user_id
      LEFT JOIN officers o ON c.assigned_officer_id = o.officer_id
      WHERE ${f.where}
      ORDER BY c.created_at DESC ${page}`,
      params
    );
  } catch (error) {
    throw AppError.wrap(error, 'Failed to get complaints');
  }
};

// Total rows matching the same filters as getAllComplaints (ignores limit/offset)
const countAllComplaints = async (filters = {}) => {
  const f = allFilter(filters);
  try {
    return await countRows(`complaints c WHERE ${f.where}`, f.params);
  } catch (error) {
    throw AppError.wrap(error, 'Failed to count complaints');
  }
};

module.exports = {
  createComplaint,
  getComplaintById,
  getComplaintsByUser,
  countComplaintsByUser,
  getComplaintSummaryByUser,
  getOfficerComplaints,
  getAssignedComplaintsForUser,
  updateComplaintStatus,
  updateStatusByOfficer,
  resolveComplaint,
  resolveComplaintForUser,
  getComplaintHistory,
  getAuthorizedComplaint,
  getAllComplaints,
  countAllComplaints,
};

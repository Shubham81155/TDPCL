// src/services/complaintService.js
// Complaint Service - CRUD operations and complaint management

const { db } = require('../config/database');

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
    category,
    urgency_level = 'medium',
  } = complaintData;

  try {
    // Create GIS point from coordinates
    const complaint = await db.one(
      `INSERT INTO complaints (
        user_id, title, description, image_path, 
        location, latitude, longitude, area, 
        category, urgency_level, status, created_at
      ) VALUES ($1, $2, $3, $4, 
        ST_GeomFromText('POINT(${longitude} ${latitude})', 4326),
        $5, $6, $7, $8, $9, 'new', CURRENT_TIMESTAMP)
       RETURNING complaint_id, user_id, title, description, 
                 image_path, latitude, longitude, area, 
                 category,
                 urgency_level, status, created_at`,
      [
        user_id,
        title,
        description,
        image_path,
        latitude,
        longitude,
        area,
        category,
        urgency_level,
      ]
    );

    return complaint;
  } catch (error) {
    throw new Error(`Failed to create complaint: ${error.message}`);
  }
};

// Get complaint by ID
const getComplaintById = async (complaintId) => {
  try {
    const complaint = await db.oneOrNone(
      `SELECT 
        c.complaint_id, c.user_id, c.title, c.description,
        c.image_path, c.latitude, c.longitude, c.area,
        c.category, c.classified_label, c.classification_confidence,
        c.urgency_level, c.assigned_officer_id,
        c.status, c.resolution_description, c.resolution_image_path,
        c.created_at, c.assigned_at, c.started_at, c.resolved_at,
        u.name as citizen_name, u.email as citizen_email, u.phone as citizen_phone,
        o.user_id as officer_user_id
       FROM complaints c
       LEFT JOIN users u ON c.user_id = u.user_id
       LEFT JOIN officers o ON c.assigned_officer_id = o.officer_id
       WHERE c.complaint_id = $1`,
      [complaintId]
    );

    return complaint;
  } catch (error) {
    throw new Error(`Failed to get complaint: ${error.message}`);
  }
};

// Get complaints by user (citizen)
const getComplaintsByUser = async (userId, filters = {}) => {
  const { status, category, dateFrom, dateTo, limit = 20, offset = 0 } = filters;

  let query = `
    SELECT 
      c.complaint_id, c.user_id, c.title, c.description,
      c.image_path, c.latitude, c.longitude, c.area,
      c.category, c.classified_label, c.classification_confidence,
      c.urgency_level, c.assigned_officer_id,
      c.status, c.resolution_image_path,
      c.created_at, c.assigned_at, c.resolved_at
    FROM complaints c
    WHERE c.user_id = $1
  `;

  const params = [userId];
  let paramIndex = 2;

  // Add filters
  if (status) {
    query += ` AND c.status = $${paramIndex}`;
    params.push(status);
    paramIndex++;
  }

  if (category) {
    query += ` AND c.category = $${paramIndex}`;
    params.push(category);
    paramIndex++;
  }

  if (dateFrom) {
    query += ` AND c.created_at >= $${paramIndex}`;
    params.push(dateFrom);
    paramIndex++;
  }

  if (dateTo) {
    query += ` AND c.created_at <= $${paramIndex}`;
    params.push(dateTo);
    paramIndex++;
  }

  query += ` ORDER BY c.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(limit, offset);

  try {
    const complaints = await db.manyOrNone(query, params);
    return complaints;
  } catch (error) {
    throw new Error(`Failed to get complaints: ${error.message}`);
  }
};

// Get complaints assigned to officer
const getOfficerComplaints = async (officerId, filters = {}) => {
  const { status, limit = 20, offset = 0 } = filters;

  let query = `
    SELECT 
      c.complaint_id, c.user_id, c.title, c.description,
      c.image_path, c.latitude, c.longitude, c.area,
      c.category, c.classified_label, c.classification_confidence,
      c.urgency_level, c.status,
      c.created_at, c.assigned_at, c.started_at,
      u.name as citizen_name, u.email as citizen_email, u.phone as citizen_phone
    FROM complaints c
    LEFT JOIN users u ON c.user_id = u.user_id
    WHERE c.assigned_officer_id = $1
  `;

  const params = [officerId];
  let paramIndex = 2;

  if (status) {
    query += ` AND c.status = $${paramIndex}`;
    params.push(status);
    paramIndex++;
  }

  query += ` ORDER BY c.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(limit, offset);

  try {
    const complaints = await db.manyOrNone(query, params);
    return complaints;
  } catch (error) {
    throw new Error(`Failed to get officer complaints: ${error.message}`);
  }
};

// Update complaint status
const updateComplaintStatus = async (complaintId, newStatus, changedBy, comment) => {
  try {
    // Get old status
    const complaint = await db.oneOrNone(
      'SELECT status FROM complaints WHERE complaint_id = $1',
      [complaintId]
    );

    if (!complaint) {
      throw new Error('Complaint not found');
    }

    const oldStatus = complaint.status;

    // Update complaint status
    const updateData = {
      complaint_id: complaintId,
      new_status: newStatus,
      timestamp: new Date(),
    };

    if (newStatus === 'assigned') {
      updateData.assigned_at = new Date();
    } else if (newStatus === 'in_progress') {
      updateData.started_at = new Date();
    } else if (newStatus === 'resolved') {
      updateData.resolved_at = new Date();
    }

    const updated = await db.one(
      `UPDATE complaints 
       SET status = $1${newStatus === 'assigned' ? ', assigned_at = CURRENT_TIMESTAMP' : ''}
           ${newStatus === 'in_progress' ? ', started_at = CURRENT_TIMESTAMP' : ''}
           ${newStatus === 'resolved' ? ', resolved_at = CURRENT_TIMESTAMP' : ''},
           updated_at = CURRENT_TIMESTAMP
       WHERE complaint_id = $2
       RETURNING complaint_id, status, updated_at`,
      [newStatus, complaintId]
    );

    // Log status change in history
    await db.none(
      `INSERT INTO complaint_history (complaint_id, old_status, new_status, changed_by, comment)
       VALUES ($1, $2, $3, $4, $5)`,
      [complaintId, oldStatus, newStatus, changedBy, comment || null]
    );

    return updated;
  } catch (error) {
    throw new Error(`Failed to update complaint status: ${error.message}`);
  }
};

// Resolve complaint with image
const resolveComplaint = async (complaintId, resolutionImage, comments, officerId) => {
  try {
    const updated = await db.one(
      `UPDATE complaints 
       SET status = 'resolved',
           resolution_image_path = $1,
           resolution_description = $2,
           resolved_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE complaint_id = $3 AND assigned_officer_id = $4
       RETURNING complaint_id, status, resolved_at`,
      [resolutionImage, comments, complaintId, officerId]
    );

    // Log in history
    await db.none(
      `INSERT INTO complaint_history (complaint_id, old_status, new_status, changed_by, comment)
       VALUES ($1, 'in_progress', 'resolved', $2, $3)`,
      [complaintId, officerId, comments || null]
    );

    return updated;
  } catch (error) {
    throw new Error(`Failed to resolve complaint: ${error.message}`);
  }
};

// Get complaint status history
const getComplaintHistory = async (complaintId) => {
  try {
    const history = await db.manyOrNone(
      `SELECT 
        history_id, complaint_id, old_status, new_status,
        changed_by, comment, created_at
       FROM complaint_history
       WHERE complaint_id = $1
       ORDER BY created_at ASC`,
      [complaintId]
    );

    return history;
  } catch (error) {
    throw new Error(`Failed to get complaint history: ${error.message}`);
  }
};

// Get all complaints for admin (with filters)
const getAllComplaints = async (filters = {}) => {
  const { status, category, ward_id, dateFrom, dateTo, limit = 100, offset = 0 } = filters;

  let query = `
    SELECT 
      c.complaint_id, c.user_id, c.title, c.description,
      c.image_path, c.latitude, c.longitude, c.area, c.ward_id,
      c.category, c.classified_label, c.classification_confidence,
      c.urgency_level, c.assigned_officer_id,
      c.status, c.created_at, c.resolved_at,
      u.name as citizen_name, o.user_id as officer_user_id
    FROM complaints c
    LEFT JOIN users u ON c.user_id = u.user_id
    LEFT JOIN officers o ON c.assigned_officer_id = o.officer_id
    WHERE 1=1
  `;

  const params = [];
  let paramIndex = 1;

  if (status) {
    query += ` AND c.status = $${paramIndex}`;
    params.push(status);
    paramIndex++;
  }

  if (category) {
    query += ` AND c.category = $${paramIndex}`;
    params.push(category);
    paramIndex++;
  }

  if (ward_id) {
    query += ` AND c.ward_id = $${paramIndex}`;
    params.push(ward_id);
    paramIndex++;
  }

  if (dateFrom) {
    query += ` AND c.created_at >= $${paramIndex}`;
    params.push(dateFrom);
    paramIndex++;
  }

  if (dateTo) {
    query += ` AND c.created_at <= $${paramIndex}`;
    params.push(dateTo);
    paramIndex++;
  }

  query += ` ORDER BY c.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
  params.push(limit, offset);

  try {
    const complaints = await db.manyOrNone(query, params);
    return complaints;
  } catch (error) {
    throw new Error(`Failed to get complaints: ${error.message}`);
  }
};

module.exports = {
  createComplaint,
  getComplaintById,
  getComplaintsByUser,
  getOfficerComplaints,
  updateComplaintStatus,
  resolveComplaint,
  getComplaintHistory,
  getAllComplaints,
};

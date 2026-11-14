// src/services/assignmentService.js
// Assignment Service - Geolocation-based complaint routing to officers

const { db } = require('../config/database');

/**
 * Auto-assign complaint to nearest officer
 * Uses PostGIS spatial queries for distance calculation
 * Algorithm: Find officer within assigned ward, closest to complaint location
 * Fallback: Find officer with lowest current workload
 */
const autoAssignComplaint = async (complaintId) => {
  try {
    // Get complaint location
    const complaint = await db.oneOrNone(
      `SELECT complaint_id, latitude, longitude, ward_id, location
       FROM complaints WHERE complaint_id = $1`,
      [complaintId]
    );

    if (!complaint) {
      throw new Error('Complaint not found');
    }

    // Find best officer using PostGIS
    const officer = await db.oneOrNone(
      `SELECT 
        o.officer_id, o.user_id, 
        u.name as officer_name, u.phone as officer_phone, u.email as officer_email,
        ST_Distance(o.location::geography, $1::geography) AS distance_meters,
        COUNT(c.complaint_id) FILTER (WHERE c.status NOT IN ('resolved', 'rejected')) AS current_workload
       FROM officers o
       JOIN users u ON o.user_id = u.user_id
       LEFT JOIN complaints c ON o.officer_id = c.assigned_officer_id
       WHERE o.status = 'active'
         AND (o.assigned_ward_id = $2 OR o.assigned_ward_id IS NULL)
       GROUP BY o.officer_id, u.name, u.phone, u.email, distance_meters
       ORDER BY current_workload ASC, distance_meters ASC
       LIMIT 1`,
      [`POINT(${complaint.longitude} ${complaint.latitude})`, complaint.ward_id]
    );

    if (!officer) {
      throw new Error('No available officers found for this area');
    }

    // Assign complaint to officer
    const assigned = await db.one(
      `UPDATE complaints 
       SET assigned_officer_id = $1,
           status = 'assigned',
           assigned_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE complaint_id = $2
       RETURNING complaint_id, assigned_officer_id, status, assigned_at`,
      [officer.officer_id, complaintId]
    );

    // Log in history
    await db.none(
      `INSERT INTO complaint_history (complaint_id, old_status, new_status, changed_by, comment)
       VALUES ($1, 'new', 'assigned', NULL, $2)`,
      [complaintId, `Auto-assigned to Officer: ${officer.officer_name}`]
    );

    return {
      ...assigned,
      officer: {
        officer_id: officer.officer_id,
        name: officer.officer_name,
        phone: officer.officer_phone,
        email: officer.officer_email,
        distance_meters: Math.round(officer.distance_meters),
        current_workload: parseInt(officer.current_workload || 0),
      },
    };
  } catch (error) {
    throw new Error(`Auto-assignment failed: ${error.message}`);
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
         AND (o.assigned_ward_id = $2 OR o.assigned_ward_id IS NULL)
       GROUP BY o.officer_id, u.name, u.phone, o.assigned_area_name, distance_meters
       ORDER BY distance_meters ASC
       LIMIT $3`,
      [`POINT(${longitude} ${latitude})`, wardId, limit]
    );

    return officers;
  } catch (error) {
    throw new Error(`Failed to find nearby officers: ${error.message}`);
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
      throw new Error('Officer not found');
    }

    // Get old assignment
    const complaint = await db.oneOrNone(
      'SELECT assigned_officer_id, status FROM complaints WHERE complaint_id = $1',
      [complaintId]
    );

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
    throw new Error(`Manual assignment failed: ${error.message}`);
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
    throw new Error(`Failed to get workload: ${error.message}`);
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
    throw new Error(`Workload balancing failed: ${error.message}`);
  }
};

module.exports = {
  autoAssignComplaint,
  findNearestOfficers,
  manualAssign,
  getOfficerWorkload,
  balanceWorkload,
};

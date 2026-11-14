// src/routes/admin.js
// Admin Dashboard Routes

const express = require('express');
const router = express.Router();
const complaintService = require('../services/complaintService');
const officerService = require('../services/officerService');
const { db } = require('../config/database');
const { verifyToken, checkRole } = require('../middleware/auth');

// Get complaints statistics (Admin)
router.get('/stats/complaints', verifyToken, checkRole('admin'), async (req, res) => {
  try {
    const stats = await db.oneOrNone(
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
       FROM complaints`
    );

    res.json({
      success: true,
      stats,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

// Get complaints by category
router.get('/stats/by-category', verifyToken, checkRole('admin'), async (req, res) => {
  try {
    const stats = await db.manyOrNone(
      `SELECT 
        category,
        COUNT(*) as count,
        COUNT(*) FILTER (WHERE status = 'resolved') as resolved
       FROM complaints
       GROUP BY category
       ORDER BY count DESC`
    );

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

// Get complaints by ward
router.get('/stats/by-ward', verifyToken, checkRole('admin'), async (req, res) => {
  try {
    const stats = await db.manyOrNone(
      `SELECT 
        w.ward_id, w.name,
        COUNT(c.complaint_id) as total_complaints,
        COUNT(c.complaint_id) FILTER (WHERE c.status = 'resolved') as resolved,
        COUNT(o.officer_id) as officer_count
       FROM wards w
       LEFT JOIN complaints c ON w.ward_id = c.ward_id
       LEFT JOIN officers o ON w.ward_id = o.assigned_ward_id AND o.status = 'active'
       GROUP BY w.ward_id, w.name
       ORDER BY total_complaints DESC`
    );

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

// Get officer performance leaderboard
router.get('/stats/officer-performance', verifyToken, checkRole('admin'), async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;

    const stats = await db.manyOrNone(
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
       LEFT JOIN complaints c ON o.officer_id = c.assigned_officer_id
       WHERE o.status = 'active'
       GROUP BY o.officer_id, u.name
       ORDER BY resolved DESC
       LIMIT $1`,
      [limit]
    );

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

// Get complaints with filters for export/reporting
router.get('/complaints', verifyToken, checkRole('admin'), async (req, res) => {
  try {
    const { status, category, ward_id, dateFrom, dateTo, limit = 1000, offset = 0 } = req.query;

    const filters = {
      status,
      category,
      ward_id: ward_id ? parseInt(ward_id) : null,
      dateFrom: dateFrom ? new Date(dateFrom) : null,
      dateTo: dateTo ? new Date(dateTo) : null,
      limit: parseInt(limit),
      offset: parseInt(offset),
    };

    const complaints = await complaintService.getAllComplaints(filters);

    res.json({
      success: true,
      data: complaints,
      count: complaints.length,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

// Get complaint density heatmap data
router.post('/heatmap', verifyToken, checkRole('admin'), async (req, res) => {
  try {
    const heatmapData = await db.manyOrNone(
      `SELECT 
        ST_X(location::geometry) as longitude,
        ST_Y(location::geometry) as latitude,
        COUNT(*) as complaint_count,
        MAX(CASE WHEN urgency_level = 'high' THEN 1 ELSE 0 END) as has_urgent
       FROM complaints
       WHERE location IS NOT NULL
       GROUP BY ST_X(location::geometry), ST_Y(location::geometry)
       HAVING COUNT(*) > 0`
    );

    res.json({
      success: true,
      data: heatmapData,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

// Get system audit logs
router.get('/audit-logs', verifyToken, checkRole('admin'), async (req, res) => {
  try {
    const { limit = 100, offset = 0 } = req.query;

    const logs = await db.manyOrNone(
      `SELECT 
        al.log_id, al.user_id,
        u.name as user_name,
        al.action, al.entity_type, al.entity_id,
        al.ip_address, al.created_at
       FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.user_id
       ORDER BY al.created_at DESC
       LIMIT $1 OFFSET $2`,
      [parseInt(limit), parseInt(offset)]
    );

    res.json({
      success: true,
      data: logs,
      count: logs.length,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

// CSV cell escaping (quotes, commas, newlines) + spreadsheet formula-injection guard
const csvCell = (value) => {
  if (value === null || value === undefined) return '';
  let text = value instanceof Date ? value.toISOString() : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

// Export report data as CSV
router.get('/report/export', verifyToken, checkRole('admin'), async (req, res) => {
  try {
    const { status, category, ward_id, dateFrom, dateTo } = req.query;

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

    const header = ['Complaint ID', 'Title', 'Citizen', 'Category', 'Urgency', 'Status', 'Area', 'Ward', 'Officer', 'Created At', 'Assigned At', 'Resolved At'];
    const lines = data.map((r) =>
      [r.complaint_id, r.title, r.citizen_name, r.category, r.urgency_level, r.status, r.area,
        r.ward_name || 'Unknown', r.officer_name || 'Unassigned', r.created_at, r.assigned_at, r.resolved_at]
        .map(csvCell)
        .join(',')
    );

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="complaints-report.csv"');
    res.send('﻿' + [header.join(','), ...lines].join('\r\n') + '\r\n');
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;

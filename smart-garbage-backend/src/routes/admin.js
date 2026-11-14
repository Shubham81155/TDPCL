// src/routes/admin.js
// Admin Dashboard Routes

const express = require('express');
const router = express.Router();
const complaintService = require('../services/complaintService');
const adminService = require('../services/adminService');
const AppError = require('../utils/AppError');
const { verifyToken, checkRole } = require('../middleware/auth');
const { parsePagination, parseOptionalInt, parseOptionalDate } = require('../utils/pagination');

// Get complaints statistics (Admin)
router.get('/stats/complaints', verifyToken, checkRole('admin'), async (req, res) => {
  const stats = await adminService.getComplaintStats();
  res.json({ success: true, stats });
});

// Get complaints by category
router.get('/stats/by-category', verifyToken, checkRole('admin'), async (req, res) => {
  const stats = await adminService.getStatsByCategory();
  res.json({ success: true, data: stats });
});

// Get complaints by ward
router.get('/stats/by-ward', verifyToken, checkRole('admin'), async (req, res) => {
  const stats = await adminService.getStatsByWard();
  res.json({ success: true, data: stats });
});

// Get officer performance leaderboard
router.get('/stats/officer-performance', verifyToken, checkRole('admin'), async (req, res) => {
  const { limit } = parsePagination(req.query, { defaultLimit: 10, maxLimit: 100 });
  const stats = await adminService.getOfficerPerformance(limit);
  res.json({ success: true, data: stats });
});

// Get complaints with filters for export/reporting
router.get('/complaints', verifyToken, checkRole('admin'), async (req, res) => {
  const { status, category, ward_id, dateFrom, dateTo } = req.query;
  const { limit, offset } = parsePagination(req.query, { defaultLimit: 1000, maxLimit: 1000 });

  const filters = {
    status,
    category,
    ward_id: parseOptionalInt(ward_id),
    dateFrom: parseOptionalDate(dateFrom, 'dateFrom'),
    dateTo: parseOptionalDate(dateTo, 'dateTo'),
    limit,
    offset,
  };

  const [complaints, total] = await Promise.all([
    complaintService.getAllComplaints(filters),
    complaintService.countAllComplaints(filters),
  ]);

  res.json({
    success: true,
    data: complaints,
    count: complaints.length,
    total,
  });
});

// Get complaint density heatmap data
router.post('/heatmap', verifyToken, checkRole('admin'), async (req, res) => {
  const heatmapData = await adminService.getHeatmapData();
  res.json({ success: true, data: heatmapData });
});

// Get system audit logs
router.get('/audit-logs', verifyToken, checkRole('admin'), async (req, res) => {
  const { limit, offset } = parsePagination(req.query, { defaultLimit: 100, maxLimit: 100 });
  const logs = await adminService.getAuditLogs({ limit, offset });

  res.json({
    success: true,
    data: logs,
    count: logs.length,
  });
});

// Export report data as CSV
router.get('/report/export', verifyToken, checkRole('admin'), async (req, res, next) => {
  let csv;
  try {
    csv = await adminService.exportComplaintsCsv(req.query);
  } catch (error) {
    // AppErrors go to the central handler. Any other failure keeps this
    // endpoint's historical 400 JSON contract (tests/unit/adminExport.test.js
    // mounts this router without an error handler).
    if (error instanceof AppError) return next(error);
    return res.status(400).json({ success: false, error: error.message });
  }

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="complaints-report.csv"');
  res.send(csv);
});

module.exports = router;

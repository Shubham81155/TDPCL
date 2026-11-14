// src/routes/admin.js
// Admin Dashboard Routes

const express = require('express');
const router = express.Router();
const complaintService = require('../services/complaintService');
const adminService = require('../services/adminService');
const AppError = require('../utils/AppError');
const { verifyToken, checkRole } = require('../middleware/auth');
const { parsePagination, parseOptionalInt, parseOptionalDate, parseDateRange } = require('../utils/pagination');

const COMPLAINT_STATUSES = ['new', 'assigned', 'pending', 'in_progress', 'resolved', 'rejected'];

// Get complaints statistics (Admin); optional dateFrom/dateTo
router.get('/stats/complaints', verifyToken, checkRole('admin'), async (req, res) => {
  const stats = await adminService.getComplaintStats(parseDateRange(req.query));
  res.json({ success: true, stats });
});

// Get complaints by category
router.get('/stats/by-category', verifyToken, checkRole('admin'), async (req, res) => {
  const stats = await adminService.getStatsByCategory(parseDateRange(req.query));
  res.json({ success: true, data: stats });
});

// Get complaints by ward
router.get('/stats/by-ward', verifyToken, checkRole('admin'), async (req, res) => {
  const stats = await adminService.getStatsByWard(parseDateRange(req.query));
  res.json({ success: true, data: stats });
});

// Get officer performance leaderboard
router.get('/stats/officer-performance', verifyToken, checkRole('admin'), async (req, res) => {
  const { limit } = parsePagination(req.query, { defaultLimit: 10, maxLimit: 100 });
  const stats = await adminService.getOfficerPerformance(limit, parseDateRange(req.query));
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

// Heatmap with optional filters (dateFrom, dateTo, status, category)
router.get('/heatmap', verifyToken, checkRole('admin'), async (req, res) => {
  const { dateFrom, dateTo } = parseDateRange(req.query);
  const { status, category } = req.query;
  if (status !== undefined && status !== '' && !COMPLAINT_STATUSES.includes(status)) {
    throw new AppError('Invalid status', 400);
  }
  if (category !== undefined && (typeof category !== 'string' || !category.trim())) {
    throw new AppError('Invalid category', 400);
  }
  const data = await adminService.getHeatmapData({
    dateFrom,
    dateTo,
    status: status || null,
    category: category ? category.trim() : null,
  });
  res.json({ success: true, data });
});

// Get complaint density heatmap data (legacy, unfiltered)
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

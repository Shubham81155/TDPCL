// src/routes/complaints.js
// Complaint Routes for Citizens and Officers
// Handlers are plain async functions: errors (AppError or otherwise) reach the
// central error handler via express-async-errors.

const express = require('express');
const router = express.Router();
const complaintService = require('../services/complaintService');
const { submitComplaint } = require('../services/complaintSubmissionService');
const { verifyToken, checkRole } = require('../middleware/auth');
const upload = require('../middleware/multer');
const { parsePagination, parseId, parseOptionalDate } = require('../utils/pagination');

// Create new complaint with image upload (Citizen)
router.post('/', verifyToken, checkRole('citizen'), upload.single('image'), async (req, res) => {
  const assignment = await submitComplaint({ user: req.user, body: req.body, file: req.file });

  res.status(201).json({
    success: true,
    message: 'Complaint submitted successfully',
    complaint: assignment,
  });
});

// Get user's complaints (Citizen)
router.get('/', verifyToken, checkRole('citizen'), async (req, res) => {
  const { status, category, dateFrom, dateTo } = req.query;
  const { limit, offset } = parsePagination(req.query, { defaultLimit: 20, maxLimit: 100 });

  const filters = {
    status,
    category,
    dateFrom: parseOptionalDate(dateFrom, 'dateFrom'),
    dateTo: parseOptionalDate(dateTo, 'dateTo'),
    limit,
    offset,
  };

  const [complaints, total] = await Promise.all([
    complaintService.getComplaintsByUser(req.user.user_id, filters),
    complaintService.countComplaintsByUser(req.user.user_id, filters),
  ]);

  res.json({
    success: true,
    data: complaints,
    count: complaints.length,
    total,
  });
});

// Get officer's assigned complaints
router.get('/officer/assigned', verifyToken, checkRole('officer'), async (req, res) => {
  const { status } = req.query;
  const { limit, offset } = parsePagination(req.query, { defaultLimit: 20, maxLimit: 100 });

  const complaints = await complaintService.getAssignedComplaintsForUser(req.user.user_id, {
    status,
    limit,
    offset,
  });

  res.json({
    success: true,
    data: complaints,
    count: complaints.length,
  });
});

// Get complaint by ID (Citizen owner, assigned Officer, Admin)
router.get('/:id(\\d+)', verifyToken, async (req, res) => {
  const complaint = await complaintService.getAuthorizedComplaint(
    parseId(req.params.id, 'complaint id'),
    req.user,
    'Not authorized to view this complaint'
  );

  res.json({ success: true, complaint });
});

// Get complaint history (Citizen - owner, Officer - assigned, Admin)
router.get('/:id(\\d+)/timeline', verifyToken, async (req, res) => {
  const id = parseId(req.params.id, 'complaint id');
  await complaintService.getAuthorizedComplaint(id, req.user, 'Not authorized');

  const history = await complaintService.getComplaintHistory(id);

  res.json({ success: true, timeline: history });
});

// Update complaint status (Officer)
router.patch('/:id(\\d+)/status', verifyToken, checkRole('officer'), async (req, res) => {
  const { status, comment } = req.body || {};

  const updated = await complaintService.updateStatusByOfficer(
    req.params.id,
    status,
    req.user.user_id,
    comment
  );

  res.json({
    success: true,
    message: `Complaint status updated to ${status}`,
    complaint: updated,
  });
});

// Resolve complaint with image (Officer)
router.post('/:id(\\d+)/resolve', verifyToken, checkRole('officer'), async (req, res) => {
  const { resolution_image_path, comments } = req.body || {};

  const resolved = await complaintService.resolveComplaintForUser(
    req.params.id,
    resolution_image_path,
    comments,
    req.user.user_id
  );

  res.json({
    success: true,
    message: 'Complaint resolved successfully',
    complaint: resolved,
  });
});

module.exports = router;

// src/routes/assignments.js
// Complaint Assignment and Geolocation Routes

const express = require('express');
const router = express.Router();
const assignmentService = require('../services/assignmentService');
const wardService = require('../services/wardService');
const officerService = require('../services/officerService');
const AppError = require('../utils/AppError');
const { verifyToken, checkRole } = require('../middleware/auth');
const { parsePagination, parseId } = require('../utils/pagination');

// Auto-assign complaint (admin / officer)
router.post('/auto-assign/:complaintId', verifyToken, checkRole('admin', 'officer'), async (req, res) => {
  const result = await assignmentService.autoAssignComplaint(parseId(req.params.complaintId, 'complaint id'));

  res.json({
    success: true,
    message: 'Complaint auto-assigned successfully',
    assignment: result,
  });
});

// Retry auto-assignment for every complaint still waiting for an officer (admin)
router.post('/auto-assign-unassigned', verifyToken, checkRole('admin'), async (req, res) => {
  const result = await assignmentService.assignUnassigned();

  res.json({
    success: true,
    message: result.assigned
      ? `${result.assigned} complaint(s) assigned`
      : result.checked
        ? 'No available officer for the waiting complaints'
        : 'No complaints are waiting for an officer',
    ...result,
  });
});

// Manually assign complaint (Admin override)
router.post('/assign/:complaintId', verifyToken, checkRole('admin'), async (req, res) => {
  const complaintId = parseId(req.params.complaintId, 'complaint id');
  const { officer_id } = req.body || {};

  if (!officer_id) {
    throw AppError.badRequest('officer_id is required');
  }

  const result = await assignmentService.manualAssign(
    complaintId,
    parseId(officer_id, 'officer_id'),
    req.user.user_id
  );

  res.json({
    success: true,
    message: 'Complaint assigned to officer',
    assignment: result,
  });
});

// Parse and range-check a coordinate pair from the request body
const requireCoordinates = (body = {}) => {
  const { latitude, longitude } = body;
  if (!latitude || !longitude) {
    throw AppError.badRequest('latitude and longitude are required');
  }
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lng) || lng < -180 || lng > 180) {
    throw AppError.badRequest('Invalid coordinates');
  }
  return { lat, lng };
};

// Find nearest officers to a location
router.post('/nearest-officers', verifyToken, async (req, res) => {
  const body = req.body || {};
  const { lat, lng } = requireCoordinates(body);
  const { limit } = parsePagination({ limit: body.limit }, { defaultLimit: 5, maxLimit: 100 });

  const wardId = body.ward_id === undefined || body.ward_id === null || body.ward_id === ''
    ? null
    : parseId(body.ward_id, 'ward_id');

  const officers = await assignmentService.findNearestOfficers(lat, lng, wardId, limit);

  res.json({
    success: true,
    data: officers,
    count: officers.length,
  });
});

// Get officer workload
router.get('/workload/:officerId', verifyToken, checkRole('admin', 'officer'), async (req, res) => {
  const officerId = parseId(req.params.officerId, 'officer id');
  await officerService.assertOfficerAccess(officerId, req.user);

  const workload = await assignmentService.getOfficerWorkload(officerId);

  res.json({ success: true, workload });
});

// Balance workload in a ward (Admin)
router.post('/balance/:wardId', verifyToken, checkRole('admin'), async (req, res) => {
  const result = await assignmentService.balanceWorkload(parseId(req.params.wardId, 'ward id'));

  res.json({ success: true, ...result });
});

// Get ward by coordinates
router.post('/ward-by-location', verifyToken, async (req, res) => {
  const { lat, lng } = requireCoordinates(req.body);

  const ward = await wardService.getWardByCoordinates(lat, lng);
  if (!ward) throw AppError.notFound('No ward found for this location');

  res.json({ success: true, ward });
});

module.exports = router;

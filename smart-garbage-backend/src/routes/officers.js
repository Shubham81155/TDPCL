// src/routes/officers.js
// Officer Management Routes (Admin only unless noted)

const express = require('express');
const router = express.Router();
const officerService = require('../services/officerService');
const AppError = require('../utils/AppError');
const { verifyToken, checkRole } = require('../middleware/auth');
const { parsePagination, parseId, parseOptionalInt } = require('../utils/pagination');

// Get all officers (Admin)
router.get('/', verifyToken, checkRole('admin'), async (req, res) => {
  const { status, ward_id } = req.query;
  const { limit, offset } = parsePagination(req.query, { defaultLimit: 100, maxLimit: 100 });

  const filters = {
    status: status || 'active',
    wardId: parseOptionalInt(ward_id),
    limit,
    offset,
  };

  const [officers, total] = await Promise.all([
    officerService.getAllOfficers(filters),
    officerService.countOfficers(filters),
  ]);

  res.json({
    success: true,
    data: officers,
    count: officers.length,
    total,
  });
});

// Current officer's own profile / metrics (resolved from the logged-in user)
router.get('/me', verifyToken, checkRole('officer'), async (req, res) => {
  const officer = await officerService.getOfficerProfileForUser(req.user.user_id);
  res.json({ success: true, officer });
});

router.get('/me/metrics', verifyToken, checkRole('officer'), async (req, res) => {
  const metrics = await officerService.getOfficerMetricsForUser(req.user.user_id);
  res.json({ success: true, metrics });
});

// Get officer by ID (Admin, Officer - self)
router.get('/:id', verifyToken, async (req, res) => {
  const officer = await officerService.getOfficerById(parseId(req.params.id, 'officer id'));
  if (!officer) throw AppError.notFound('Officer not found');

  if (req.user.role !== 'admin' && Number(req.user.user_id) !== Number(officer.user_id)) {
    throw AppError.forbidden('Not authorized');
  }

  res.json({ success: true, officer });
});

// Create new officer (Admin only)
router.post('/', verifyToken, checkRole('admin'), async (req, res) => {
  const { email, password, employee_id, assigned_area_name, year_of_joining, name, phone } = req.body || {};

  if (!email || !password || !employee_id) {
    throw AppError.badRequest('Missing required fields: email, password, employee_id');
  }
  if (typeof email !== 'string' || typeof password !== 'string') {
    throw AppError.badRequest('email and password must be strings');
  }

  const joined = year_of_joining ? parseInt(year_of_joining, 10) : new Date().getFullYear();
  if (!Number.isInteger(joined)) {
    throw AppError.badRequest('year_of_joining must be a number');
  }

  const officer = await officerService.createOfficer({
    name: name || email.split('@')[0],
    email,
    phone: phone || '0000000000',
    password,
    employee_id,
    ward_id: null,
    area_name: assigned_area_name || 'Unassigned',
    year_of_joining: joined,
  });

  res.status(201).json({
    success: true,
    message: 'Officer created successfully',
    officer,
  });
});

// Update officer (Admin only)
router.put('/:id', verifyToken, checkRole('admin'), async (req, res) => {
  const officer = await officerService.updateOfficer(parseId(req.params.id, 'officer id'), req.body || {});

  res.json({
    success: true,
    message: 'Officer updated successfully',
    officer,
  });
});

// Update officer location (Officer self-update)
router.post('/:id/location', verifyToken, checkRole('officer'), async (req, res) => {
  const id = parseId(req.params.id, 'officer id');
  const { latitude, longitude } = req.body || {};

  const missing = (v) => v === undefined || v === null || v === '';
  if (missing(latitude) || missing(longitude)) {
    throw AppError.badRequest('Latitude and longitude are required');
  }

  // Verify officer owns this account
  const ownerUserId = await officerService.getOfficerUserId(id);
  if (ownerUserId === null || Number(ownerUserId) !== Number(req.user.user_id)) {
    throw AppError.forbidden('Not authorized');
  }

  const updated = await officerService.updateOfficerLocation(id, latitude, longitude);

  res.json({
    success: true,
    message: 'Location updated successfully',
    officer: updated,
  });
});

// Get officer metrics (Admin, Officer self)
router.get('/:id/metrics', verifyToken, async (req, res) => {
  const id = parseId(req.params.id, 'officer id');
  await officerService.assertOfficerAccess(id, req.user);

  const metrics = await officerService.getOfficerMetrics(id);

  res.json({ success: true, metrics });
});

// Deactivate officer (Admin only)
router.patch('/:id/deactivate', verifyToken, checkRole('admin'), async (req, res) => {
  const updated = await officerService.deactivateOfficer(parseId(req.params.id, 'officer id'));

  res.json({
    success: true,
    message: 'Officer deactivated and complaints reassigned',
    officer: updated,
  });
});

// Delete officer (Admin only)
router.delete('/:id', verifyToken, checkRole('admin'), async (req, res) => {
  await officerService.deleteOfficer(parseId(req.params.id, 'officer id'));

  res.json({
    success: true,
    message: 'Officer deleted successfully',
  });
});

module.exports = router;

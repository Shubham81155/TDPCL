// src/routes/wards.js
// Ward Management Routes (writes are Admin only)

const express = require('express');
const router = express.Router();
const wardService = require('../services/wardService');
const AppError = require('../utils/AppError');
const { verifyToken, checkRole } = require('../middleware/auth');
const { parsePagination, parseId } = require('../utils/pagination');

// Get all wards
router.get('/', verifyToken, async (req, res) => {
  const { city } = req.query;
  const { limit, offset } = parsePagination(req.query, { defaultLimit: 100, maxLimit: 100 });
  const filters = { city, limit, offset };

  const [wards, total] = await Promise.all([
    wardService.getAllWards(filters),
    wardService.countWards(filters),
  ]);

  res.json({
    success: true,
    data: wards,
    count: wards.length,
    total,
  });
});

// Get ward by ID
router.get('/:id', verifyToken, async (req, res) => {
  const id = parseId(req.params.id, 'ward id');

  const ward = await wardService.getWardById(id);
  if (!ward) throw AppError.notFound('Ward not found');

  const officers = await wardService.getWardOfficers(id);

  res.json({ success: true, ward, officers });
});

// Create new ward (Admin only)
router.post('/', verifyToken, checkRole('admin'), async (req, res) => {
  const { name, city, state, boundaries_geojson } = req.body || {};

  if (!name || !city || !state || !boundaries_geojson) {
    throw AppError.badRequest('Missing required fields: name, city, state, boundaries_geojson');
  }

  const ward = await wardService.createWard({ name, city, state, boundaries_geojson });

  res.status(201).json({
    success: true,
    message: 'Ward created successfully',
    ward,
  });
});

// Update ward (Admin only)
router.put('/:id', verifyToken, checkRole('admin'), async (req, res) => {
  const ward = await wardService.updateWard(req.params.id, req.body || {});

  res.json({
    success: true,
    message: 'Ward updated successfully',
    ward,
  });
});

// Get officers in ward
router.get('/:id/officers', verifyToken, async (req, res) => {
  const officers = await wardService.getWardOfficers(parseId(req.params.id, 'ward id'));

  res.json({
    success: true,
    data: officers,
    count: officers.length,
  });
});

module.exports = router;

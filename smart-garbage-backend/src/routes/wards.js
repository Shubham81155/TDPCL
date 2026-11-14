// src/routes/wards.js
// Ward Management Routes (Admin only)

const express = require('express');
const router = express.Router();
const wardService = require('../services/wardService');
const { verifyToken, checkRole } = require('../middleware/auth');

// Get all wards
router.get('/', verifyToken, async (req, res) => {
  try {
    const { city, limit = 100, offset = 0 } = req.query;

    const filters = {
      city,
      limit: parseInt(limit),
      offset: parseInt(offset),
    };

    const wards = await wardService.getAllWards(filters);

    res.json({
      success: true,
      data: wards,
      count: wards.length,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

// Get ward by ID
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    const ward = await wardService.getWardById(id);

    if (!ward) {
      return res.status(404).json({
        success: false,
        error: 'Ward not found',
      });
    }

    // Get officers in this ward
    const officers = await wardService.getWardOfficers(id);

    res.json({
      success: true,
      ward,
      officers,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

// Create new ward (Admin only)
router.post('/', verifyToken, checkRole('admin'), async (req, res) => {
  try {
    const { name, city, state, boundaries_geojson } = req.body || {};

    if (!name || !city || !state || !boundaries_geojson) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: name, city, state, boundaries_geojson',
      });
    }

    const ward = await wardService.createWard({
      name,
      city,
      state,
      boundaries_geojson,
    });

    res.status(201).json({
      success: true,
      message: 'Ward created successfully',
      ward,
    });
  } catch (error) {
    res.status(error.status || 500).json({
      success: false,
      error: error.message,
    });
  }
});

// Update ward (Admin only)
router.put('/:id', verifyToken, checkRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body || {};

    const ward = await wardService.updateWard(id, updateData);

    res.json({
      success: true,
      message: 'Ward updated successfully',
      ward,
    });
  } catch (error) {
    res.status(error.status || 500).json({
      success: false,
      error: error.message,
    });
  }
});

// Get officers in ward
router.get('/:id/officers', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    const officers = await wardService.getWardOfficers(id);

    res.json({
      success: true,
      data: officers,
      count: officers.length,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;

// src/routes/officers.js
// Officer Management Routes (Admin only)

const express = require('express');
const router = express.Router();
const officerService = require('../services/officerService');
const wardService = require('../services/wardService');
const { verifyToken, checkRole } = require('../middleware/auth');

// Get all officers (Admin)
router.get('/', verifyToken, checkRole('admin'), async (req, res) => {
  try {
    const { status, ward_id, limit = 100, offset = 0 } = req.query;

    const filters = {
      status: status || 'active',
      wardId: ward_id ? parseInt(ward_id) : null,
      limit: parseInt(limit),
      offset: parseInt(offset),
    };

    const officers = await officerService.getAllOfficers(filters);

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

// Get officer by ID (Admin, Officer - self)
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check authorization
    const officer = await db.oneOrNone(
      'SELECT user_id FROM officers WHERE officer_id = $1',
      [id]
    );

    if (!officer) {
      return res.status(404).json({
        success: false,
        error: 'Officer not found',
      });
    }

    if (req.user.role !== 'admin' && req.user.user_id !== officer.user_id) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized',
      });
    }

    const officerData = await officerService.getOfficerById(id);

    res.json({
      success: true,
      officer: officerData,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

// Create new officer (Admin only)
router.post('/', verifyToken, checkRole('admin'), async (req, res) => {
  try {
    const { email, password, employee_id, assigned_area_name, year_of_joining, name, phone } = req.body;

    if (!email || !password || !employee_id) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: email, password, employee_id',
      });
    }

    const officerData = {
      name: name || email.split('@')[0],
      email,
      phone: phone || '0000000000',
      password,
      employee_id,
      ward_id: null,
      area_name: assigned_area_name || 'Unassigned',
      year_of_joining: year_of_joining ? parseInt(year_of_joining) : new Date().getFullYear(),
    };

    const officer = await officerService.createOfficer(officerData);

    res.status(201).json({
      success: true,
      message: 'Officer created successfully',
      officer,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

// Update officer (Admin only)
router.put('/:id', verifyToken, checkRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    const officer = await officerService.updateOfficer(id, updateData);

    res.json({
      success: true,
      message: 'Officer updated successfully',
      officer,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

// Update officer location (Officer self-update)
router.post('/:id/location', verifyToken, checkRole('officer'), async (req, res) => {
  try {
    const { id } = req.params;
    const { latitude, longitude } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        error: 'Latitude and longitude are required',
      });
    }

    // Verify officer owns this account
    const officer = await db.oneOrNone(
      'SELECT user_id FROM officers WHERE officer_id = $1',
      [id]
    );

    if (!officer || officer.user_id !== req.user.user_id) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized',
      });
    }

    const updated = await officerService.updateOfficerLocation(id, latitude, longitude);

    res.json({
      success: true,
      message: 'Location updated successfully',
      officer: updated,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

// Get officer metrics (Admin, Officer self)
router.get('/:id/metrics', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Check authorization
    const officer = await db.oneOrNone(
      'SELECT user_id FROM officers WHERE officer_id = $1',
      [id]
    );

    if (!officer) {
      return res.status(404).json({
        success: false,
        error: 'Officer not found',
      });
    }

    if (req.user.role !== 'admin' && req.user.user_id !== officer.user_id) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized',
      });
    }

    const metrics = await officerService.getOfficerMetrics(id);

    res.json({
      success: true,
      metrics,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

// Deactivate officer (Admin only)
router.patch('/:id/deactivate', verifyToken, checkRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    const updated = await officerService.deactivateOfficer(id);

    res.json({
      success: true,
      message: 'Officer deactivated and complaints reassigned',
      officer: updated,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

// Delete officer (Admin only)
router.delete('/:id', verifyToken, checkRole('admin'), async (req, res) => {
  try {
    const { id } = req.params;

    // Delete officer record
    const { db } = require('../config/database');
    const officer = await db.oneOrNone('SELECT user_id FROM officers WHERE officer_id = $1', [id]);

    if (!officer) {
      return res.status(404).json({
        success: false,
        error: 'Officer not found',
      });
    }

    // Delete related user account
    await db.none('DELETE FROM officers WHERE officer_id = $1', [id]);
    await db.none('DELETE FROM users WHERE user_id = $1', [officer.user_id]);

    res.json({
      success: true,
      message: 'Officer deleted successfully',
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;

// src/routes/assignments.js
// Complaint Assignment and Geolocation Routes

const express = require('express');
const router = express.Router();
const assignmentService = require('../services/assignmentService');
const wardService = require('../services/wardService');
const { db } = require('../config/database');
const { verifyToken, checkRole } = require('../middleware/auth');

// Auto-assign complaint (called internally when complaint is created)
router.post('/auto-assign/:complaintId', verifyToken, checkRole('admin', 'officer'), async (req, res) => {
  try {
    const { complaintId } = req.params;

    const result = await assignmentService.autoAssignComplaint(complaintId);

    res.json({
      success: true,
      message: 'Complaint auto-assigned successfully',
      assignment: result,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

// Manually assign complaint (Admin override)
router.post('/assign/:complaintId', verifyToken, checkRole('admin'), async (req, res) => {
  try {
    const { complaintId } = req.params;
    const { officer_id } = req.body;

    if (!officer_id) {
      return res.status(400).json({
        success: false,
        error: 'officer_id is required',
      });
    }

    const result = await assignmentService.manualAssign(complaintId, officer_id, req.user.user_id);

    res.json({
      success: true,
      message: 'Complaint assigned to officer',
      assignment: result,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

// Find nearest officers to a location
router.post('/nearest-officers', verifyToken, async (req, res) => {
  try {
    const { latitude, longitude, ward_id, limit = 5 } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        error: 'latitude and longitude are required',
      });
    }

    const officers = await assignmentService.findNearestOfficers(
      latitude,
      longitude,
      ward_id,
      parseInt(limit)
    );

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

// Get officer workload
router.get('/workload/:officerId', verifyToken, checkRole('admin', 'officer'), async (req, res) => {
  try {
    const { officerId } = req.params;

    // Check authorization
    const officer = await db.oneOrNone(
      'SELECT user_id FROM officers WHERE officer_id = $1',
      [officerId]
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

    const workload = await assignmentService.getOfficerWorkload(officerId);

    res.json({
      success: true,
      workload,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

// Balance workload in a ward (Admin)
router.post('/balance/:wardId', verifyToken, checkRole('admin'), async (req, res) => {
  try {
    const { wardId } = req.params;

    const result = await assignmentService.balanceWorkload(wardId);

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

// Get ward by coordinates
router.post('/ward-by-location', verifyToken, async (req, res) => {
  try {
    const { latitude, longitude } = req.body;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        error: 'latitude and longitude are required',
      });
    }

    const ward = await wardService.getWardByCoordinates(latitude, longitude);

    if (!ward) {
      return res.status(404).json({
        success: false,
        error: 'No ward found for this location',
      });
    }

    res.json({
      success: true,
      ward,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

module.exports = router;

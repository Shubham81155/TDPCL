// src/routes/complaints.js
// Complaint Routes for Citizens and Officers

const express = require('express');
const router = express.Router();
const complaintService = require('../services/complaintService');
const assignmentService = require('../services/assignmentService');
const wardService = require('../services/wardService');
const { verifyToken, checkRole } = require('../middleware/auth');
const { validateRequest, schemas } = require('../middleware/validator');
const upload = require('../middleware/multer');
const { uploadToS3 } = require('../utils/s3Upload');
const { db } = require('../config/database');
const { sendComplaintSubmittedEmail, sendComplaintAssignedEmail, sendComplaintStatusUpdateEmail, sendComplaintSubmittedToAdminEmail } = require('../services/notificationService');

const MANUAL_CATEGORIES = new Set([
  'food_waste',
  'vegetable_fruit_peels',
  'leaves',
  'paper',
  'plastics',
  'glass',
  'metals',
  'e_waste',
  'chemicals',
  'batteries',
  'medical_waste',
  'packaging_materials',
]);

// Create new complaint with image upload (Citizen)
router.post(
  '/',
  verifyToken,
  checkRole('citizen'),
  upload.single('image'),
  async (req, res) => {
    try {
      const { latitude, longitude, category } = req.body;

      // Validate required fields
      if (!latitude || !longitude) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields: latitude, longitude',
        });
      }

      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'Image file is required',
        });
      }

      if (!category || !MANUAL_CATEGORIES.has(category)) {
        return res.status(400).json({
          success: false,
          error: 'Please select a valid complaint category',
        });
      }

      const latNum = Number(String(latitude).trim());
      const lngNum = Number(String(longitude).trim());
      if (!Number.isFinite(latNum) || latNum < -90 || latNum > 90) {
        return res.status(400).json({
          success: false,
          error: 'Latitude must be a number between -90 and 90',
        });
      }
      if (!Number.isFinite(lngNum) || lngNum < -180 || lngNum > 180) {
        return res.status(400).json({
          success: false,
          error: 'Longitude must be a number between -180 and 180',
        });
      }

      const rawTitle = typeof req.body.title === 'string' ? req.body.title.trim() : '';
      const rawDescription = typeof req.body.description === 'string' ? req.body.description.trim() : '';
      const rawUrgency = typeof req.body.urgency_level === 'string' ? req.body.urgency_level.trim().toLowerCase() : '';

      if (rawTitle.length > 120) {
        return res.status(400).json({
          success: false,
          error: 'Title must be 120 characters or fewer',
        });
      }
      if (rawDescription.length > 1000) {
        return res.status(400).json({
          success: false,
          error: 'Description must be 1000 characters or fewer',
        });
      }
      const urgencyLevel = rawUrgency || 'medium';
      if (!['low', 'medium', 'high'].includes(urgencyLevel)) {
        return res.status(400).json({
          success: false,
          error: 'Urgency level must be one of: low, medium, high',
        });
      }

      const complaintTitle = rawTitle || 'Garbage Issue Report';

      // Upload image to S3
      const s3Result = await uploadToS3(req.file.buffer, req.file.originalname, 'complaints');

      // Get ward by coordinates
      const ward = await wardService.getWardByCoordinates(latNum, lngNum);

      const complaintData = {
        user_id: req.user.user_id,
        title: complaintTitle,
        description: rawDescription || 'No description provided',
        image_path: s3Result.url,
        latitude: latNum,
        longitude: lngNum,
        area: ward ? ward.name : 'Unknown Area',
        ward_id: ward ? ward.ward_id : null,
        category,
        urgency_level: urgencyLevel,
      };

      const complaint = await complaintService.createComplaint(complaintData);

      // Auto-assign complaint to nearest officer
      const assignment = await assignmentService.autoAssignComplaint(complaint.complaint_id);

      // Get citizen details for email
      const citizen = await db.oneOrNone(
        'SELECT name, email FROM users WHERE user_id = $1',
        [req.user.user_id]
      );

      // Send confirmation email to citizen (non-blocking)
      if (citizen && citizen.email) {
        sendComplaintSubmittedEmail(citizen.email, citizen.name, complaint.complaint_id).catch(err => {
          console.error('Email error (non-blocking):', err.message);
        });
      }

      // Send assignment email to officer if assigned (non-blocking)
      if (assignment && assignment.officer_id) {
        const officer = await db.oneOrNone(
          `SELECT u.name, u.email FROM users u
           JOIN officers o ON u.user_id = o.user_id
           WHERE o.officer_id = $1`,
          [assignment.officer_id]
        );
        if (officer && officer.email) {
          sendComplaintAssignedEmail(officer.email, officer.name, complaint.complaint_id, complaintTitle).catch(err => {
            console.error('Email error (non-blocking):', err.message);
          });
        }
      }

      // Send notification email to admins (non-blocking)
      sendComplaintSubmittedToAdminEmail(
        complaint.complaint_id,
        citizen.name,
        complaintData.area,
        complaintData.category
      ).catch(err => {
        console.error('Admin notification error (non-blocking):', err.message);
      });

      res.status(201).json({
        success: true,
        message: 'Complaint submitted successfully',
        complaint: assignment,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }
);

// Get user's complaints (Citizen)
router.get('/', verifyToken, checkRole('citizen'), async (req, res) => {
  try {
    const { status, category, dateFrom, dateTo, limit = 20, offset = 0 } = req.query;

    const filters = {
      status,
      category,
      dateFrom: dateFrom ? new Date(dateFrom) : null,
      dateTo: dateTo ? new Date(dateTo) : null,
      limit: parseInt(limit),
      offset: parseInt(offset),
    };

    const complaints = await complaintService.getComplaintsByUser(req.user.user_id, filters);

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

// Get complaint by ID (Citizen, Officer, Admin)
router.get('/:id(\\d+)', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    const complaint = await complaintService.getComplaintById(id);

    if (!complaint) {
      return res.status(404).json({
        success: false,
        error: 'Complaint not found',
      });
    }

    // Check authorization
    const currentUserId = Number(req.user.user_id);
    const complaintOwnerId = Number(complaint.user_id);
    const assignedOfficerUserId = Number(complaint.officer_user_id);
    const isOwner = currentUserId === complaintOwnerId;
    const isAssignedOfficer = currentUserId === assignedOfficerUserId;
    const isAdmin = req.user.role === 'admin';

    if (!isOwner && !isAssignedOfficer && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Not authorized to view this complaint',
      });
    }

    res.json({
      success: true,
      complaint,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

// Get complaint history (Citizen - owner, Officer - assigned)
router.get('/:id(\\d+)/timeline', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    const complaint = await complaintService.getComplaintById(id);

    if (!complaint) {
      return res.status(404).json({
        success: false,
        error: 'Complaint not found',
      });
    }

    // Check authorization
    const currentUserId = Number(req.user.user_id);
    const complaintOwnerId = Number(complaint.user_id);
    const assignedOfficerUserId = Number(complaint.officer_user_id);
    const isOwner = currentUserId === complaintOwnerId;
    const isAssignedOfficer = currentUserId === assignedOfficerUserId;

    if (!isOwner && !isAssignedOfficer && req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        error: 'Not authorized',
      });
    }

    const history = await complaintService.getComplaintHistory(id);

    res.json({
      success: true,
      timeline: history,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

// Get officer's assigned complaints
router.get(
  '/officer/assigned',
  verifyToken,
  checkRole('officer'),
  async (req, res) => {
    try {
      const { status, limit = 20, offset = 0 } = req.query;

      // Get officer's ID
      const officer = await db.oneOrNone(
        'SELECT officer_id FROM officers WHERE user_id = $1',
        [req.user.user_id]
      );

      if (!officer) {
        return res.status(400).json({
          success: false,
          error: 'Officer profile not found',
        });
      }

      const filters = {
        status,
        limit: parseInt(limit),
        offset: parseInt(offset),
      };

      const complaints = await complaintService.getOfficerComplaints(
        officer.officer_id,
        filters
      );

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
  }
);

// Update complaint status (Officer)
router.patch(
  '/:id(\\d+)/status',
  verifyToken,
  checkRole('officer'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { status, comment } = req.body;

      if (!['pending', 'in_progress', 'resolved', 'rejected'].includes(status)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid status',
        });
      }

      const officerRow = await db.oneOrNone(
        `SELECT o.officer_id FROM officers o
         JOIN complaints c ON c.assigned_officer_id = o.officer_id
         WHERE o.user_id = $1 AND c.complaint_id = $2`,
        [req.user.user_id, id]
      );
      if (!officerRow) {
        return res.status(403).json({
          success: false,
          error: 'This complaint is not assigned to you',
        });
      }

      const updated = await complaintService.updateComplaintStatus(
        id,
        status,
        req.user.user_id,
        comment
      );

      // Fetch complaint with citizen details to send email
      const complaintWithCitizen = await db.oneOrNone(
        `SELECT c.*, u.name as citizen_name, u.email as citizen_email 
         FROM complaints c
         JOIN users u ON c.user_id = u.user_id
         WHERE c.complaint_id = $1`,
        [id]
      );

      // Send status update email to citizen (non-blocking)
      if (complaintWithCitizen && complaintWithCitizen.citizen_email) {
        sendComplaintStatusUpdateEmail(
          complaintWithCitizen.citizen_email,
          complaintWithCitizen.citizen_name,
          id,
          status
        ).catch(err => {
          console.error('Email error (non-blocking):', err.message);
        });
      }

      res.json({
        success: true,
        message: `Complaint status updated to ${status}`,
        complaint: updated,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }
);

// Resolve complaint with image (Officer)
router.post(
  '/:id(\\d+)/resolve',
  verifyToken,
  checkRole('officer'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { resolution_image_path, comments } = req.body;

      if (!resolution_image_path) {
        return res.status(400).json({
          success: false,
          error: 'Resolution image is required',
        });
      }

      // Get officer ID
      const officer = await db.oneOrNone(
        'SELECT officer_id FROM officers WHERE user_id = $1',
        [req.user.user_id]
      );

      if (!officer) {
        return res.status(400).json({ success: false, error: 'Officer profile not found' });
      }

      const resolved = await complaintService.resolveComplaint(
        id,
        resolution_image_path,
        comments,
        officer.officer_id,
        req.user.user_id
      );

      res.json({
        success: true,
        message: 'Complaint resolved successfully',
        complaint: resolved,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message,
      });
    }
  }
);

module.exports = router;

// src/services/complaintSubmissionService.js
// Orchestrates citizen complaint submission: validation, image upload,
// ward lookup, creation, auto-assignment and (non-blocking) notifications.

const { db } = require('../config/database');
const AppError = require('../utils/AppError');
const { uploadToS3 } = require('../utils/s3Upload');
const logger = require('../utils/logger');
const complaintService = require('./complaintService');
const assignmentService = require('./assignmentService');
const wardService = require('./wardService');
const { scheduleClassification } = require('./classificationService');
const {
  sendComplaintSubmittedEmail,
  sendComplaintAssignedEmail,
  sendComplaintSubmittedToAdminEmail,
} = require('./notificationService');

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

const URGENCY_LEVELS = ['low', 'medium', 'high'];

// Validate and normalise the multipart body. Throws AppError(400).
const validateSubmission = (body = {}, file) => {
  const { latitude, longitude, category } = body;

  if (!latitude || !longitude) {
    throw AppError.badRequest('Missing required fields: latitude, longitude');
  }
  if (!file) {
    throw AppError.badRequest('Image file is required');
  }
  if (!category || !MANUAL_CATEGORIES.has(category)) {
    throw AppError.badRequest('Please select a valid complaint category');
  }

  const latNum = Number(String(latitude).trim());
  const lngNum = Number(String(longitude).trim());
  if (!Number.isFinite(latNum) || latNum < -90 || latNum > 90) {
    throw AppError.badRequest('Latitude must be a number between -90 and 90');
  }
  if (!Number.isFinite(lngNum) || lngNum < -180 || lngNum > 180) {
    throw AppError.badRequest('Longitude must be a number between -180 and 180');
  }

  const rawTitle = typeof body.title === 'string' ? body.title.trim() : '';
  const rawDescription = typeof body.description === 'string' ? body.description.trim() : '';
  const rawUrgency = typeof body.urgency_level === 'string' ? body.urgency_level.trim().toLowerCase() : '';

  if (rawTitle.length > 120) {
    throw AppError.badRequest('Title must be 120 characters or fewer');
  }
  if (rawDescription.length > 1000) {
    throw AppError.badRequest('Description must be 1000 characters or fewer');
  }
  const urgencyLevel = rawUrgency || 'medium';
  if (!URGENCY_LEVELS.includes(urgencyLevel)) {
    throw AppError.badRequest('Urgency level must be one of: low, medium, high');
  }

  return {
    latNum,
    lngNum,
    category,
    urgencyLevel,
    title: rawTitle || 'Garbage Issue Report',
    description: rawDescription || 'No description provided',
  };
};

const logEmailError = (label) => (err) => {
  console.error(`${label} (non-blocking):`, err.message);
};

// Fire-and-forget notifications. Never throws.
const notifySubmission = ({ citizen, complaint, assignment, title, area, category }) => {
  try {
    if (citizen && citizen.email) {
      sendComplaintSubmittedEmail(citizen.email, citizen.name, complaint.complaint_id)
        .catch(logEmailError('Email error'));
    }

    // autoAssignComplaint already returns the officer's contact details
    const officer = assignment && assignment.officer;
    if (officer && officer.email) {
      sendComplaintAssignedEmail(officer.email, officer.name, complaint.complaint_id, title)
        .catch(logEmailError('Email error'));
    }

    sendComplaintSubmittedToAdminEmail(
      complaint.complaint_id,
      citizen ? citizen.name : undefined,
      area,
      category
    ).catch(logEmailError('Admin notification error'));
  } catch (err) {
    logEmailError('Email error')(err);
  }
};

/**
 * Submit a complaint on behalf of a citizen.
 * @returns the assignment result under `complaint`; when auto-assignment is not
 *          possible, the saved complaint with `assigned: false` (never an error,
 *          because the complaint row already exists).
 */
const submitComplaint = async ({ user, body, file }) => {
  const input = validateSubmission(body, file);

  const s3Result = await uploadToS3(file.buffer, file.originalname, 'complaints');
  const ward = await wardService.getWardByCoordinates(input.latNum, input.lngNum);

  const complaintData = {
    user_id: user.user_id,
    title: input.title,
    description: input.description,
    image_path: s3Result.url,
    latitude: input.latNum,
    longitude: input.lngNum,
    area: ward ? ward.name : 'Unknown Area',
    ward_id: ward ? ward.ward_id : null,
    category: input.category,
    urgency_level: input.urgencyLevel,
  };

  const complaint = await complaintService.createComplaint(complaintData);

  // The complaint is already saved. If no officer can be assigned right now
  // (none available, transient DB error) report it as unassigned rather than
  // failing the request: a failure response would invite the citizen to resubmit
  // and create a duplicate. An admin can assign it manually.
  let assignment = null;
  try {
    assignment = await assignmentService.autoAssignComplaint(complaint.complaint_id);
  } catch (err) {
    logger.warn('auto-assignment failed; complaint left unassigned', {
      complaintId: complaint.complaint_id,
      err,
    });
  }

  const citizen = await db.oneOrNone('SELECT name, email FROM users WHERE user_id = $1', [user.user_id]);

  notifySubmission({
    citizen,
    complaint,
    assignment,
    title: complaintData.title,
    area: complaintData.area,
    category: complaintData.category,
  });

  // Optional advisory image classification: fire-and-forget, never delays or fails the
  // request, never overwrites the citizen-chosen category.
  scheduleClassification({
    complaintId: complaint.complaint_id,
    buffer: file.buffer,
    fileName: file.originalname,
  });

  return assignment || { ...complaint, assigned: false };
};

module.exports = { submitComplaint, validateSubmission, MANUAL_CATEGORIES };

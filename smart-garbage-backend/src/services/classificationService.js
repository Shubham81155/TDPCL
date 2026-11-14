// src/services/classificationService.js
// Optional, advisory, non-blocking image classification for new complaints.
// The citizen-chosen category is never touched: only classified_label and
// classification_confidence are written. Nothing here ever throws or rejects.

const { db } = require('../config/database');
const logger = require('../utils/logger');
const { classifyGarbageImage, isClassifierEnabled } = require('./garbageClassifierService');

const UPDATE_SQL =
  'UPDATE complaints SET classified_label = $1, classification_confidence = $2 WHERE complaint_id = $3';

/**
 * Classify and persist. Resolves to true when columns were written, false otherwise.
 */
const classifyAndStore = async ({ complaintId, buffer, fileName }) => {
  try {
    if (!isClassifierEnabled()) return false;

    const result = await classifyGarbageImage(buffer, fileName);
    if (result.source !== 'model') {
      // Logged once per failed classification. A plain fallback (no warning) means the
      // model/script files are missing although classification was enabled.
      logger.warn('image classification skipped; classification columns left NULL', {
        complaintId,
        reason: result.warning || 'model or script file not found',
      });
      return false;
    }

    await db.none(UPDATE_SQL, [result.label, result.confidence, complaintId]);
    logger.info('image classified', { complaintId, label: result.label, confidence: result.confidence });
    return true;
  } catch (err) {
    logger.warn('image classification failed; classification columns left NULL', { complaintId, err });
    return false;
  }
};

/**
 * Fire-and-forget wrapper: returns synchronously, never throws.
 */
const scheduleClassification = (params) => {
  try {
    if (!isClassifierEnabled()) return;
    setImmediate(() => {
      classifyAndStore(params).catch(() => null);
    });
  } catch (err) {
    logger.warn('could not schedule image classification', { err });
  }
};

module.exports = { classifyAndStore, scheduleClassification, UPDATE_SQL };

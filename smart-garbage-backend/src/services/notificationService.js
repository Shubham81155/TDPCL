const { db } = require('../config/database');
const { resolveEmailConfig, createMailTransport } = require('./mailTransport');

// Escape user-controlled text before putting it in HTML email bodies
const escapeHtml = (value) =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

let transporter = null;
let emailConfig = null; // resolved once, lazily
let warnedDisabled = false;

// Resolve config and build the transport (idempotent per call; warns once when email is disabled).
const initializeEmailService = () => {
  emailConfig = resolveEmailConfig(process.env);
  if (!emailConfig.enabled) {
    transporter = null;
    if (!warnedDisabled) {
      warnedDisabled = true;
      console.warn(`email disabled: ${emailConfig.reason}. Emails will not be sent (see docs/EMAIL.md).`);
    }
    return false;
  }
  transporter = createMailTransport(emailConfig);
  return true;
};

// Returns the transport, or null when email is not configured.
const getTransport = () => {
  if (!emailConfig) initializeEmailService();
  return transporter;
};

const getFrom = () => (emailConfig ? emailConfig.from : resolveEmailConfig(process.env).from);

// Best-effort delivery log; never throws and never affects the send result.
const logNotification = async (recipient, subject, status, errorMessage) => {
  try {
    await db.none(
      `INSERT INTO notification_logs (user_id, notification_type, recipient, subject, message, status, error_message)
       SELECT user_id, 'email', $1, $2, $2, $3, $4 FROM users WHERE LOWER(email) = LOWER($1)`,
      [recipient, subject, status, errorMessage || null]
    );
  } catch (logError) {
    console.error('Failed to log notification:', logError.message);
  }
};

// Sends one mail. Returns true if sent, false if disabled or failed. Never throws.
const deliver = async ({ to, subject, html }, { log = false } = {}) => {
  const t = getTransport();
  if (!t) return false;
  try {
    await t.sendMail({ from: getFrom(), to, subject, html });
    if (log) await logNotification(to, subject, 'sent');
    return true;
  } catch (error) {
    console.error(`Failed to send email to ${to}:`, error.message);
    if (log) await logNotification(to, subject, 'failed', error.message);
    return false;
  }
};

const sendComplaintSubmittedEmail = async (citizenEmail, citizenName, complaintId) => {
  const sent = await deliver(
    {
      to: citizenEmail,
      subject: `Complaint #${complaintId} Submitted Successfully`,
      html: `
        <h2>Complaint Submitted</h2>
        <p>Dear ${escapeHtml(citizenName)},</p>
        <p>Your garbage complaint has been received and registered.</p>
        <p><strong>Complaint ID:</strong> #${complaintId}</p>
        <p>You will receive updates via email and SMS as your complaint is processed.</p>
        <p><a href="${process.env.FRONTEND_URL}/citizen/complaint/${complaintId}">View Complaint Details</a></p>
        <p>Thank you for helping keep our city clean!</p>
      `,
    },
    { log: true }
  );
  if (sent) console.log(`Email sent to ${citizenEmail} for complaint #${complaintId}`);
};

const sendComplaintAssignedEmail = async (officerEmail, officerName, complaintId, complaintTitle) => {
  const sent = await deliver({
    to: officerEmail,
    subject: `New Complaint Assigned: #${complaintId}`,
    html: `
        <h2>New Complaint Assignment</h2>
        <p>Dear ${escapeHtml(officerName)},</p>
        <p>A new garbage complaint has been assigned to you.</p>
        <p><strong>Complaint ID:</strong> #${complaintId}</p>
        <p><strong>Title:</strong> ${escapeHtml(complaintTitle)}</p>
        <p><a href="${process.env.FRONTEND_URL}/officer/complaints">View Assigned Complaints</a></p>
        <p>Please prioritize and process this complaint as soon as possible.</p>
      `,
  });
  if (sent) console.log(`Email sent to ${officerEmail} for complaint #${complaintId}`);
};

const sendComplaintStatusUpdateEmail = async (citizenEmail, citizenName, complaintId, newStatus) => {
  const statusText = String(newStatus ?? '').replace(/_/g, ' ').toUpperCase();
  const sent = await deliver({
    to: citizenEmail,
    subject: `Complaint #${complaintId} Status Updated: ${statusText}`,
    html: `
        <h2>Complaint Status Update</h2>
        <p>Dear ${escapeHtml(citizenName)},</p>
        <p>Your complaint status has been updated.</p>
        <p><strong>Complaint ID:</strong> #${complaintId}</p>
        <p><strong>New Status:</strong> ${escapeHtml(statusText)}</p>
        <p><a href="${process.env.FRONTEND_URL}/citizen/complaint/${complaintId}">View Complaint Details</a></p>
      `,
  });
  if (sent) console.log(`Status update email sent to ${citizenEmail} for complaint #${complaintId}`);
};

const sendComplaintSubmittedToAdminEmail = async (complaintId, citizenName, location, category) => {
  try {
    if (!getTransport()) return;

    // Get all admin emails
    const admins = await db.any(
      `SELECT u.email, u.name FROM users u 
       WHERE u.role = 'admin' AND u.status = 'active' AND u.email IS NOT NULL`
    );

    if (admins.length === 0) {
      console.warn('No admin emails found to notify');
      return;
    }

    for (const admin of admins) {
      const sent = await deliver({
        to: admin.email,
        subject: `New Complaint Submitted: #${complaintId}`,
        html: `
          <h2>New Complaint Report</h2>
          <p>Dear ${escapeHtml(admin.name)},</p>
          <p>A new garbage complaint has been submitted by a citizen.</p>
          <p><strong>Complaint ID:</strong> #${complaintId}</p>
          <p><strong>Reported By:</strong> ${escapeHtml(citizenName)}</p>
          <p><strong>Location:</strong> ${escapeHtml(location)}</p>
          <p><strong>Category:</strong> ${escapeHtml(category)}</p>
          <p><a href="${process.env.FRONTEND_URL}/admin/complaints">View All Complaints</a></p>
          <p>Please review and manage this complaint through the admin dashboard.</p>
        `,
      });
      if (sent) console.log(`Admin notification email sent to ${admin.email} for complaint #${complaintId}`);
    }
  } catch (error) {
    console.error(`Failed to send admin notification email for complaint #${complaintId}:`, error.message);
  }
};

const sendPasswordResetEmail = async (email, name, resetUrl) => {
  const sent = await deliver({
    to: email,
    subject: 'Reset your password',
    html: `
        <h2>Password Reset</h2>
        <p>Dear ${escapeHtml(name || 'user')},</p>
        <p>We received a request to reset your password. Click the link below to choose a new one. This link expires in 1 hour.</p>
        <p><a href="${escapeHtml(resetUrl)}">Reset Password</a></p>
        <p>If you did not request this, you can safely ignore this email.</p>
      `,
  });
  if (sent) console.log(`Password reset email sent to ${email}`);
  return sent;
};

module.exports = {
  sendPasswordResetEmail,
  initializeEmailService,
  sendComplaintSubmittedEmail,
  sendComplaintAssignedEmail,
  sendComplaintStatusUpdateEmail,
  sendComplaintSubmittedToAdminEmail,
};

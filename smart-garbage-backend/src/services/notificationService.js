const nodemailer = require('nodemailer');
const { db } = require('../config/database');

let transporter;

const initializeEmailService = () => {
  const emailService = process.env.EMAIL_SERVICE || 'gmail';
  
  if (emailService === 'sendgrid') {
    transporter = nodemailer.createTransport({
      host: 'smtp.sendgrid.net',
      port: 587,
      secure: false,
      auth: {
        user: 'apikey',
        pass: process.env.SENDGRID_API_KEY,
      },
    });
  } else {
    // Gmail or other SMTP
    transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
      },
    });
  }
};

const sendComplaintSubmittedEmail = async (citizenEmail, citizenName, complaintId) => {
  try {
    if (!transporter) {
      initializeEmailService();
    }

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: citizenEmail,
      subject: `Complaint #${complaintId} Submitted Successfully`,
      html: `
        <h2>Complaint Submitted</h2>
        <p>Dear ${citizenName},</p>
        <p>Your garbage complaint has been received and registered.</p>
        <p><strong>Complaint ID:</strong> #${complaintId}</p>
        <p>You will receive updates via email and SMS as your complaint is processed.</p>
        <p><a href="${process.env.FRONTEND_URL}/citizen/complaint/${complaintId}">View Complaint Details</a></p>
        <p>Thank you for helping keep our city clean!</p>
      `,
    };

    await transporter.sendMail(mailOptions);

    // Log notification
    await db.none(
      `INSERT INTO notification_logs (user_id, notification_type, recipient, status, error_message)
       SELECT user_id, 'email', $2, 'sent', NULL FROM users WHERE email = $1`,
      [citizenEmail, citizenEmail]
    );

    console.log(`Email sent to ${citizenEmail} for complaint #${complaintId}`);
  } catch (error) {
    console.error(`Failed to send email to ${citizenEmail}:`, error.message);

    // Log failed notification
    try {
      await db.none(
        `INSERT INTO notification_logs (notification_type, recipient, status, error_message)
         VALUES ('email', $1, 'failed', $2)`,
        [citizenEmail, error.message]
      );
    } catch (logError) {
      console.error('Failed to log notification error:', logError.message);
    }
  }
};

const sendComplaintAssignedEmail = async (officerEmail, officerName, complaintId, complaintTitle) => {
  try {
    if (!transporter) {
      initializeEmailService();
    }

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: officerEmail,
      subject: `New Complaint Assigned: #${complaintId}`,
      html: `
        <h2>New Complaint Assignment</h2>
        <p>Dear ${officerName},</p>
        <p>A new garbage complaint has been assigned to you.</p>
        <p><strong>Complaint ID:</strong> #${complaintId}</p>
        <p><strong>Title:</strong> ${complaintTitle}</p>
        <p><a href="${process.env.FRONTEND_URL}/officer/complaints">View Assigned Complaints</a></p>
        <p>Please prioritize and process this complaint as soon as possible.</p>
      `,
    };

    await transporter.sendMail(mailOptions);

    console.log(`Email sent to ${officerEmail} for complaint #${complaintId}`);
  } catch (error) {
    console.error(`Failed to send email to ${officerEmail}:`, error.message);
  }
};

const sendComplaintStatusUpdateEmail = async (citizenEmail, citizenName, complaintId, newStatus) => {
  try {
    if (!transporter) {
      initializeEmailService();
    }

    const statusText = newStatus.replace(/_/g, ' ').toUpperCase();

    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: citizenEmail,
      subject: `Complaint #${complaintId} Status Updated: ${statusText}`,
      html: `
        <h2>Complaint Status Update</h2>
        <p>Dear ${citizenName},</p>
        <p>Your complaint status has been updated.</p>
        <p><strong>Complaint ID:</strong> #${complaintId}</p>
        <p><strong>New Status:</strong> ${statusText}</p>
        <p><a href="${process.env.FRONTEND_URL}/citizen/complaint/${complaintId}">View Complaint Details</a></p>
      `,
    };

    await transporter.sendMail(mailOptions);

    console.log(`Status update email sent to ${citizenEmail} for complaint #${complaintId}`);
  } catch (error) {
    console.error(`Failed to send status update email to ${citizenEmail}:`, error.message);
  }
};

const sendComplaintSubmittedToAdminEmail = async (complaintId, citizenName, location, category) => {
  try {
    if (!transporter) {
      initializeEmailService();
    }

    // Get all admin emails
    const admins = await db.any(
      `SELECT u.email, u.name FROM users u 
       WHERE u.role = 'admin' AND u.email IS NOT NULL`
    );

    if (admins.length === 0) {
      console.warn('No admin emails found to notify');
      return;
    }

    // Send email to all admins
    for (const admin of admins) {
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: admin.email,
        subject: `New Complaint Submitted: #${complaintId}`,
        html: `
          <h2>New Complaint Report</h2>
          <p>Dear ${admin.name},</p>
          <p>A new garbage complaint has been submitted by a citizen.</p>
          <p><strong>Complaint ID:</strong> #${complaintId}</p>
          <p><strong>Reported By:</strong> ${citizenName}</p>
          <p><strong>Location:</strong> ${location}</p>
          <p><strong>Category:</strong> ${category}</p>
          <p><a href="${process.env.FRONTEND_URL}/admin/complaints">View All Complaints</a></p>
          <p>Please review and manage this complaint through the admin dashboard.</p>
        `,
      };

      await transporter.sendMail(mailOptions);
      console.log(`Admin notification email sent to ${admin.email} for complaint #${complaintId}`);
    }
  } catch (error) {
    console.error(`Failed to send admin notification email for complaint #${complaintId}:`, error.message);
  }
};

module.exports = {
  initializeEmailService,
  sendComplaintSubmittedEmail,
  sendComplaintAssignedEmail,
  sendComplaintStatusUpdateEmail,
  sendComplaintSubmittedToAdminEmail,
};

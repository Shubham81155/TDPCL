// src/services/authService.js
// Authentication Service - User Registration, Login, Token Management

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../config/database');
const { generateToken, generateRefreshToken } = require('../middleware/auth');
const notificationService = require('./notificationService');

// Register new user (Citizen)
const registerUser = async (userData) => {
  // Public registration always creates a citizen; officers/admins are created by admins.
  const { email, password, name = email.split('@')[0], phone = null } = userData;
  const role = 'citizen';

  try {
    // Check if user exists
    const existingUser = await db.oneOrNone(
      'SELECT user_id FROM users WHERE email = $1',
      [email]
    );

    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Insert user
    const user = await db.one(
      `INSERT INTO users (name, email, phone, password_hash, role, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING user_id, name, email, phone, role, status, created_at`,
      [name, email, phone, hashedPassword, role, 'active']
    );

    // Create user preferences if phone is provided
    if (phone) {
      await db.none(
        `INSERT INTO user_preferences (user_id, sms_phone)
         VALUES ($1, $2)`,
        [user.user_id, phone]
      );
    }

    return user;
  } catch (error) {
    throw new Error(`Registration failed: ${error.message}`);
  }
};

// Login user
const loginUser = async (email, password) => {
  try {
    // Find user by email
    const user = await db.oneOrNone(
      'SELECT user_id, name, email, password_hash, role, status FROM users WHERE email = $1',
      [email]
    );

    if (!user) {
      throw new Error('Invalid email or password');
    }

    if (user.status === 'inactive' || user.status === 'suspended') {
      throw new Error('User account is inactive or suspended');
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      throw new Error('Invalid email or password');
    }

    // Generate tokens
    const accessToken = generateToken(user);
    const refreshToken = generateRefreshToken(user);

    return {
      user_id: user.user_id,
      name: user.name,
      email: user.email,
      role: user.role,
      accessToken,
      refreshToken,
    };
  } catch (error) {
    throw new Error(`Login failed: ${error.message}`);
  }
};

// Get user profile
const getUserProfile = async (userId) => {
  try {
    const user = await db.oneOrNone(
      `SELECT user_id, name, email, phone, role, status, profile_image_url, created_at
       FROM users WHERE user_id = $1`,
      [userId]
    );

    if (!user) {
      throw new Error('User not found');
    }

    return user;
  } catch (error) {
    throw new Error(`Failed to get profile: ${error.message}`);
  }
};

// Update user profile
const updateUserProfile = async (userId, updateData) => {
  const { name, phone, profile_image_url } = updateData;

  try {
    const user = await db.one(
      `UPDATE users 
       SET name = COALESCE($2, name),
           phone = COALESCE($3, phone),
           profile_image_url = COALESCE($4, profile_image_url),
           updated_at = CURRENT_TIMESTAMP
       WHERE user_id = $1
       RETURNING user_id, name, email, phone, role, status, profile_image_url, updated_at`,
      [userId, name, phone, profile_image_url]
    );

    return user;
  } catch (error) {
    throw new Error(`Failed to update profile: ${error.message}`);
  }
};

// Change password
const changePassword = async (userId, oldPassword, newPassword) => {
  try {
    const user = await db.oneOrNone(
      'SELECT password_hash FROM users WHERE user_id = $1',
      [userId]
    );

    if (!user) {
      throw new Error('User not found');
    }

    // Verify old password
    const isValidPassword = await bcrypt.compare(oldPassword, user.password_hash);

    if (!isValidPassword) {
      throw new Error('Old password is incorrect');
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password
    await db.none(
      'UPDATE users SET password_hash = $2, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1',
      [userId, hashedPassword]
    );

    return { success: true, message: 'Password changed successfully' };
  } catch (error) {
    throw new Error(`Failed to change password: ${error.message}`);
  }
};

// Exchange a valid refresh token for a new token pair
const refreshTokens = async (refreshToken) => {
  let payload;
  try {
    payload = jwt.verify(refreshToken, process.env.JWT_SECRET + '_refresh');
  } catch (e) {
    throw new Error('Invalid or expired refresh token');
  }
  const user = await db.oneOrNone(
    'SELECT user_id, email, role, status FROM users WHERE user_id = $1',
    [payload.user_id]
  );
  if (!user || user.status !== 'active') {
    throw new Error('Account is not active');
  }
  return {
    accessToken: generateToken(user),
    refreshToken: generateRefreshToken(user),
  };
};

const hashResetToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

// Start a password reset. Never reveals whether the email exists.
const requestPasswordReset = async (email) => {
  try {
    const user = await db.oneOrNone(
      'SELECT user_id, name, email, status FROM users WHERE LOWER(email) = LOWER($1)',
      [email]
    );
    if (!user || user.status === 'inactive' || user.status === 'suspended') return;

    const token = crypto.randomBytes(32).toString('hex');
    await db.none(
      `INSERT INTO password_resets (user_id, token_hash, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '1 hour')`,
      [user.user_id, hashResetToken(token)]
    );

    const baseUrl = (process.env.FRONTEND_URL || 'http://localhost:3000').replace(/\/+$/, '');
    const resetUrl = `${baseUrl}/reset-password?token=${token}`;
    await notificationService.sendPasswordResetEmail(user.email, user.name, resetUrl);
  } catch (error) {
    console.error('Password reset request failed:', error.message);
  }
};

// Complete a password reset with a token from the email.
const resetPassword = async (token, newPassword) => {
  const tokenHash = hashResetToken(token);
  const hashedPassword = await bcrypt.hash(newPassword, 10);

  await db.tx(async (t) => {
    const row = await t.oneOrNone(
      `SELECT reset_id, user_id FROM password_resets
       WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()
       FOR UPDATE`,
      [tokenHash]
    );
    if (!row) {
      throw new Error('Invalid or expired reset token');
    }
    await t.none(
      'UPDATE users SET password_hash = $2, updated_at = CURRENT_TIMESTAMP WHERE user_id = $1',
      [row.user_id, hashedPassword]
    );
    // Marks this token used and invalidates all other unused tokens for the user
    await t.none(
      'UPDATE password_resets SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL',
      [row.user_id]
    );
  });

  return { message: 'Password has been reset successfully' };
};

module.exports = {
  requestPasswordReset,
  resetPassword,
  refreshTokens,
  registerUser,
  loginUser,
  getUserProfile,
  updateUserProfile,
  changePassword,
};

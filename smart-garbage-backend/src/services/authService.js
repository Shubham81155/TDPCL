// src/services/authService.js
// Authentication Service - User Registration, Login, Token Management

const bcrypt = require('bcryptjs');
const { db } = require('../config/database');
const { generateToken, generateRefreshToken } = require('../middleware/auth');

// Register new user (Citizen)
const registerUser = async (userData) => {
  const { email, password, role = 'citizen', name = email.split('@')[0], phone = null } = userData;

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
      'SELECT user_id, email, password_hash, role, status FROM users WHERE email = $1',
      [email]
    );

    if (!user) {
      throw new Error('User not found');
    }

    if (user.status === 'inactive' || user.status === 'suspended') {
      throw new Error('User account is inactive or suspended');
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      throw new Error('Invalid password');
    }

    // Generate tokens
    const accessToken = generateToken(user);
    const refreshToken = generateRefreshToken(user);

    return {
      user_id: user.user_id,
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

module.exports = {
  registerUser,
  loginUser,
  getUserProfile,
  updateUserProfile,
  changePassword,
};

// src/routes/auth.js
// Authentication Routes

const express = require('express');
const router = express.Router();
const authService = require('../services/authService');
const { verifyToken } = require('../middleware/auth');
const { validateRequest, schemas } = require('../middleware/validator');

// Register new citizen
router.post('/register', validateRequest(schemas.registerUser), async (req, res) => {
  try {
    const user = await authService.registerUser(req.body);
    res.status(201).json({
      success: true,
      message: 'Registration successful',
      user,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

// Login user
router.post('/login', validateRequest(schemas.loginUser), async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await authService.loginUser(email, password);
    res.json({
      success: true,
      message: 'Login successful',
      ...result,
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      error: error.message,
    });
  }
});

// Get profile
router.get('/profile', verifyToken, async (req, res) => {
  try {
    const user = await authService.getUserProfile(req.user.user_id);
    res.json({
      success: true,
      user,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

// Update profile
router.put('/profile', verifyToken, async (req, res) => {
  try {
    const user = await authService.updateUserProfile(req.user.user_id, req.body);
    res.json({
      success: true,
      message: 'Profile updated successfully',
      user,
    });
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

// Change password
router.post('/change-password', verifyToken, async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        error: 'Old password and new password are required',
      });
    }

    const result = await authService.changePassword(
      req.user.user_id,
      oldPassword,
      newPassword
    );

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

module.exports = router;

// src/routes/auth.js
// Authentication Routes

const express = require('express');
const router = express.Router();
const authService = require('../services/authService');
const { verifyToken } = require('../middleware/auth');
const { validateRequest, schemas } = require('../middleware/validator');
const { createRateLimiter } = require('../middleware/rateLimit');

// Brute-force protection: 10 attempts / 15 min per IP+path (a successful login clears the counter,
// so only failures accumulate)
const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 10,
  keyFn: (req) => `${req.ip}:${req.path}`,
  message: 'Too many attempts. Try again later.',
});
const rateLimit = authLimiter;

// Register new citizen
router.post('/register', rateLimit, validateRequest(schemas.registerUser), async (req, res) => {
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
router.post('/login', rateLimit, validateRequest(schemas.loginUser), async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await authService.loginUser(email, password);
    authLimiter.reset(req); // only failed attempts count toward the limit
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

// Refresh access token
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({ success: false, error: 'refreshToken is required' });
    }
    const tokens = await authService.refreshTokens(refreshToken);
    res.json({ success: true, ...tokens });
  } catch (error) {
    res.status(401).json({ success: false, error: error.message });
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

    if (typeof newPassword === 'string' && newPassword.length < 6) {
      return res.status(400).json({ success: false, error: 'New password must be at least 6 characters' });
    }

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

// Request password reset (always 200 to avoid user enumeration)
router.post('/forgot-password', rateLimit, async (req, res) => {
  const { email } = req.body || {};
  if (typeof email === 'string' && email.trim()) {
    await authService.requestPasswordReset(email.trim());
  }
  res.json({
    success: true,
    message: 'If an account with that email exists, a password reset link has been sent.',
  });
});

// Reset password using emailed token
router.post('/reset-password', rateLimit, async (req, res) => {
  const { token, newPassword } = req.body || {};
  if (typeof token !== 'string' || !token || typeof newPassword !== 'string') {
    return res.status(400).json({ success: false, error: 'Token and new password are required' });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({ success: false, error: 'New password must be at least 6 characters' });
  }
  try {
    const result = await authService.resetPassword(token, newPassword);
    res.json({ success: true, ...result });
  } catch (error) {
    res.status(400).json({ success: false, error: error.message });
  }
});

module.exports = router;

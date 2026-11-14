// src/middleware/auth.js
// JWT Authentication Middleware

const jwt = require('jsonwebtoken');
const dotenv = require('dotenv');

dotenv.config();

// Verify JWT Token
const verifyToken = (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'No token provided',
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: 'Invalid or expired token',
    });
  }
};

// Check user role
const checkRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Access denied. Insufficient permissions.',
      });
    }
    next();
  };
};

// Generate JWT Token
const generateToken = (user) => {
  return jwt.sign(
    { user_id: user.user_id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRY || '24h' }
  );
};

// Generate Refresh Token
const generateRefreshToken = (user) => {
  return jwt.sign(
    { user_id: user.user_id },
    process.env.JWT_SECRET + '_refresh',
    { expiresIn: process.env.JWT_REFRESH_EXPIRY || '7d' }
  );
};

module.exports = {
  verifyToken,
  checkRole,
  generateToken,
  generateRefreshToken,
};

// src/index.js
// Main Express Server Entry Point

require('express-async-errors');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config();

const errorHandler = require('./middleware/errorHandler');
const { db } = require('./config/database');
const { initializeEmailService } = require('./services/notificationService');

// Import routes
const authRoutes = require('./routes/auth');
const complaintRoutes = require('./routes/complaints');
const officerRoutes = require('./routes/officers');
const wardRoutes = require('./routes/wards');
const assignmentRoutes = require('./routes/assignments');
const adminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet()); // Security headers
app.use(cors()); // CORS
app.use(morgan('combined')); // Logging
app.use(express.json()); // JSON parser
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use('/uploads', express.static(path.resolve(__dirname, '../uploads')));

// Health Check Endpoint
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Smart Garbage Reporting API is running',
    timestamp: new Date().toISOString(),
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/officers', officerRoutes);
app.use('/api/wards', wardRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/admin', adminRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
  });
});

// Global Error Handler
app.use(errorHandler);

// Start Server
app.listen(PORT, () => {
  console.log(`🚀 Server running on http://${process.env.HOST}:${PORT}`);
  console.log(`📊 Environment: ${process.env.NODE_ENV}`);
  
  // Initialize email service
  try {
    initializeEmailService();
    console.log('📧 Email service initialized');
  } catch (error) {
    console.warn('⚠️  Email service initialization failed:', error.message);
  }
});

// Graceful Shutdown
process.on('SIGINT', () => {
  console.log('\n⚠️  Shutting down gracefully...');
  process.exit(0);
});

// tests/setup.js
require('dotenv').config({ path: '.env.test' });

// Suppress console logs during tests (optional)
beforeAll(() => {
  jest.spyOn(console, 'log').mockImplementation(() => {});
  jest.spyOn(console, 'error').mockImplementation(() => {});
});

// Restore console after tests
afterAll(() => {
  console.log.mockRestore();
  console.error.mockRestore();
});

// Global test utilities
global.testUtils = {
  generateToken: (userId, role = 'citizen') => {
    const jwt = require('jsonwebtoken');
    return jwt.sign({ user_id: userId, role }, process.env.JWT_SECRET || 'test-secret', {
      expiresIn: '24h',
    });
  },

  testUser: {
    name: 'Test User',
    email: 'test@example.com',
    phone: '9999999999',
    password: 'testPassword123',
    role: 'citizen',
  },

  testOfficer: {
    name: 'Test Officer',
    email: 'officer@example.com',
    phone: '9888888888',
    password: 'officerPassword123',
    role: 'officer',
    employee_id: 'OFF001',
    assigned_ward_id: 1,
    year_of_joining: 2020,
  },

  testComplaint: {
    title: 'Garbage Heap on Main Street',
    description: 'Large pile of garbage blocking the road',
    category: 'garbage_heap',
    urgency_level: 'high',
    latitude: 19.0760,
    longitude: 72.8777,
  },
};

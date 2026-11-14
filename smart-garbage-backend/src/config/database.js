// src/config/database.js
// PostgreSQL Database Connection with PostGIS

const pgPromise = require('pg-promise');
const dotenv = require('dotenv');

dotenv.config();

const pgp = pgPromise({
  /* Optional initialization options here */
});

const connection = {
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'smart_garbage_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
};

// Create database connection pool
const db = pgp(connection);

// Test connection
db.connect()
  .then(obj => {
    console.log('✅ Database connection established');
    obj.done();
  })
  .catch(error => {
    console.error('❌ Database connection error:', error);
    process.exit(1);
  });

module.exports = { db, pgp };

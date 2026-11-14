// src/config/database.js
// PostgreSQL Database Connection with PostGIS
// Importing this module never connects and never exits the process; use checkConnection() at boot.

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

// Create database connection pool (lazy: no connection is made until first query)
const db = pgp(connection);

// Verifies the database is reachable. Resolves true or rejects with the connection error.
const checkConnection = async () => {
  const obj = await db.connect();
  try {
    await obj.one('SELECT 1 AS ok');
  } finally {
    obj.done();
  }
  return true;
};

module.exports = { db, pgp, checkConnection };

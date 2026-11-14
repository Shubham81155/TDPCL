-- 005_password_resets.sql
-- Password reset tokens (only the SHA-256 hash of the token is stored)
CREATE TABLE IF NOT EXISTS password_resets (
  reset_id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_password_resets_user ON password_resets(user_id);

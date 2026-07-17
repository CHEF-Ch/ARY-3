-- Identity module: users table
-- Based on docs/ary-dev-1-data-model.md

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL DEFAULT '',
  display_name TEXT NOT NULL DEFAULT '',
  profile_completed INTEGER NOT NULL DEFAULT 0,
  roles TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Communication module: announcements table
-- Based on docs/ary-dev-1-data-model.md

CREATE TABLE IF NOT EXISTS announcements (
  id TEXT PRIMARY KEY,
  race_id TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'public',
  published_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

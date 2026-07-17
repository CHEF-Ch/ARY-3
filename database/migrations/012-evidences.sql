CREATE TABLE IF NOT EXISTS evidences (
  id TEXT PRIMARY KEY,
  registration_id TEXT NOT NULL,
  work_id TEXT,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  source_ref TEXT NOT NULL,
  visibility TEXT NOT NULL DEFAULT 'private',
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

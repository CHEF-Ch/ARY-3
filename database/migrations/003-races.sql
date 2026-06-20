-- Race management module: races table
-- Reference only. Runtime storage uses database/data/*.json via server/src/db.ts.

CREATE TABLE IF NOT EXISTS races (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  challenge TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  visibility TEXT NOT NULL DEFAULT 'private',
  organizer_user_ids TEXT NOT NULL DEFAULT '[]',
  registration_opens_at TEXT,
  registration_closes_at TEXT,
  starts_at TEXT,
  ends_at TEXT,
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

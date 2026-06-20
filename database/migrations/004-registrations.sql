-- Race management module: registrations table
-- Reference only. Runtime storage uses database/data/*.json via server/src/db.ts.

CREATE TABLE IF NOT EXISTS registrations (
  id TEXT PRIMARY KEY,
  race_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'submitted',
  submitted_at TEXT NOT NULL DEFAULT (datetime('now')),
  approved_at TEXT,
  rejected_at TEXT,
  withdrawn_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (race_id, user_id)
);

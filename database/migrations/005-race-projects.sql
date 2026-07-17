-- Race management module: race_projects table
-- Reference only. Runtime storage uses database/data/*.json via server/src/db.ts.

CREATE TABLE IF NOT EXISTS race_projects (
  id TEXT PRIMARY KEY,
  registration_id TEXT UNIQUE NOT NULL,
  race_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  repo_url TEXT,
  aggregate_ingestion_status TEXT NOT NULL DEFAULT 'not_configured',
  connection_health TEXT NOT NULL DEFAULT 'no_signal',
  last_synced_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

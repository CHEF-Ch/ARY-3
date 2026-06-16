-- Race management module: ca_connections table
-- Reference only. Runtime storage uses database/data/*.json via server/src/db.ts.

CREATE TABLE IF NOT EXISTS ca_connections (
  id TEXT PRIMARY KEY,
  race_project_id TEXT NOT NULL,
  ca_type TEXT NOT NULL,
  ingestion_source TEXT NOT NULL DEFAULT 'ca_realtime',
  connector_id TEXT NOT NULL,
  connector_version TEXT,
  external_project_ref TEXT,
  ingestion_status TEXT NOT NULL DEFAULT 'not_configured',
  handshake_status TEXT NOT NULL DEFAULT 'pending',
  registered_at TEXT NOT NULL DEFAULT (datetime('now')),
  disabled_at TEXT,
  last_synced_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

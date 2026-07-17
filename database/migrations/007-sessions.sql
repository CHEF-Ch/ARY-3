-- Race management module: sessions table
-- Reference only. Runtime storage uses database/data/*.json via server/src/db.ts.

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  ca_connection_id TEXT NOT NULL,
  race_project_id TEXT NOT NULL,
  started_at TEXT,
  ended_at TEXT,
  message_count INTEGER NOT NULL DEFAULT 0,
  tool_call_count INTEGER NOT NULL DEFAULT 0,
  token_cost INTEGER NOT NULL DEFAULT 0,
  raw_payload_ref TEXT,
  accepted_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

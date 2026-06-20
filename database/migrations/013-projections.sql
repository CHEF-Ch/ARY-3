CREATE TABLE IF NOT EXISTS projections (
  id TEXT PRIMARY KEY,
  race_id TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ready',
  data TEXT NOT NULL DEFAULT '{}',
  generated_at TEXT,
  last_attempted_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_error TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (race_id, type)
);

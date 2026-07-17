CREATE TABLE IF NOT EXISTS awards (
  id TEXT PRIMARY KEY,
  race_id TEXT NOT NULL,
  registration_id TEXT NOT NULL,
  work_id TEXT,
  award_name TEXT NOT NULL,
  rank INTEGER NOT NULL,
  decision_reason TEXT NOT NULL DEFAULT '',
  judging_record_ids TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'draft',
  visibility TEXT NOT NULL DEFAULT 'private',
  published_at TEXT,
  created_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (race_id, award_name, rank),
  UNIQUE (race_id, award_name, registration_id)
);

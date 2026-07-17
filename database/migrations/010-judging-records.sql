CREATE TABLE IF NOT EXISTS judging_records (
  id TEXT PRIMARY KEY,
  judge_assignment_id TEXT NOT NULL,
  score_result INTEGER,
  score_riding INTEGER,
  comments TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  submitted_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (judge_assignment_id)
);

CREATE TABLE IF NOT EXISTS judge_assignments (
  id TEXT PRIMARY KEY,
  work_id TEXT NOT NULL,
  judge_user_id TEXT NOT NULL,
  assigned_by_user_id TEXT NOT NULL,
  assigned_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (work_id, judge_user_id)
);

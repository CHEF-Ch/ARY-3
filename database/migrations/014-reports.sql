-- Report generation module: reports table
-- Field reference only. Runtime storage uses database/data/reports.json.

CREATE TABLE IF NOT EXISTS reports (
  id TEXT PRIMARY KEY,
  race_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('rider_report', 'race_report', 'review_summary')),
  subject_registration_id TEXT,
  status TEXT NOT NULL DEFAULT 'generated' CHECK (status IN ('draft', 'generated', 'reviewed', 'published')),
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'public')),
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  sections TEXT NOT NULL DEFAULT '[]',
  cited_evidence_ids TEXT NOT NULL DEFAULT '[]',
  cited_award_ids TEXT NOT NULL DEFAULT '[]',
  source_counts TEXT NOT NULL DEFAULT '{}',
  generated_at TEXT,
  published_at TEXT,
  created_by_user_id TEXT NOT NULL,
  updated_by_user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (
    (type = 'rider_report' AND subject_registration_id IS NOT NULL)
    OR
    (type IN ('race_report', 'review_summary') AND subject_registration_id IS NULL)
  )
);

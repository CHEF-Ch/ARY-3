import type { Express, Request, Response } from "express";
import { Router } from "express";
import { v4 as uuid } from "uuid";
import { findAll, findById, findBy, filterBy, insert, update, remove } from "../../db.js";
import { authorize, getCurrentUser, requireLogin } from "../../shared/auth.js";

const WORK_STATUSES = ["draft", "submitted", "locked", "hidden"] as const;
const EVIDENCE_TYPES = [
  "session_summary",
  "work",
  "commit_pr",
  "screenshot",
  "judge_comment",
  "retrospective",
  "video",
] as const;
const VISIBILITIES = ["private", "public"] as const;

type WorkStatus = typeof WORK_STATUSES[number];
type EvidenceType = typeof EVIDENCE_TYPES[number];
type Visibility = typeof VISIBILITIES[number];

interface Race {
  id: string;
  slug: string;
  title: string;
  organizer_user_ids: string[] | string;
}

interface Registration {
  id: string;
  race_id: string;
  user_id: string;
  status: string;
}

interface RaceProject {
  id: string;
  registration_id: string;
  race_id: string;
  user_id: string;
  aggregate_ingestion_status: string;
}

interface UserRow {
  id: string;
  githubAccount: string;
  roles: string[] | string;
}

interface Work {
  id: string;
  registration_id: string;
  race_id: string;
  user_id: string;
  slug: string;
  title: string;
  summary: string;
  problem_statement: string;
  solution_summary: string;
  tech_stack: string;
  repo_url: string | null;
  demo_url: string | null;
  video_url: string | null;
  status: WorkStatus;
  visibility: Visibility;
  submitted_at: string | null;
  locked_at: string | null;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

interface JudgeAssignment {
  id: string;
  work_id: string;
  judge_user_id: string;
  assigned_by_user_id: string;
  assigned_at: string;
  created_at: string;
  updated_at: string;
}

interface JudgingRecord {
  id: string;
  judge_assignment_id: string;
  score_result: number | null;
  score_riding: number | null;
  comments: string;
  status: "draft" | "submitted";
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
}

interface Award {
  id: string;
  race_id: string;
  registration_id: string;
  work_id: string | null;
  award_name: string;
  rank: number;
  decision_reason: string;
  judging_record_ids: string;
  status: "draft" | "published";
  visibility: Visibility;
  published_at: string | null;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
}

interface Evidence {
  id: string;
  registration_id: string;
  work_id: string | null;
  type: EvidenceType;
  title: string;
  summary: string;
  source_ref: string;
  visibility: Visibility;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
}

interface ReviewWarning {
  code: "ca_not_configured" | "ca_ingestion_failed" | "missing_race_project";
  severity: "warning";
  message: string;
  registrationId: string;
  raceProjectId?: string;
  aggregateIngestionStatus?: string;
}

export function registerPortfolioRoutes(app: Express): void {
  const works = Router();
  const judgeAssignments = Router();
  const judgingRecords = Router();
  const awards = Router();
  const evidences = Router();

  works.get("/", (req: Request, res: Response) => {
    const user = getCurrentUser(req);
    const raceId = getRaceIdFromQuery(req, res);
    if (raceId === false) return;

    const rows = findAll<Work>("works")
      .filter((work) => !raceId || work.race_id === raceId)
      .filter((work) => canReadWork(req, work))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));

    res.json(rows.map((work) => toWorkResponse(work, { includeReviewWarnings: shouldIncludeWorkWarnings(user, work) })));
  });

  works.post("/", requireLogin, (req: Request, res: Response) => {
    const user = getCurrentUser(req);
    const { registrationId, title } = req.body;
    if (!registrationId || typeof registrationId !== "string") {
      res.status(400).json({ error: "registrationId is required" });
      return;
    }
    if (!title || typeof title !== "string") {
      res.status(400).json({ error: "title is required" });
      return;
    }

    const registration = findById<Registration>("registrations", registrationId);
    if (!registration) { res.status(404).json({ error: "Registration not found" }); return; }
    if (registration.status !== "approved") { res.status(400).json({ error: "Registration must be approved" }); return; }

    const race = findById<Race>("races", registration.race_id);
    if (!race) { res.status(404).json({ error: "Race not found" }); return; }

    const auth = authorize(user, "Work", "create", { ownerUserId: registration.user_id });
    if (!auth.allowed) { res.status(403).json({ error: auth.reason }); return; }

    if (filterBy<Work>("works", "registration_id", registration.id).length > 0) {
      res.status(409).json({ error: "registration already has a work" });
      return;
    }

    const slug = normalizeSlug(req.body.slug || title);
    if (!slug) { res.status(400).json({ error: "slug or title must produce a valid slug" }); return; }
    if (findBy<Work>("works", "slug", slug)) {
      res.status(409).json({ error: "slug already exists" });
      return;
    }

    const now = new Date().toISOString();
    const work: Work = {
      id: uuid(),
      registration_id: registration.id,
      race_id: registration.race_id,
      user_id: registration.user_id,
      slug,
      title: title.trim(),
      summary: stringOrEmpty(req.body.summary),
      problem_statement: stringOrEmpty(req.body.problemStatement),
      solution_summary: stringOrEmpty(req.body.solutionSummary),
      tech_stack: stringOrEmpty(req.body.techStack),
      repo_url: optionalString(req.body.repoUrl),
      demo_url: optionalString(req.body.demoUrl),
      video_url: optionalString(req.body.videoUrl),
      status: "draft",
      visibility: "private",
      submitted_at: null,
      locked_at: null,
      published_at: null,
      created_at: now,
      updated_at: now,
    };

    insert("works", work);
    res.status(201).json(toWorkResponse(work, { includeReviewWarnings: true }));
  });

  works.get("/:id", (req: Request, res: Response) => {
    const work = findById<Work>("works", req.params.id);
    if (!work || !canReadWork(req, work)) {
      res.status(404).json({ error: "Work not found" });
      return;
    }
    const user = getCurrentUser(req);
    res.json(toWorkResponse(work, { includeReviewWarnings: shouldIncludeWorkWarnings(user, work) }));
  });

  works.patch("/:id", requireLogin, (req: Request, res: Response) => {
    const work = findById<Work>("works", req.params.id);
    if (!work) { res.status(404).json({ error: "Work not found" }); return; }
    if (work.status === "locked") { res.status(409).json({ error: "locked work cannot be edited" }); return; }

    const registration = findById<Registration>("registrations", work.registration_id);
    if (!registration) { res.status(404).json({ error: "Registration not found" }); return; }

    const user = getCurrentUser(req);
    const auth = authorize(user, "Work", "create", { ownerUserId: registration.user_id });
    if (!auth.allowed) { res.status(403).json({ error: auth.reason }); return; }

    const updates = buildWorkEditableUpdates(req, res);
    if (!updates) return;

    const updated = update<Work>("works", work.id, { ...updates, updated_at: new Date().toISOString() });
    res.json(toWorkResponse(updated!, { includeReviewWarnings: true }));
  });

  works.post("/:id/submit", requireLogin, (req: Request, res: Response) => {
    const work = findById<Work>("works", req.params.id);
    if (!work) { res.status(404).json({ error: "Work not found" }); return; }
    if (work.status === "locked") { res.status(409).json({ error: "locked work cannot be submitted" }); return; }

    const registration = findById<Registration>("registrations", work.registration_id);
    if (!registration) { res.status(404).json({ error: "Registration not found" }); return; }
    if (registration.status !== "approved") { res.status(400).json({ error: "Registration must be approved" }); return; }

    const user = getCurrentUser(req);
    const auth = authorize(user, "Work", "submit", { ownerUserId: registration.user_id });
    if (!auth.allowed) { res.status(403).json({ error: auth.reason }); return; }

    const editableUpdates = buildWorkEditableUpdates(req, res, true);
    if (!editableUpdates) return;
    const nextWork = { ...work, ...editableUpdates };
    if (!nextWork.title.trim()) { res.status(400).json({ error: "title is required" }); return; }
    if (!nextWork.repo_url && !nextWork.demo_url) {
      res.status(400).json({ error: "repoUrl or demoUrl is required" });
      return;
    }

    const now = new Date().toISOString();
    const updated = update<Work>("works", work.id, {
      ...editableUpdates,
      status: "submitted",
      submitted_at: now,
      updated_at: now,
    });
    res.json(toWorkResponse(updated!, { includeReviewWarnings: true }));
  });

  works.post("/:id/lock", requireLogin, (req: Request, res: Response) => {
    const work = findById<Work>("works", req.params.id);
    if (!work) { res.status(404).json({ error: "Work not found" }); return; }
    const race = findById<Race>("races", work.race_id);
    if (!race) { res.status(404).json({ error: "Race not found" }); return; }

    const user = getCurrentUser(req);
    const auth = authorize(user, "Work", "lock", { raceOrganizerIds: parseStringArray(race.organizer_user_ids) });
    if (!auth.allowed) { res.status(403).json({ error: auth.reason }); return; }

    const now = new Date().toISOString();
    const updated = update<Work>("works", work.id, { status: "locked", locked_at: now, updated_at: now });
    res.json(toWorkResponse(updated!, { includeReviewWarnings: true }));
  });

  works.post("/:id/publish", requireLogin, (req: Request, res: Response) => {
    const work = findById<Work>("works", req.params.id);
    if (!work) { res.status(404).json({ error: "Work not found" }); return; }
    if (work.status !== "submitted" && work.status !== "locked") {
      res.status(400).json({ error: "Only submitted or locked works can be published" });
      return;
    }

    const race = findById<Race>("races", work.race_id);
    if (!race) { res.status(404).json({ error: "Race not found" }); return; }

    const user = getCurrentUser(req);
    const auth = authorize(user, "Work", "publish", { raceOrganizerIds: parseStringArray(race.organizer_user_ids) });
    if (!auth.allowed) { res.status(403).json({ error: auth.reason }); return; }

    const now = new Date().toISOString();
    const updated = update<Work>("works", work.id, { visibility: "public", published_at: now, updated_at: now });
    res.json(toWorkResponse(updated!, { includeReviewWarnings: true }));
  });

  works.get("/:id/judge-assignments", requireLogin, (req: Request, res: Response) => {
    const work = findById<Work>("works", req.params.id);
    if (!work) { res.status(404).json({ error: "Work not found" }); return; }
    const race = findById<Race>("races", work.race_id);
    if (!race) { res.status(404).json({ error: "Race not found" }); return; }

    const user = getCurrentUser(req);
    const auth = authorize(user, "JudgeAssignment", "create", { raceOrganizerIds: parseStringArray(race.organizer_user_ids) });
    if (!auth.allowed) { res.status(403).json({ error: auth.reason }); return; }

    const rows = findAll<JudgeAssignment>("judge_assignments")
      .filter((a) => a.work_id === work.id)
      .sort((a, b) => b.assigned_at.localeCompare(a.assigned_at));

    res.json(rows.map((a) => toJudgeAssignmentResponse(a, { includeRecord: true })));
  });

  works.post("/:id/judge-assignments", requireLogin, (req: Request, res: Response) => {
    const work = findById<Work>("works", req.params.id);
    if (!work) { res.status(404).json({ error: "Work not found" }); return; }
    const race = findById<Race>("races", work.race_id);
    if (!race) { res.status(404).json({ error: "Race not found" }); return; }

    const user = getCurrentUser(req);
    const auth = authorize(user, "JudgeAssignment", "create", { raceOrganizerIds: parseStringArray(race.organizer_user_ids) });
    if (!auth.allowed) { res.status(403).json({ error: auth.reason }); return; }

    let { judgeUserId } = req.body;
    const { githubAccount } = req.body;

    // Support githubAccount as an alternative to judgeUserId (UUID)
    if (!judgeUserId && githubAccount && typeof githubAccount === "string") {
      const userByAccount = findBy<UserRow>("users", "githubAccount", githubAccount.trim());
      if (!userByAccount) {
        res.status(404).json({ error: `User with githubAccount "${githubAccount}" not found` });
        return;
      }
      judgeUserId = userByAccount.id;
    }

    if (!judgeUserId || typeof judgeUserId !== "string") {
      res.status(400).json({ error: "judgeUserId or githubAccount is required" });
      return;
    }

    const target = findById<UserRow>("users", judgeUserId);
    if (!target) { res.status(404).json({ error: "Judge user not found" }); return; }
    if (!parseStringArray(target.roles).includes("judge")) {
      res.status(400).json({ error: "target user must have judge role" });
      return;
    }

    const duplicate = findAll<JudgeAssignment>("judge_assignments")
      .some((assignment) => assignment.work_id === work.id && assignment.judge_user_id === judgeUserId);
    if (duplicate) { res.status(409).json({ error: "judge is already assigned to this work" }); return; }

    const now = new Date().toISOString();
    const assignment: JudgeAssignment = {
      id: uuid(),
      work_id: work.id,
      judge_user_id: judgeUserId,
      assigned_by_user_id: user!.userId,
      assigned_at: now,
      created_at: now,
      updated_at: now,
    };

    insert("judge_assignments", assignment);
    res.status(201).json(toJudgeAssignmentResponse(assignment, { includeWork: true }));
  });

  judgeAssignments.get("/mine", requireLogin, (req: Request, res: Response) => {
    const user = getCurrentUser(req);
    const rows = findAll<JudgeAssignment>("judge_assignments")
      .filter((assignment) => {
        const auth = authorize(user, "JudgeAssignment", "view", { assignedJudgeUserId: assignment.judge_user_id });
        return auth.allowed;
      })
      .sort((a, b) => b.assigned_at.localeCompare(a.assigned_at));

    res.json(rows.map((assignment) => toJudgeAssignmentResponse(assignment, { includeWork: true, includeRecord: true })));
  });

  judgeAssignments.delete("/:id", requireLogin, (req: Request, res: Response) => {
    const assignment = findById<JudgeAssignment>("judge_assignments", req.params.id);
    if (!assignment) { res.status(404).json({ error: "Judge assignment not found" }); return; }

    const work = findById<Work>("works", assignment.work_id);
    if (!work) { res.status(404).json({ error: "Work not found" }); return; }
    const race = findById<Race>("races", work.race_id);
    if (!race) { res.status(404).json({ error: "Race not found" }); return; }

    const user = getCurrentUser(req);
    const auth = authorize(user, "JudgeAssignment", "remove", { raceOrganizerIds: parseStringArray(race.organizer_user_ids) });
    if (!auth.allowed) { res.status(403).json({ error: auth.reason }); return; }

    const hasSubmittedRecord = filterBy<JudgingRecord>("judging_records", "judge_assignment_id", assignment.id)
      .some((record) => record.status === "submitted");
    if (hasSubmittedRecord) {
      res.status(409).json({ error: "submitted judging record exists for this assignment" });
      return;
    }

    remove("judge_assignments", assignment.id);
    res.json({ ok: true });
  });

  judgeAssignments.post("/:id/judging-records", requireLogin, (req: Request, res: Response) => {
    const assignment = findById<JudgeAssignment>("judge_assignments", req.params.id);
    if (!assignment) { res.status(404).json({ error: "Judge assignment not found" }); return; }

    const user = getCurrentUser(req);
    const auth = authorize(user, "JudgingRecord", "create", { assignedJudgeUserId: assignment.judge_user_id });
    if (!auth.allowed) { res.status(403).json({ error: auth.reason }); return; }

    if (filterBy<JudgingRecord>("judging_records", "judge_assignment_id", assignment.id).length > 0) {
      res.status(409).json({ error: "judging record already exists for this assignment" });
      return;
    }

    const draft = buildJudgingRecordUpdates(req, res, false);
    if (!draft) return;

    const now = new Date().toISOString();
    const record: JudgingRecord = {
      id: uuid(),
      judge_assignment_id: assignment.id,
      score_result: draft.score_result ?? null,
      score_riding: draft.score_riding ?? null,
      comments: draft.comments ?? "",
      status: "draft",
      submitted_at: null,
      created_at: now,
      updated_at: now,
    };

    insert("judging_records", record);
    res.status(201).json(toJudgingRecordResponse(record));
  });

  judgingRecords.patch("/:id", requireLogin, (req: Request, res: Response) => {
    const record = findById<JudgingRecord>("judging_records", req.params.id);
    if (!record) { res.status(404).json({ error: "Judging record not found" }); return; }
    if (record.status === "submitted") { res.status(409).json({ error: "submitted judging record cannot be edited" }); return; }

    const assignment = findById<JudgeAssignment>("judge_assignments", record.judge_assignment_id);
    if (!assignment) { res.status(404).json({ error: "Judge assignment not found" }); return; }

    const user = getCurrentUser(req);
    const auth = authorize(user, "JudgingRecord", "update_before_submit", { assignedJudgeUserId: assignment.judge_user_id });
    if (!auth.allowed) { res.status(403).json({ error: auth.reason }); return; }

    const updates = buildJudgingRecordUpdates(req, res, false);
    if (!updates) return;

    const updated = update<JudgingRecord>("judging_records", record.id, { ...updates, updated_at: new Date().toISOString() });
    res.json(toJudgingRecordResponse(updated!));
  });

  judgingRecords.post("/:id/submit", requireLogin, (req: Request, res: Response) => {
    const record = findById<JudgingRecord>("judging_records", req.params.id);
    if (!record) { res.status(404).json({ error: "Judging record not found" }); return; }
    if (record.status === "submitted") { res.status(409).json({ error: "judging record already submitted" }); return; }

    const assignment = findById<JudgeAssignment>("judge_assignments", record.judge_assignment_id);
    if (!assignment) { res.status(404).json({ error: "Judge assignment not found" }); return; }

    const user = getCurrentUser(req);
    const auth = authorize(user, "JudgingRecord", "submit", { assignedJudgeUserId: assignment.judge_user_id });
    if (!auth.allowed) { res.status(403).json({ error: auth.reason }); return; }

    const updates = buildJudgingRecordUpdates(req, res, false);
    if (!updates) return;
    const next = { ...record, ...updates };
    if (next.score_result === null || next.score_result === undefined) {
      res.status(400).json({ error: "scoreResult is required" });
      return;
    }
    if (next.score_riding === null || next.score_riding === undefined) {
      res.status(400).json({ error: "scoreRiding is required" });
      return;
    }

    const now = new Date().toISOString();
    const updated = update<JudgingRecord>("judging_records", record.id, {
      ...updates,
      status: "submitted",
      submitted_at: now,
      updated_at: now,
    });
    res.json(toJudgingRecordResponse(updated!));
  });

  awards.get("/", (req: Request, res: Response) => {
    const raceId = typeof req.query.raceId === "string" ? req.query.raceId : null;
    const rows = findAll<Award>("awards")
      .filter((award) => !raceId || award.race_id === raceId)
      .filter((award) => canReadAward(req, award))
      .sort((a, b) => a.rank - b.rank || a.award_name.localeCompare(b.award_name));

    res.json(rows.map(toAwardResponse));
  });

  awards.post("/", requireLogin, (req: Request, res: Response) => {
    const user = getCurrentUser(req);
    const draft = buildAwardDraft(req, res);
    if (!draft) return;

    const race = findById<Race>("races", draft.race_id);
    if (!race) { res.status(404).json({ error: "Race not found" }); return; }

    const auth = authorize(user, "Award", "create_draft", { raceOrganizerIds: parseStringArray(race.organizer_user_ids) });
    if (!auth.allowed) { res.status(403).json({ error: auth.reason }); return; }

    const conflict = getAwardConflict(draft.race_id, draft.award_name, draft.rank, draft.registration_id);
    if (conflict) { res.status(409).json({ error: conflict }); return; }

    const now = new Date().toISOString();
    const award: Award = {
      id: uuid(),
      race_id: draft.race_id,
      registration_id: draft.registration_id,
      work_id: draft.work_id,
      award_name: draft.award_name,
      rank: draft.rank,
      decision_reason: draft.decision_reason,
      judging_record_ids: JSON.stringify(draft.judging_record_ids),
      status: "draft",
      visibility: "private",
      published_at: null,
      created_by_user_id: user!.userId,
      created_at: now,
      updated_at: now,
    };

    insert("awards", award);
    res.status(201).json(toAwardResponse(award));
  });

  awards.patch("/:id", requireLogin, (req: Request, res: Response) => {
    const award = findById<Award>("awards", req.params.id);
    if (!award) { res.status(404).json({ error: "Award not found" }); return; }
    if (award.status !== "draft") { res.status(409).json({ error: "published award cannot be edited" }); return; }

    const race = findById<Race>("races", award.race_id);
    if (!race) { res.status(404).json({ error: "Race not found" }); return; }

    const user = getCurrentUser(req);
    const auth = authorize(user, "Award", "edit_draft", { raceOrganizerIds: parseStringArray(race.organizer_user_ids) });
    if (!auth.allowed) { res.status(403).json({ error: auth.reason }); return; }

    const updates = buildAwardEditableUpdates(req, res);
    if (!updates) return;

    const nextAward = { ...award, ...updates };
    const conflict = getAwardConflict(nextAward.race_id, nextAward.award_name, nextAward.rank, nextAward.registration_id, award.id);
    if (conflict) { res.status(409).json({ error: conflict }); return; }

    const updated = update<Award>("awards", award.id, { ...updates, updated_at: new Date().toISOString() });
    res.json(toAwardResponse(updated!));
  });

  awards.post("/:id/publish", requireLogin, (req: Request, res: Response) => {
    const award = findById<Award>("awards", req.params.id);
    if (!award) { res.status(404).json({ error: "Award not found" }); return; }

    const race = findById<Race>("races", award.race_id);
    if (!race) { res.status(404).json({ error: "Race not found" }); return; }

    const user = getCurrentUser(req);
    const auth = authorize(user, "Award", "publish", { raceOrganizerIds: parseStringArray(race.organizer_user_ids) });
    if (!auth.allowed) { res.status(403).json({ error: auth.reason }); return; }

    const conflict = getAwardConflict(award.race_id, award.award_name, award.rank, award.registration_id, award.id);
    if (conflict) { res.status(409).json({ error: conflict }); return; }

    const now = new Date().toISOString();
    const updated = update<Award>("awards", award.id, {
      status: "published",
      visibility: "public",
      published_at: now,
      updated_at: now,
    });
    res.json(toAwardResponse(updated!));
  });

  evidences.get("/", (req: Request, res: Response) => {
    const registrationId = typeof req.query.registrationId === "string" ? req.query.registrationId : null;
    const workId = typeof req.query.workId === "string" ? req.query.workId : null;

    const rows = findAll<Evidence>("evidences")
      .filter((evidence) => !registrationId || evidence.registration_id === registrationId)
      .filter((evidence) => !workId || evidence.work_id === workId)
      .filter((evidence) => canReadEvidence(req, evidence))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));

    res.json(rows.map((evidence) => toEvidenceResponse(evidence, { includeSourceRef: canReadPrivateEvidence(req, evidence) })));
  });

  evidences.post("/", requireLogin, (req: Request, res: Response) => {
    const user = getCurrentUser(req);
    const registrationId = req.body.registrationId;
    if (!registrationId || typeof registrationId !== "string") {
      res.status(400).json({ error: "registrationId is required" });
      return;
    }

    const registration = findById<Registration>("registrations", registrationId);
    if (!registration) { res.status(404).json({ error: "Registration not found" }); return; }

    const auth = authorize(user, "Evidence", "set_visibility", { ownerUserId: registration.user_id });
    if (!auth.allowed) { res.status(403).json({ error: auth.reason }); return; }

    const draft = buildEvidenceDraft(req, res, registration);
    if (!draft) return;

    const now = new Date().toISOString();
    const evidence: Evidence = {
      id: uuid(),
      registration_id: registration.id,
      work_id: draft.work_id,
      type: draft.type,
      title: draft.title,
      summary: draft.summary,
      source_ref: draft.source_ref,
      visibility: draft.visibility,
      created_by_user_id: user!.userId,
      created_at: now,
      updated_at: now,
    };

    insert("evidences", evidence);
    res.status(201).json(toEvidenceResponse(evidence, { includeSourceRef: true }));
  });

  evidences.patch("/:id/visibility", requireLogin, (req: Request, res: Response) => {
    const evidence = findById<Evidence>("evidences", req.params.id);
    if (!evidence) { res.status(404).json({ error: "Evidence not found" }); return; }

    const registration = findById<Registration>("registrations", evidence.registration_id);
    if (!registration) { res.status(404).json({ error: "Registration not found" }); return; }

    const user = getCurrentUser(req);
    const auth = authorize(user, "Evidence", "set_visibility", { ownerUserId: registration.user_id });
    if (!auth.allowed) { res.status(403).json({ error: auth.reason }); return; }

    if (!isVisibility(req.body.visibility)) {
      res.status(400).json({ error: "visibility must be private or public" });
      return;
    }

    const updated = update<Evidence>("evidences", evidence.id, {
      visibility: req.body.visibility,
      updated_at: new Date().toISOString(),
    });
    res.json(toEvidenceResponse(updated!, { includeSourceRef: true }));
  });

  app.use("/works", works);
  app.use("/judge-assignments", judgeAssignments);
  app.use("/judging-records", judgingRecords);
  app.use("/awards", awards);
  app.use("/evidences", evidences);
  console.log("[portfolio] Routes registered: /works/*, /judge-assignments/*, /judging-records/*, /awards/*, /evidences/*");
}

function toWorkResponse(work: Work, extras: { includeReviewWarnings?: boolean } = {}) {
  return {
    id: work.id,
    registrationId: work.registration_id,
    raceId: work.race_id,
    userId: work.user_id,
    slug: work.slug,
    title: work.title,
    summary: work.summary,
    problemStatement: work.problem_statement,
    solutionSummary: work.solution_summary,
    techStack: work.tech_stack,
    repoUrl: work.repo_url,
    demoUrl: work.demo_url,
    videoUrl: work.video_url,
    status: work.status,
    visibility: work.visibility,
    submittedAt: work.submitted_at,
    lockedAt: work.locked_at,
    publishedAt: work.published_at,
    createdAt: work.created_at,
    updatedAt: work.updated_at,
    reviewWarnings: extras.includeReviewWarnings ? getReviewWarningsForRegistration(work.registration_id) : [],
  };
}

function toJudgeAssignmentResponse(
  assignment: JudgeAssignment,
  extras: { includeWork?: boolean; includeRecord?: boolean } = {},
) {
  const work = extras.includeWork ? findById<Work>("works", assignment.work_id) : null;
  const record = extras.includeRecord ? findBy<JudgingRecord>("judging_records", "judge_assignment_id", assignment.id) : null;
  const judgeUser = findById<UserRow>("users", assignment.judge_user_id);
  return {
    id: assignment.id,
    workId: assignment.work_id,
    judgeUserId: assignment.judge_user_id,
    judgeGithubAccount: judgeUser?.githubAccount || assignment.judge_user_id,
    assignedByUserId: assignment.assigned_by_user_id,
    assignedAt: assignment.assigned_at,
    createdAt: assignment.created_at,
    updatedAt: assignment.updated_at,
    work: work ? toWorkResponse(work, { includeReviewWarnings: true }) : null,
    judgingRecord: record ? toJudgingRecordResponse(record) : null,
  };
}

function toJudgingRecordResponse(record: JudgingRecord) {
  return {
    id: record.id,
    judgeAssignmentId: record.judge_assignment_id,
    scoreResult: record.score_result,
    scoreRiding: record.score_riding,
    comments: record.comments,
    status: record.status,
    submittedAt: record.submitted_at,
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

function toAwardResponse(award: Award) {
  return {
    id: award.id,
    raceId: award.race_id,
    registrationId: award.registration_id,
    workId: award.work_id,
    awardName: award.award_name,
    rank: award.rank,
    decisionReason: award.decision_reason,
    judgingRecordIds: parseStringArray(award.judging_record_ids),
    status: award.status,
    visibility: award.visibility,
    publishedAt: award.published_at,
    createdByUserId: award.created_by_user_id,
    createdAt: award.created_at,
    updatedAt: award.updated_at,
  };
}

function toEvidenceResponse(evidence: Evidence, extras: { includeSourceRef?: boolean } = {}) {
  const response: Record<string, unknown> = {
    id: evidence.id,
    registrationId: evidence.registration_id,
    workId: evidence.work_id,
    type: evidence.type,
    title: evidence.title,
    summary: evidence.summary,
    visibility: evidence.visibility,
    createdByUserId: evidence.created_by_user_id,
    createdAt: evidence.created_at,
    updatedAt: evidence.updated_at,
  };
  if (extras.includeSourceRef) response.sourceRef = parseSourceRef(evidence.source_ref);
  return response;
}

function toReviewWarningResponse(warning: ReviewWarning) {
  return warning;
}

export function getReviewWarningsForRegistration(registrationId: string): ReviewWarning[] {
  const registration = findById<Registration>("registrations", registrationId);
  if (!registration) {
    return [toReviewWarningResponse({
      code: "missing_race_project",
      severity: "warning",
      message: "Registration data is missing for review warning lookup.",
      registrationId,
    })];
  }

  const raceProject = findBy<RaceProject>("race_projects", "registration_id", registrationId);
  if (!raceProject) {
    return [toReviewWarningResponse({
      code: "missing_race_project",
      severity: "warning",
      message: "Race project is missing for this registration.",
      registrationId,
    })];
  }

  if (raceProject.aggregate_ingestion_status === "not_configured") {
    return [toReviewWarningResponse({
      code: "ca_not_configured",
      severity: "warning",
      message: "CA ingestion is not configured for this registration.",
      registrationId,
      raceProjectId: raceProject.id,
      aggregateIngestionStatus: raceProject.aggregate_ingestion_status,
    })];
  }

  if (raceProject.aggregate_ingestion_status === "failed") {
    return [toReviewWarningResponse({
      code: "ca_ingestion_failed",
      severity: "warning",
      message: "CA ingestion failed for this registration.",
      registrationId,
      raceProjectId: raceProject.id,
      aggregateIngestionStatus: raceProject.aggregate_ingestion_status,
    })];
  }

  return [];
}

function getRaceIdFromQuery(req: Request, res: Response): string | null | false {
  if (typeof req.query.raceId === "string") return req.query.raceId;
  if (typeof req.query.raceSlug === "string") {
    const race = findBy<Race>("races", "slug", req.query.raceSlug);
    if (!race) {
      res.json([]);
      return false;
    }
    return race.id;
  }
  return null;
}

function canReadWork(req: Request, work: Work): boolean {
  const user = getCurrentUser(req);
  const publicAuth = authorize(user, "Work", "view_public", {
    visibility: work.visibility,
    isPublished: !!work.published_at,
  });
  if (publicAuth.allowed) return true;

  return canReadPrivateWork(user, work);
}

function shouldIncludeWorkWarnings(user: ReturnType<typeof getCurrentUser>, work: Work): boolean {
  if (!user) return false;
  return canReadPrivateWork(user, work);
}

function canReadPrivateWork(user: ReturnType<typeof getCurrentUser>, work: Work): boolean {
  const registration = findById<Registration>("registrations", work.registration_id);
  const race = findById<Race>("races", work.race_id);
  if (registration || race) {
    const privateAuth = authorize(user, "Work", "view_private", {
      ownerUserId: registration?.user_id,
      raceOrganizerIds: race ? parseStringArray(race.organizer_user_ids) : [],
    });
    if (privateAuth.allowed) return true;
  }

  return findAll<JudgeAssignment>("judge_assignments")
    .filter((assignment) => assignment.work_id === work.id)
    .some((assignment) => authorize(user, "Work", "view_private", {
      assignedJudgeUserId: assignment.judge_user_id,
      raceOrganizerIds: [],
    }).allowed);
}

function canReadAward(req: Request, award: Award): boolean {
  const user = getCurrentUser(req);
  const publicAuth = authorize(user, "Award", "view_published", {
    visibility: award.visibility,
    isPublished: !!award.published_at,
  });
  if (publicAuth.allowed) return true;

  const race = findById<Race>("races", award.race_id);
  if (!race) return false;
  return authorize(user, "Award", "view_draft", { raceOrganizerIds: parseStringArray(race.organizer_user_ids) }).allowed;
}

function canReadEvidence(req: Request, evidence: Evidence): boolean {
  const user = getCurrentUser(req);
  const publicAuth = authorize(user, "Evidence", "view_public", {
    visibility: evidence.visibility,
    isPublished: evidence.visibility === "public",
  });
  if (publicAuth.allowed) return true;

  return canReadPrivateEvidence(req, evidence);
}

function canReadPrivateEvidence(req: Request, evidence: Evidence): boolean {
  const registration = findById<Registration>("registrations", evidence.registration_id);
  if (!registration) return false;
  return authorize(getCurrentUser(req), "Evidence", "view_private_summary", { ownerUserId: registration.user_id }).allowed;
}

function buildWorkEditableUpdates(req: Request, res: Response, allowEmptyBody = false): Partial<Work> | null {
  const body = req.body || {};
  const updates: Partial<Work> = {};

  if (body.title !== undefined) {
    if (!body.title || typeof body.title !== "string") { res.status(400).json({ error: "title must be a non-empty string" }); return null; }
    updates.title = body.title.trim();
  }
  if (body.summary !== undefined) {
    if (typeof body.summary !== "string") { res.status(400).json({ error: "summary must be a string" }); return null; }
    updates.summary = body.summary.trim();
  }
  if (body.problemStatement !== undefined) {
    if (typeof body.problemStatement !== "string") { res.status(400).json({ error: "problemStatement must be a string" }); return null; }
    updates.problem_statement = body.problemStatement.trim();
  }
  if (body.solutionSummary !== undefined) {
    if (typeof body.solutionSummary !== "string") { res.status(400).json({ error: "solutionSummary must be a string" }); return null; }
    updates.solution_summary = body.solutionSummary.trim();
  }
  if (body.techStack !== undefined) {
    if (typeof body.techStack !== "string") { res.status(400).json({ error: "techStack must be a string" }); return null; }
    updates.tech_stack = body.techStack.trim();
  }
  if (body.repoUrl !== undefined) updates.repo_url = optionalString(body.repoUrl);
  if (body.demoUrl !== undefined) updates.demo_url = optionalString(body.demoUrl);
  if (body.videoUrl !== undefined) updates.video_url = optionalString(body.videoUrl);
  if (body.slug !== undefined) {
    const slug = normalizeSlug(body.slug);
    if (!slug) { res.status(400).json({ error: "slug must produce a valid slug" }); return null; }
    const existing = findBy<Work>("works", "slug", slug);
    if (existing && existing.id !== req.params.id) { res.status(409).json({ error: "slug already exists" }); return null; }
    updates.slug = slug;
  }

  if (!allowEmptyBody && Object.keys(updates).length === 0) return {};
  return updates;
}

function buildJudgingRecordUpdates(req: Request, res: Response, requireAny: boolean): Partial<JudgingRecord> | null {
  const updates: Partial<JudgingRecord> = {};
  if (req.body.scoreResult !== undefined) {
    const score = parseScore(req.body.scoreResult);
    if (score === null) { res.status(400).json({ error: "scoreResult must be an integer from 0 to 100" }); return null; }
    updates.score_result = score;
  }
  if (req.body.scoreRiding !== undefined) {
    const score = parseScore(req.body.scoreRiding);
    if (score === null) { res.status(400).json({ error: "scoreRiding must be an integer from 0 to 100" }); return null; }
    updates.score_riding = score;
  }
  if (req.body.comments !== undefined) {
    if (typeof req.body.comments !== "string") { res.status(400).json({ error: "comments must be a string" }); return null; }
    updates.comments = req.body.comments.trim();
  }
  if (requireAny && Object.keys(updates).length === 0) {
    res.status(400).json({ error: "at least one field is required" });
    return null;
  }
  return updates;
}

function buildAwardDraft(req: Request, res: Response) {
  const registrationId = req.body.registrationId;
  if (!registrationId || typeof registrationId !== "string") {
    res.status(400).json({ error: "registrationId is required" });
    return null;
  }

  const registration = findById<Registration>("registrations", registrationId);
  if (!registration) { res.status(404).json({ error: "Registration not found" }); return null; }
  if (req.body.raceId !== undefined && req.body.raceId !== registration.race_id) {
    res.status(400).json({ error: "raceId must match registration raceId" });
    return null;
  }

  const workId = optionalString(req.body.workId);
  if (workId) {
    const work = findById<Work>("works", workId);
    if (!work) { res.status(404).json({ error: "Work not found" }); return null; }
    if (work.registration_id !== registration.id) {
      res.status(400).json({ error: "workId must belong to registrationId" });
      return null;
    }
  }

  const awardName = nonEmptyString(req.body.awardName);
  if (!awardName) { res.status(400).json({ error: "awardName is required" }); return null; }
  const rank = parsePositiveInteger(req.body.rank);
  if (rank === null) { res.status(400).json({ error: "rank must be a positive integer" }); return null; }

  const judgingRecordIds = parseJudgingRecordIds(req.body.judgingRecordIds, res);
  if (!judgingRecordIds) return null;

  return {
    race_id: registration.race_id,
    registration_id: registration.id,
    work_id: workId,
    award_name: awardName,
    rank,
    decision_reason: stringOrEmpty(req.body.decisionReason),
    judging_record_ids: judgingRecordIds,
  };
}

function buildAwardEditableUpdates(req: Request, res: Response): Partial<Award> | null {
  const updates: Partial<Award> = {};
  if (req.body.awardName !== undefined) {
    const awardName = nonEmptyString(req.body.awardName);
    if (!awardName) { res.status(400).json({ error: "awardName must be a non-empty string" }); return null; }
    updates.award_name = awardName;
  }
  if (req.body.rank !== undefined) {
    const rank = parsePositiveInteger(req.body.rank);
    if (rank === null) { res.status(400).json({ error: "rank must be a positive integer" }); return null; }
    updates.rank = rank;
  }
  if (req.body.decisionReason !== undefined) {
    if (typeof req.body.decisionReason !== "string") { res.status(400).json({ error: "decisionReason must be a string" }); return null; }
    updates.decision_reason = req.body.decisionReason.trim();
  }
  if (req.body.judgingRecordIds !== undefined) {
    const judgingRecordIds = parseJudgingRecordIds(req.body.judgingRecordIds, res);
    if (!judgingRecordIds) return null;
    updates.judging_record_ids = JSON.stringify(judgingRecordIds);
  }
  return updates;
}

function buildEvidenceDraft(req: Request, res: Response, registration: Registration) {
  const type = req.body.type;
  if (!isEvidenceType(type)) {
    res.status(400).json({ error: "Invalid evidence type" });
    return null;
  }

  const title = nonEmptyString(req.body.title);
  if (!title) { res.status(400).json({ error: "title is required" }); return null; }

  const workId = optionalString(req.body.workId);
  if (workId) {
    const work = findById<Work>("works", workId);
    if (!work) { res.status(404).json({ error: "Work not found" }); return null; }
    if (work.registration_id !== registration.id) {
      res.status(400).json({ error: "workId must belong to registrationId" });
      return null;
    }
  }

  const sourceRef = serializeSourceRef(req.body.sourceRef);
  if (!sourceRef) { res.status(400).json({ error: "sourceRef is required" }); return null; }

  if (type === "session_summary") {
    const sessionId = getSourceRefId(req.body.sourceRef, "sessionId");
    if (!sessionId || !findById("sessions", sessionId)) {
      res.status(400).json({ error: "session_summary evidence must reference an existing sessionId" });
      return null;
    }
  }

  if (type === "judge_comment") {
    const judgingRecordId = getSourceRefId(req.body.sourceRef, "judgingRecordId");
    if (!judgingRecordId || !findById("judging_records", judgingRecordId)) {
      res.status(400).json({ error: "judge_comment evidence must reference an existing judgingRecordId" });
      return null;
    }
  }

  const visibility = req.body.visibility === undefined ? "private" : req.body.visibility;
  if (!isVisibility(visibility)) {
    res.status(400).json({ error: "visibility must be private or public" });
    return null;
  }

  return {
    work_id: workId,
    type,
    title,
    summary: stringOrEmpty(req.body.summary),
    source_ref: sourceRef,
    visibility,
  };
}

function getAwardConflict(raceId: string, awardName: string, rank: number, registrationId: string, excludeId?: string): string | null {
  const awards = findAll<Award>("awards").filter((award) => award.id !== excludeId);
  if (awards.some((award) => award.race_id === raceId && award.award_name === awardName && award.rank === rank)) {
    return "award rank already exists for this race and award name";
  }
  if (awards.some((award) => award.race_id === raceId && award.award_name === awardName && award.registration_id === registrationId)) {
    return "registration already has this award in this race";
  }
  return null;
}

function parseJudgingRecordIds(value: unknown, res: Response): string[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || !value.every((item) => typeof item === "string")) {
    res.status(400).json({ error: "judgingRecordIds must be an array of strings" });
    return null;
  }
  for (const id of value) {
    if (!findById<JudgingRecord>("judging_records", id)) {
      res.status(400).json({ error: `Judging record not found: ${id}` });
      return null;
    }
  }
  return value;
}

function normalizeSlug(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function stringOrEmpty(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function nonEmptyString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function parseScore(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 100) return null;
  return value;
}

function parsePositiveInteger(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) return null;
  return value;
}

function isEvidenceType(value: unknown): value is EvidenceType {
  return typeof value === "string" && (EVIDENCE_TYPES as readonly string[]).includes(value);
}

function isVisibility(value: unknown): value is Visibility {
  return typeof value === "string" && (VISIBILITIES as readonly string[]).includes(value);
}

function parseStringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === "string");
  if (typeof value !== "string") return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function serializeSourceRef(value: unknown): string | null {
  if (typeof value === "string") return value.trim() ? value.trim() : null;
  if (value && typeof value === "object") return JSON.stringify(value);
  return null;
}

function parseSourceRef(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function getSourceRefId(value: unknown, preferredKey: string): string | null {
  if (typeof value === "string") return value.trim() || null;
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const preferred = record[preferredKey];
  if (typeof preferred === "string" && preferred.trim()) return preferred.trim();
  const id = record.id;
  return typeof id === "string" && id.trim() ? id.trim() : null;
}

import type { Express, Request, Response } from "express";
import { Router } from "express";
import { v4 as uuid } from "uuid";
import { findAll, findBy, findById, insert, update } from "../../db.js";
import { authorize, getCurrentUser, requireLogin } from "../../shared/auth.js";

const PROJECTION_TYPES = [
  "race_progress",
  "registration_status",
  "cost",
  "risk",
  "submission",
  "judging",
  "current_leaderboard",
  "screen_feed",
] as const;

type ProjectionType = typeof PROJECTION_TYPES[number];
type ReadModelType = "leaderboard_read_model" | "results_page_read_model" | "review_summary_read_model";
type ReadMode = "live" | "stable_fallback" | "static_fallback";
type FallbackCode = "none" | "projection_failed_uses_stable" | "projection_failed_uses_static";
type StatusReadMode = ReadMode | "not_built";
type ServeReadiness = "live" | "degraded" | "partial" | "not_ready";

interface ContractDescriptor {
  readKind: "projection" | "read_model";
  sourceOfTruth: string[];
  consumerBoundary: string;
}

interface Race {
  id: string;
  slug: string;
  title: string;
  challenge: string;
  status: string;
  visibility: string;
  organizer_user_ids: string[] | string;
  registration_opens_at: string | null;
  registration_closes_at: string | null;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
  updated_at: string;
}

interface Registration {
  id: string;
  race_id: string;
  user_id: string;
  status: string;
  submitted_at: string;
  approved_at: string | null;
  rejected_at: string | null;
  withdrawn_at: string | null;
  created_at: string;
  updated_at: string;
}

interface RaceProject {
  id: string;
  registration_id: string;
  race_id: string;
  user_id: string;
  aggregate_ingestion_status: string;
  connection_health: string;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

interface CAConnection {
  id: string;
  race_project_id: string;
  connector_id: string;
  handshake_status: string;
  ingestion_status: string;
  disabled_at: string | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

interface SessionRow {
  id: string;
  ca_connection_id: string;
  race_project_id: string;
  message_count: number;
  tool_call_count: number;
  token_cost: number;
  accepted_at: string;
  created_at: string;
}

interface Work {
  id: string;
  registration_id: string;
  race_id: string;
  user_id: string;
  slug: string;
  title: string;
  summary: string;
  status: string;
  visibility: string;
  submitted_at: string | null;
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
  status: "draft" | "published";
  visibility: string;
  published_at: string | null;
  created_at: string;
  updated_at: string;
}

interface Announcement {
  id: string;
  race_id: string;
  title: string;
  body: string;
  visibility: string;
  published_at: string | null;
  created_at: string;
}

interface UserRow {
  id: string;
  githubAccount?: string;
  github_account?: string;
  displayName?: string;
  display_name?: string;
}

interface ReportRow {
  id: string;
  race_id: string;
  report_type: "rider_report" | "race_report" | "review_summary";
  title?: string;
  summary?: string;
  body_markdown?: string;
  visibility?: string;
  status?: string;
  published_at?: string | null;
  updated_at?: string;
  created_at?: string;
}

interface ProjectionRow {
  id: string;
  race_id: string;
  type: ProjectionType;
  status: "ready" | "failed";
  data: unknown;
  generated_at: string | null;
  last_attempted_at: string;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

interface ProjectionReadResult {
  row: ProjectionRow;
  mode: ReadMode;
  fallbackReason: string | null;
}

interface ScreenFeedItem<T = unknown> {
  id: string;
  feedItemType: "live_metrics" | "process_leaderboard" | "final_leaderboard" | "work_highlight" | "announcement";
  mode: "live" | "leaderboard" | "works" | "announcement";
  title: string;
  order: number;
  durationMs: number;
  recommendedDisplayMode: "live" | "leaderboard" | "works" | "announcement";
  fallbackPriority: 1 | 2 | 3 | 4;
  data: T;
}

interface ProjectionContext {
  race: Race;
  registrations: Registration[];
  raceProjects: RaceProject[];
  caConnections: CAConnection[];
  sessions: SessionRow[];
  works: Work[];
  judgeAssignments: JudgeAssignment[];
  judgingRecords: JudgingRecord[];
  awards: Award[];
  announcements: Announcement[];
  users: UserRow[];
  reports: ReportRow[];
}

const CONTRACT_VERSION = "d.v1";
const PROJECTION_DESCRIPTORS: Record<ProjectionType, ContractDescriptor> = {
  race_progress: { readKind: "projection", sourceOfTruth: ["races", "registrations", "race_projects", "sessions", "works", "awards", "announcements"], consumerBoundary: "Live Hall / process display only" },
  registration_status: { readKind: "projection", sourceOfTruth: ["registrations", "race_projects", "works", "sessions", "users"], consumerBoundary: "Live Hall / Console status only" },
  cost: { readKind: "projection", sourceOfTruth: ["registrations", "race_projects", "sessions"], consumerBoundary: "Process metrics only" },
  risk: { readKind: "projection", sourceOfTruth: ["race_projects", "registrations", "works"], consumerBoundary: "Risk display only" },
  submission: { readKind: "projection", sourceOfTruth: ["works"], consumerBoundary: "Submission state only" },
  judging: { readKind: "projection", sourceOfTruth: ["judge_assignments", "judging_records", "works"], consumerBoundary: "Judging progress only" },
  current_leaderboard: { readKind: "projection", sourceOfTruth: ["registrations", "works", "race_projects", "judge_assignments", "judging_records", "sessions"], consumerBoundary: "Process leaderboard only; never final result" },
  screen_feed: { readKind: "projection", sourceOfTruth: ["race_progress", "current_leaderboard", "leaderboard_read_model", "works", "announcements"], consumerBoundary: "Screen display feed only" },
};

const READ_MODEL_DESCRIPTORS: Record<ReadModelType, ContractDescriptor> = {
  leaderboard_read_model: { readKind: "read_model", sourceOfTruth: ["awards"], consumerBoundary: "Final published leaderboard only" },
  results_page_read_model: { readKind: "read_model", sourceOfTruth: ["awards", "works", "reports"], consumerBoundary: "Public Results page only; excludes process leaderboard" },
  review_summary_read_model: { readKind: "read_model", sourceOfTruth: ["reports", "awards", "works"], consumerBoundary: "Public Review page only; excludes process projection as final fact" },
};

export function registerProjectionRoutes(app: Express): void {
  const router = Router();

  router.get("/:raceId/status-summary", requireLogin, (req: Request, res: Response) => {
    const race = resolveRace(req.params.raceId);
    if (!race) {
      res.status(404).json({ error: "Race not found" });
      return;
    }

    const user = getCurrentUser(req);
    const auth = authorize(user, "Projection", "inspect_status", {
      raceOrganizerIds: parseStringArray(race.organizer_user_ids),
    });
    if (!auth.allowed) {
      res.status(403).json({ error: auth.reason });
      return;
    }

    const context = buildContext(race);
    const projections = PROJECTION_TYPES.map((type) => inspectProjectionStatus(race, type));
    const readModels = (["leaderboard_read_model", "results_page_read_model", "review_summary_read_model"] as ReadModelType[])
      .map((type) => inspectReadModelStatus(race, context, type));
    const statusSummary = buildProjectionStatusSummary(race, projections, readModels);

    res.json({
      contractVersion: CONTRACT_VERSION,
      race: toRaceSummary(race),
      summary: statusSummary,
      projections,
      readModels,
    });
  });

  router.get("/:raceId/:type", (req: Request, res: Response) => {
    const race = resolveRace(req.params.raceId);
    if (!race) {
      res.status(404).json({ error: "Race not found" });
      return;
    }

    const user = getCurrentUser(req);
    const auth = canReadProjection(user, race);
    if (!auth.allowed) {
      res.status(403).json({ error: auth.reason });
      return;
    }

    const type = req.params.type;
    if (type === "leaderboard_read_model") {
      const data = buildLeaderboardReadModel(buildContext(race));
      res.json(toReadModelResponse(race.id, type, newestTimestamp(data.groups.flatMap((group) => group.items.map((item) => item.publishedAt)).filter(Boolean as any)) || new Date().toISOString(), data));
      return;
    }
    if (type === "results_page_read_model") {
      const data = buildResultsPageReadModel(buildContext(race));
      res.json(toReadModelResponse(race.id, type, newestTimestamp([
          data.review.report?.publishedAt || "",
          ...data.leaderboard.groups.flatMap((group) => group.items.map((item) => item.publishedAt || "")),
          ...data.winningWorks.map((work) => work.publishedAt || ""),
        ].filter(Boolean)) || new Date().toISOString(), data));
      return;
    }
    if (type === "review_summary_read_model") {
      const data = buildReviewSummaryReadModel(buildContext(race));
      res.json(toReadModelResponse(race.id, type, data.report.report?.publishedAt || newestTimestamp(data.winningWorks.map((work) => work.publishedAt || "").filter(Boolean)) || new Date().toISOString(), data));
      return;
    }

    if (!isProjectionType(type)) {
      res.status(400).json({ error: "Unsupported projection type" });
      return;
    }

    try {
      const projection = readProjection(race, type);
      res.json(toProjectionResponse(projection));
    } catch (error) {
      res.status(503).json({ error: error instanceof Error ? error.message : "Projection unavailable" });
    }
  });

  router.post("/:raceId/rebuild", requireLogin, (req: Request, res: Response) => {
    const race = resolveRace(req.params.raceId);
    if (!race) {
      res.status(404).json({ error: "Race not found" });
      return;
    }

    const user = getCurrentUser(req);
    const auth = authorize(user, "Projection", "rebuild", {
      raceOrganizerIds: parseStringArray(race.organizer_user_ids),
    });
    if (!auth.allowed) {
      res.status(403).json({ error: auth.reason });
      return;
    }

    const rebuiltAt = new Date().toISOString();
    const results = PROJECTION_TYPES.map((type) => {
      try {
        const row = rebuildProjection(race, type, rebuiltAt);
        return toProjectionResponse({ row, mode: "live", fallbackReason: null });
      } catch (error) {
        const row = markProjectionFailed(race.id, type, error instanceof Error ? error.message : "Projection rebuild failed", rebuiltAt);
        return toProjectionResponse({
          row,
          mode: row.generated_at ? "stable_fallback" : "live",
          fallbackReason: row.generated_at ? (row.last_error || "Projection rebuild failed") : null,
        });
      }
    });

    res.json({
      raceId: race.id,
      rebuiltAt,
      summary: {
        ready: results.filter((result) => result.status === "ready").length,
        failed: results.filter((result) => result.status === "failed").length,
        usingStableFallback: results.filter((result) => result.readMode === "stable_fallback").length,
      },
      projections: results,
    });
  });

  app.use("/projections", router);
  console.log("[projection] Routes registered: /projections/*");
}

function canReadProjection(user: ReturnType<typeof getCurrentUser>, race: Race) {
  const publicAuth = authorize(user, "Projection", "view_public", {
    visibility: race.visibility,
    isPublished: race.visibility === "public",
  });
  if (publicAuth.allowed) return publicAuth;
  return authorize(user, "Projection", "view_internal", {
    raceOrganizerIds: parseStringArray(race.organizer_user_ids),
  });
}

function getOrBuildProjection(race: Race, type: ProjectionType): ProjectionRow {
  const existing = findProjection(race.id, type);
  if (existing) return existing;
  return rebuildProjection(race, type);
}

function readProjection(race: Race, type: ProjectionType): ProjectionReadResult {
  const projection = getOrBuildProjection(race, type);
  if (projection.status === "ready") {
    return { row: projection, mode: "live", fallbackReason: null };
  }
  if (projection.generated_at) {
    return {
      row: projection,
      mode: "stable_fallback",
      fallbackReason: projection.last_error || "Projection unavailable, using last stable snapshot.",
    };
  }
  return {
    row: buildStaticFallbackRow(race, type, projection.last_error || "Projection unavailable"),
    mode: "static_fallback",
    fallbackReason: projection.last_error || "Projection unavailable, using static fallback.",
  };
}

function rebuildProjection(race: Race, type: ProjectionType, timestamp = new Date().toISOString()): ProjectionRow {
  const context = buildContext(race);
  const data = buildProjectionData(type, context);
  return upsertProjection(race.id, type, data, timestamp);
}

function buildProjectionData(type: ProjectionType, context: ProjectionContext) {
  if (type === "race_progress") return buildRaceProgress(context);
  if (type === "registration_status") return buildRegistrationStatus(context);
  if (type === "cost") return buildCostProjection(context);
  if (type === "risk") return buildRiskProjection(context);
  if (type === "submission") return buildSubmissionProjection(context);
  if (type === "judging") return buildJudgingProjection(context);
  if (type === "current_leaderboard") return buildCurrentLeaderboardProjection(context);
  return buildScreenFeedProjection(context);
}

function buildContext(race: Race): ProjectionContext {
  return {
    race,
    registrations: findAll<Registration>("registrations").filter((row) => row.race_id === race.id),
    raceProjects: findAll<RaceProject>("race_projects").filter((row) => row.race_id === race.id),
    caConnections: findAll<CAConnection>("ca_connections"),
    sessions: findAll<SessionRow>("sessions"),
    works: findAll<Work>("works").filter((row) => row.race_id === race.id),
    judgeAssignments: findAll<JudgeAssignment>("judge_assignments"),
    judgingRecords: findAll<JudgingRecord>("judging_records"),
    awards: findAll<Award>("awards").filter((row) => row.race_id === race.id),
    announcements: findAll<Announcement>("announcements").filter((row) => row.race_id === race.id),
    users: findAll<UserRow>("users"),
    reports: findAll<ReportRow>("reports").filter((row) => row.race_id === race.id),
  };
}

function buildRaceProgress(context: ProjectionContext) {
  const metrics = summarizeMetrics(context);
  const eventStream = buildEventStream(context);
  const publishedAwards = context.awards.filter((award) => award.status === "published" && award.visibility === "public");

  return {
    race: toRaceSummary(context.race),
    stageLabel: formatRaceStage(context.race.status),
    headline: buildRaceHeadline(context.race.status, metrics),
    counts: {
      registrationsTotal: context.registrations.length,
      approvedRegistrations: context.registrations.filter((row) => row.status === "approved").length,
      worksSubmitted: context.works.filter((row) => row.status === "submitted" || row.status === "locked").length,
      worksPublished: context.works.filter((row) => row.visibility === "public" && row.published_at).length,
      judgingSubmitted: context.judgingRecords.filter((row) => row.status === "submitted").length,
      awardsPublished: publishedAwards.length,
      activeConnections: metrics.activeConnections,
      sessionCount: metrics.sessionCount,
    },
    totals: {
      tokenCost: metrics.tokenCost,
      toolCallCount: metrics.toolCallCount,
      messageCount: metrics.messageCount,
    },
    eventStream,
    note: "过程数据仅用于 Live Hall 和大屏展示，不代替最终赛果。",
  };
}

function buildRegistrationStatus(context: ProjectionContext) {
  const raceProjectByRegistrationId = new Map(context.raceProjects.map((row) => [row.registration_id, row]));
  const workByRegistrationId = new Map(context.works.map((row) => [row.registration_id, row]));
  const userById = new Map(context.users.map((row) => [row.id, row]));

  const registrations = context.registrations
    .slice()
    .sort((a, b) => compareTimestamps(b.updated_at, a.updated_at))
    .map((registration) => {
      const raceProject = raceProjectByRegistrationId.get(registration.id) || null;
      const work = workByRegistrationId.get(registration.id) || null;
      const metrics = summarizeRegistrationMetrics(context, registration.id, raceProject?.id || null);
      const user = userById.get(registration.user_id);
      return {
        registrationId: registration.id,
        userId: registration.user_id,
        riderName: readDisplayName(user, registration.user_id),
        status: registration.status,
        workStatus: work?.status || "not_created",
        workTitle: work?.title || null,
        raceProjectId: raceProject?.id || null,
        aggregateIngestionStatus: raceProject?.aggregate_ingestion_status || "missing",
        connectionHealth: raceProject?.connection_health || "unknown",
        sessionCount: metrics.sessionCount,
        tokenCost: metrics.tokenCost,
        toolCallCount: metrics.toolCallCount,
        lastSyncedAt: raceProject?.last_synced_at || null,
      };
    });

  return {
    race: toRaceSummary(context.race),
    registrations,
  };
}

function buildCostProjection(context: ProjectionContext) {
  const raceProjectByRegistrationId = new Map(context.raceProjects.map((row) => [row.registration_id, row]));
  const totals = summarizeMetrics(context);

  const byRegistration = context.registrations.map((registration) => {
    const raceProject = raceProjectByRegistrationId.get(registration.id) || null;
    const metrics = summarizeRegistrationMetrics(context, registration.id, raceProject?.id || null);
    return {
      registrationId: registration.id,
      userId: registration.user_id,
      sessionCount: metrics.sessionCount,
      tokenCost: metrics.tokenCost,
      toolCallCount: metrics.toolCallCount,
      messageCount: metrics.messageCount,
    };
  });

  return {
    race: toRaceSummary(context.race),
    totals: {
      sessionCount: totals.sessionCount,
      tokenCost: totals.tokenCost,
      toolCallCount: totals.toolCallCount,
      messageCount: totals.messageCount,
    },
    byRegistration,
  };
}

function buildRiskProjection(context: ProjectionContext) {
  const workByRegistrationId = new Map(context.works.map((row) => [row.registration_id, row]));
  const items: Array<{
    code: string;
    severity: "warning";
    registrationId?: string;
    raceProjectId?: string;
    title: string;
    message: string;
  }> = [];

  for (const raceProject of context.raceProjects) {
    if (raceProject.aggregate_ingestion_status === "failed") {
      items.push({
        code: "ca_ingestion_failed",
        severity: "warning",
        registrationId: raceProject.registration_id,
        raceProjectId: raceProject.id,
        title: "CA 接入失败",
        message: `RaceProject ${raceProject.id} 当前为 failed，评审前需要明确告知证据缺口。`,
      });
    }
    if (raceProject.aggregate_ingestion_status === "not_configured") {
      items.push({
        code: "ca_not_configured",
        severity: "warning",
        registrationId: raceProject.registration_id,
        raceProjectId: raceProject.id,
        title: "尚未配置 CA",
        message: `RaceProject ${raceProject.id} 尚未接入有效 CAConnection。`,
      });
    }
  }

  if (["submitting", "judging", "completed"].includes(context.race.status)) {
    for (const registration of context.registrations.filter((row) => row.status === "approved")) {
      if (!workByRegistrationId.has(registration.id)) {
        items.push({
          code: "missing_work",
          severity: "warning",
          registrationId: registration.id,
          title: "缺少作品提交",
          message: `报名 ${registration.id} 已通过，但当前阶段尚未看到主 Work。`,
        });
      }
    }
  }

  return {
    race: toRaceSummary(context.race),
    counts: {
      total: items.length,
      caFailed: items.filter((item) => item.code === "ca_ingestion_failed").length,
      caNotConfigured: items.filter((item) => item.code === "ca_not_configured").length,
      missingWork: items.filter((item) => item.code === "missing_work").length,
    },
    items,
  };
}

function buildSubmissionProjection(context: ProjectionContext) {
  const items = context.works
    .slice()
    .sort((a, b) => compareTimestamps(b.updated_at, a.updated_at))
    .map((work) => ({
      workId: work.id,
      registrationId: work.registration_id,
      userId: work.user_id,
      title: work.title,
      status: work.status,
      visibility: work.visibility,
      submittedAt: work.submitted_at,
      publishedAt: work.published_at,
      updatedAt: work.updated_at,
    }));

  return {
    race: toRaceSummary(context.race),
    counts: {
      total: items.length,
      draft: items.filter((item) => item.status === "draft").length,
      submitted: items.filter((item) => item.status === "submitted").length,
      locked: items.filter((item) => item.status === "locked").length,
      hidden: items.filter((item) => item.status === "hidden").length,
      publicVisible: items.filter((item) => item.visibility === "public" && item.publishedAt).length,
    },
    items,
  };
}

function buildJudgingProjection(context: ProjectionContext) {
  const assignmentIds = new Set(context.judgeAssignments.map((row) => row.id));
  const workById = new Map(context.works.map((row) => [row.id, row]));
  const records = context.judgingRecords.filter((row) => assignmentIds.has(row.judge_assignment_id));
  const items = context.judgeAssignments.map((assignment) => {
    const work = workById.get(assignment.work_id) || null;
    const record = records.find((row) => row.judge_assignment_id === assignment.id) || null;
    return {
      assignmentId: assignment.id,
      workId: assignment.work_id,
      workTitle: work?.title || "未知作品",
      judgeUserId: assignment.judge_user_id,
      status: record?.status || "pending",
      scoreResult: record?.score_result ?? null,
      scoreRiding: record?.score_riding ?? null,
      submittedAt: record?.submitted_at ?? null,
      assignedAt: assignment.assigned_at,
    };
  });

  const submittedCount = items.filter((item) => item.status === "submitted").length;
  return {
    race: toRaceSummary(context.race),
    counts: {
      assignments: items.length,
      submitted: submittedCount,
      pending: items.filter((item) => item.status === "pending").length,
      draft: items.filter((item) => item.status === "draft").length,
      completionRate: items.length === 0 ? 0 : Number(((submittedCount / items.length) * 100).toFixed(1)),
    },
    items,
  };
}

function buildCurrentLeaderboardProjection(context: ProjectionContext) {
  const workByRegistrationId = new Map(context.works.map((row) => [row.registration_id, row]));
  const raceProjectByRegistrationId = new Map(context.raceProjects.map((row) => [row.registration_id, row]));
  const assignmentByWorkId = new Map<string, JudgeAssignment[]>();
  const recordByAssignmentId = new Map(context.judgingRecords.map((row) => [row.judge_assignment_id, row]));

  for (const assignment of context.judgeAssignments) {
    const current = assignmentByWorkId.get(assignment.work_id) || [];
    current.push(assignment);
    assignmentByWorkId.set(assignment.work_id, current);
  }

  const items = context.registrations
    .filter((registration) => registration.status === "approved")
    .map((registration) => {
      const work = workByRegistrationId.get(registration.id) || null;
      const raceProject = raceProjectByRegistrationId.get(registration.id) || null;
      const metrics = summarizeRegistrationMetrics(context, registration.id, raceProject?.id || null);
      const assignments = work ? assignmentByWorkId.get(work.id) || [] : [];
      const submittedRecords = assignments
        .map((assignment) => recordByAssignmentId.get(assignment.id))
        .filter((record): record is JudgingRecord => Boolean(record && record.status === "submitted"));

      const reviewAverage = submittedRecords.length === 0
        ? 0
        : submittedRecords.reduce((sum, record) => sum + Number(record.score_result || 0) + Number(record.score_riding || 0), 0) / (submittedRecords.length * 2);
      const processScore = Number((
        reviewAverage
        + (work?.status === "submitted" || work?.status === "locked" ? 6 : 0)
        + (raceProject?.aggregate_ingestion_status === "active" ? 4 : 0)
        + Math.min(metrics.sessionCount, 12) * 0.5
      ).toFixed(1));

      return {
        registrationId: registration.id,
        userId: registration.user_id,
        workId: work?.id || null,
        workTitle: work?.title || "待提交作品",
        processScore,
        reviewAverage: Number(reviewAverage.toFixed(1)),
        sessionCount: metrics.sessionCount,
        aggregateIngestionStatus: raceProject?.aggregate_ingestion_status || "missing",
      };
    })
    .sort((a, b) => b.processScore - a.processScore || b.reviewAverage - a.reviewAverage || a.registrationId.localeCompare(b.registrationId))
    .map((item, index) => ({
      rank: index + 1,
      ...item,
    }));

  return {
    race: toRaceSummary(context.race),
    note: "这是过程榜单，帮助观看正在发生的 Agent Riding，不等同最终 Award。",
    items,
  };
}

function buildScreenFeedProjection(context: ProjectionContext) {
  const raceProgress = buildRaceProgress(context);
  const currentLeaderboard = buildCurrentLeaderboardProjection(context);
  const finalLeaderboard = buildLeaderboardReadModel(context);
  const publicWorks = context.works
    .filter((work) => work.visibility === "public" && work.published_at)
    .slice()
    .sort((a, b) => compareTimestamps(b.published_at, a.published_at))
    .slice(0, 6);
  const announcements = context.announcements
    .filter((row) => row.visibility === "public" && row.published_at)
    .slice()
    .sort((a, b) => compareTimestamps(b.published_at, a.published_at))
    .slice(0, 6);

  const items = [
    buildScreenFeedItem({
      id: `${context.race.id}-live`,
      feedItemType: "live_metrics",
      mode: "live",
      title: `${context.race.title} / Live`,
      order: 10,
      durationMs: 12000,
      recommendedDisplayMode: "live",
      fallbackPriority: 1,
      data: raceProgress,
    }),
    buildScreenFeedItem({
      id: `${context.race.id}-process-leaderboard`,
      feedItemType: "process_leaderboard",
      mode: "leaderboard",
      title: "过程榜单",
      order: 20,
      durationMs: 10000,
      recommendedDisplayMode: "leaderboard",
      fallbackPriority: 3,
      data: currentLeaderboard,
    }),
    buildScreenFeedItem({
      id: `${context.race.id}-final-leaderboard`,
      feedItemType: "final_leaderboard",
      mode: "leaderboard",
      title: "最终榜单",
      order: 30,
      durationMs: 10000,
      recommendedDisplayMode: "leaderboard",
      fallbackPriority: 2,
      data: finalLeaderboard,
    }),
    ...publicWorks.map((work, index) => buildScreenFeedItem({
      id: work.id,
      feedItemType: "work_highlight",
      mode: "works",
      title: work.title,
      order: 40 + index,
      durationMs: 8000,
      recommendedDisplayMode: "works",
      fallbackPriority: 4,
      data: {
        workId: work.id,
        slug: work.slug,
        summary: work.summary,
        publishedAt: work.published_at,
      },
    })),
    ...announcements.map((announcement, index) => buildScreenFeedItem({
      id: announcement.id,
      feedItemType: "announcement",
      mode: "announcement",
      title: announcement.title,
      order: 60 + index,
      durationMs: 9000,
      recommendedDisplayMode: "announcement",
      fallbackPriority: 1,
      data: {
        body: announcement.body,
        publishedAt: announcement.published_at,
      },
    })),
  ].sort(compareScreenFeedItems);

  return {
    race: toRaceSummary(context.race),
    protocol: buildScreenFeedProtocol(items),
    items,
  };
}

function buildLeaderboardReadModel(context: ProjectionContext) {
  const groups = new Map<string, Array<{
    awardId: string;
    registrationId: string;
    workId: string | null;
    rank: number;
    decisionReason: string;
    publishedAt: string | null;
  }>>();

  context.awards
    .filter((award) => award.status === "published" && award.visibility === "public")
    .forEach((award) => {
      const current = groups.get(award.award_name) || [];
      current.push({
        awardId: award.id,
        registrationId: award.registration_id,
        workId: award.work_id,
        rank: award.rank,
        decisionReason: award.decision_reason,
        publishedAt: award.published_at,
      });
      groups.set(award.award_name, current);
    });

  return {
    race: toRaceSummary(context.race),
    groups: Array.from(groups.entries()).map(([awardName, items]) => ({
      awardName,
      items: items.sort((a, b) => a.rank - b.rank),
    })),
  };
}

function buildResultsPageReadModel(context: ProjectionContext) {
  const leaderboard = buildLeaderboardReadModel(context);
  const publishedAwards = context.awards
    .filter((award) => award.status === "published" && award.visibility === "public")
    .slice()
    .sort((a, b) => a.award_name.localeCompare(b.award_name) || a.rank - b.rank);
  const winningWorks = buildWinningWorks(context, publishedAwards);
  const publishedReview = getPublishedReport(context, "review_summary");

  return {
    race: toRaceSummary(context.race),
    boundaries: {
      finalResultsSource: "Award + leaderboard_read_model",
      processLeaderboardExcluded: true,
      reviewSummarySource: "review_summary report",
    },
    leaderboard,
    awards: publishedAwards.map((award) => ({
      awardId: award.id,
      awardName: award.award_name,
      rank: award.rank,
      registrationId: award.registration_id,
      workId: award.work_id,
      decisionReason: award.decision_reason,
      publishedAt: award.published_at,
    })),
    winningWorks,
    review: {
      available: Boolean(publishedReview),
      report: publishedReview
        ? {
            reportId: publishedReview.id,
            title: publishedReview.title || "Review Summary",
            summary: publishedReview.summary || "",
            publishedAt: publishedReview.published_at || null,
          }
        : null,
      message: publishedReview
        ? "评审总结已发布，可进入 Review 页面查看。"
        : "评审总结尚未发布；当前 Results 仅展示 Award 与最终榜单。",
    },
  };
}

function buildReviewSummaryReadModel(context: ProjectionContext) {
  const publishedReview = getPublishedReport(context, "review_summary");
  const publishedAwards = context.awards
    .filter((award) => award.status === "published" && award.visibility === "public")
    .slice()
    .sort((a, b) => a.award_name.localeCompare(b.award_name) || a.rank - b.rank);

  return {
    race: toRaceSummary(context.race),
    report: {
      available: Boolean(publishedReview),
      source: "review_summary report",
      report: publishedReview
        ? {
            reportId: publishedReview.id,
            title: publishedReview.title || "Review Summary",
            summary: publishedReview.summary || "",
            bodyMarkdown: publishedReview.body_markdown || "",
            publishedAt: publishedReview.published_at || null,
          }
        : null,
      message: publishedReview
        ? "当前页面展示的是已发布的 review_summary。"
        : "review_summary 尚未发布；当前先回退展示 Award、Winning Works 和最终榜单入口。",
    },
    awards: publishedAwards.map((award) => ({
      awardId: award.id,
      awardName: award.award_name,
      rank: award.rank,
      registrationId: award.registration_id,
      workId: award.work_id,
      decisionReason: award.decision_reason,
      publishedAt: award.published_at,
    })),
    winningWorks: buildWinningWorks(context, publishedAwards),
    nextEntries: {
      resultsPath: `/races/${context.race.slug}/results`,
      worksPath: `/works?raceSlug=${context.race.slug}`,
    },
  };
}

function buildStaticFallbackRow(race: Race, type: ProjectionType, reason: string): ProjectionRow {
  const context = buildContext(race);
  return {
    id: `static-fallback:${race.id}:${type}`,
    race_id: race.id,
    type,
    status: "failed",
    data: buildStaticFallbackData(type, context),
    generated_at: null,
    last_attempted_at: new Date().toISOString(),
    last_error: reason,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function buildStaticFallbackData(type: ProjectionType, context: ProjectionContext) {
  if (type === "race_progress") return buildStaticRaceProgress(context);
  if (type === "registration_status") return buildStaticRegistrationStatus(context);
  if (type === "cost") return buildStaticCostProjection(context);
  if (type === "risk") return buildStaticRiskProjection(context);
  if (type === "submission") return buildSubmissionProjection(context);
  if (type === "judging") return buildJudgingProjection(context);
  if (type === "current_leaderboard") return buildStaticCurrentLeaderboard(context);
  return buildStaticScreenFeedProjection(context);
}

function buildEventStream(context: ProjectionContext) {
  const events: Array<{
    id: string;
    time: string;
    type: string;
    text: string;
  }> = [];

  for (const session of getSessionsForRace(context)) {
    events.push({
      id: session.id,
      time: session.accepted_at || session.created_at,
      type: "session",
      text: `接收新会话：${session.id.slice(0, 8)}，累计 ${session.tool_call_count} 次工具调用。`,
    });
  }

  for (const work of context.works) {
    if (work.submitted_at) {
      events.push({
        id: `${work.id}-submitted`,
        time: work.submitted_at,
        type: "submission",
        text: `作品《${work.title}》进入提交流程。`,
      });
    }
    if (work.published_at) {
      events.push({
        id: `${work.id}-published`,
        time: work.published_at,
        type: "work",
        text: `公开作品《${work.title}》已发布。`,
      });
    }
  }

  for (const announcement of context.announcements) {
    if (announcement.visibility === "public" && announcement.published_at) {
      events.push({
        id: announcement.id,
        time: announcement.published_at,
        type: "announcement",
        text: `公告：${announcement.title}`,
      });
    }
  }

  for (const award of context.awards) {
    if (award.status === "published" && award.visibility === "public" && award.published_at) {
      events.push({
        id: award.id,
        time: award.published_at,
        type: "award",
        text: `${award.award_name} 第 ${award.rank} 名已公布。`,
      });
    }
  }

  for (const raceProject of context.raceProjects.filter((row) => row.aggregate_ingestion_status === "failed")) {
    events.push({
      id: `${raceProject.id}-risk`,
      time: raceProject.updated_at,
      type: "risk",
      text: `RaceProject ${raceProject.id} 的 CA 聚合状态为 failed。`,
    });
  }

  return events
    .sort((a, b) => compareTimestamps(b.time, a.time))
    .slice(0, 12);
}

function buildStaticRaceProgress(context: ProjectionContext) {
  const publicWorks = context.works.filter((row) => row.visibility === "public" && row.published_at);
  const publishedAwards = context.awards.filter((row) => row.status === "published" && row.visibility === "public");
  const publicAnnouncements = context.announcements.filter((row) => row.visibility === "public" && row.published_at);

  return {
    race: toRaceSummary(context.race),
    stageLabel: `${formatRaceStage(context.race.status)} / Static Fallback`,
    headline: "实时 Projection 不可用，当前展示静态赛事状态、公告与公开资产入口。",
    counts: {
      registrationsTotal: context.registrations.length,
      approvedRegistrations: context.registrations.filter((row) => row.status === "approved").length,
      worksSubmitted: context.works.filter((row) => row.status === "submitted" || row.status === "locked").length,
      worksPublished: publicWorks.length,
      judgingSubmitted: context.judgingRecords.filter((row) => row.status === "submitted").length,
      awardsPublished: publishedAwards.length,
      activeConnections: 0,
      sessionCount: 0,
    },
    totals: {
      tokenCost: 0,
      toolCallCount: 0,
      messageCount: 0,
    },
    eventStream: [
      ...publicAnnouncements.map((announcement) => ({
        id: announcement.id,
        time: announcement.published_at || announcement.created_at,
        type: "announcement",
        text: `静态公告：${announcement.title}`,
      })),
      ...publicWorks.map((work) => ({
        id: `${work.id}-static-work`,
        time: work.published_at || work.updated_at,
        type: "work",
        text: `公开作品《${work.title}》可作为静态展示入口。`,
      })),
      ...publishedAwards.map((award) => ({
        id: `${award.id}-static-award`,
        time: award.published_at || award.updated_at,
        type: "award",
        text: `${award.award_name} 第 ${award.rank} 名可作为静态榜单展示。`,
      })),
    ]
      .sort((a, b) => compareTimestamps(b.time, a.time))
      .slice(0, 12),
    note: "当前为静态 fallback，只展示赛事状态、公告、公开作品与最终榜单入口，不读取原始 Session。",
  };
}

function buildStaticRegistrationStatus(context: ProjectionContext) {
  const raceProjectByRegistrationId = new Map(context.raceProjects.map((row) => [row.registration_id, row]));
  const workByRegistrationId = new Map(context.works.map((row) => [row.registration_id, row]));
  const userById = new Map(context.users.map((row) => [row.id, row]));

  return {
    race: toRaceSummary(context.race),
    registrations: context.registrations.map((registration) => {
      const raceProject = raceProjectByRegistrationId.get(registration.id) || null;
      const work = workByRegistrationId.get(registration.id) || null;
      return {
        registrationId: registration.id,
        userId: registration.user_id,
        riderName: readDisplayName(userById.get(registration.user_id), registration.user_id),
        status: registration.status,
        workStatus: work?.status || "not_created",
        workTitle: work?.title || null,
        raceProjectId: raceProject?.id || null,
        aggregateIngestionStatus: raceProject?.aggregate_ingestion_status || "missing",
        connectionHealth: raceProject?.connection_health || "unknown",
        sessionCount: 0,
        tokenCost: 0,
        toolCallCount: 0,
        lastSyncedAt: raceProject?.last_synced_at || null,
      };
    }),
  };
}

function buildStaticCostProjection(context: ProjectionContext) {
  return {
    race: toRaceSummary(context.race),
    totals: {
      sessionCount: 0,
      tokenCost: 0,
      toolCallCount: 0,
      messageCount: 0,
    },
    byRegistration: context.registrations.map((registration) => ({
      registrationId: registration.id,
      userId: registration.user_id,
      sessionCount: 0,
      tokenCost: 0,
      toolCallCount: 0,
      messageCount: 0,
    })),
  };
}

function buildStaticRiskProjection(context: ProjectionContext) {
  const result = buildRiskProjection(context);
  return {
    ...result,
    note: "当前为静态 fallback，风险项来自 RaceProject / Work 等核心事实，不依赖实时 Session。",
  };
}

function buildStaticCurrentLeaderboard(context: ProjectionContext) {
  const workByRegistrationId = new Map(context.works.map((row) => [row.registration_id, row]));
  const raceProjectByRegistrationId = new Map(context.raceProjects.map((row) => [row.registration_id, row]));
  const assignmentByWorkId = new Map<string, JudgeAssignment[]>();
  const recordByAssignmentId = new Map(context.judgingRecords.map((row) => [row.judge_assignment_id, row]));

  for (const assignment of context.judgeAssignments) {
    const current = assignmentByWorkId.get(assignment.work_id) || [];
    current.push(assignment);
    assignmentByWorkId.set(assignment.work_id, current);
  }

  const items = context.registrations
    .filter((registration) => registration.status === "approved")
    .map((registration) => {
      const work = workByRegistrationId.get(registration.id) || null;
      const raceProject = raceProjectByRegistrationId.get(registration.id) || null;
      const assignments = work ? assignmentByWorkId.get(work.id) || [] : [];
      const submittedRecords = assignments
        .map((assignment) => recordByAssignmentId.get(assignment.id))
        .filter((record): record is JudgingRecord => Boolean(record && record.status === "submitted"));

      const reviewAverage = submittedRecords.length === 0
        ? 0
        : submittedRecords.reduce((sum, record) => sum + Number(record.score_result || 0) + Number(record.score_riding || 0), 0) / (submittedRecords.length * 2);
      const processScore = Number((
        reviewAverage
        + (work?.status === "submitted" || work?.status === "locked" ? 6 : 0)
        + (raceProject?.aggregate_ingestion_status === "active" ? 2 : 0)
      ).toFixed(1));

      return {
        registrationId: registration.id,
        userId: registration.user_id,
        workId: work?.id || null,
        workTitle: work?.title || "待提交作品",
        processScore,
        reviewAverage: Number(reviewAverage.toFixed(1)),
        sessionCount: 0,
        aggregateIngestionStatus: raceProject?.aggregate_ingestion_status || "missing",
      };
    })
    .sort((a, b) => b.processScore - a.processScore || b.reviewAverage - a.reviewAverage || a.registrationId.localeCompare(b.registrationId))
    .map((item, index) => ({
      rank: index + 1,
      ...item,
    }));

  return {
    race: toRaceSummary(context.race),
    note: "当前为静态 fallback，过程榜仅基于已提交作品、评审事实和接入状态的静态摘要。",
    items,
  };
}

function buildStaticScreenFeedProjection(context: ProjectionContext) {
  const raceProgress = buildStaticRaceProgress(context);
  const currentLeaderboard = buildStaticCurrentLeaderboard(context);
  const finalLeaderboard = buildLeaderboardReadModel(context);
  const publicWorks = context.works
    .filter((work) => work.visibility === "public" && work.published_at)
    .slice()
    .sort((a, b) => compareTimestamps(b.published_at, a.published_at))
    .slice(0, 6);
  const announcements = context.announcements
    .filter((row) => row.visibility === "public" && row.published_at)
    .slice()
    .sort((a, b) => compareTimestamps(b.published_at, a.published_at))
    .slice(0, 6);

  const workItems: Array<Omit<ScreenFeedItem, "order" | "durationMs" | "recommendedDisplayMode" | "fallbackPriority">> = publicWorks.length > 0
    ? publicWorks.map((work) => ({
        id: work.id,
        feedItemType: "work_highlight" as const,
        mode: "works" as const,
        title: work.title,
        data: {
          workId: work.id,
          slug: work.slug,
          summary: work.summary,
          publishedAt: work.published_at,
        },
      }))
    : [{
        id: `${context.race.id}-static-work`,
        feedItemType: "work_highlight" as const,
        mode: "works" as const,
        title: "公开作品入口",
        data: {
          workId: null,
          slug: null,
          summary: "当前没有已发布作品，静态 fallback 保留作品入口占位。",
          publishedAt: null,
        },
      }];

  const announcementItems: Array<Omit<ScreenFeedItem, "order" | "durationMs" | "recommendedDisplayMode" | "fallbackPriority">> = announcements.length > 0
    ? announcements.map((announcement) => ({
        id: announcement.id,
        feedItemType: "announcement" as const,
        mode: "announcement" as const,
        title: announcement.title,
        data: {
          body: announcement.body,
          publishedAt: announcement.published_at,
        },
      }))
    : [{
        id: `${context.race.id}-static-announcement`,
        feedItemType: "announcement" as const,
        mode: "announcement" as const,
        title: "静态公告",
        data: {
          body: "实时投影暂不可用，请改看公开作品、最终榜单或赛事公告。",
          publishedAt: null,
        },
      }];

  const items = [
      buildScreenFeedItem({
        id: `${context.race.id}-static-live`,
        feedItemType: "live_metrics",
        mode: "live",
        title: `${context.race.title} / Static Fallback`,
        order: 10,
        durationMs: 12000,
        recommendedDisplayMode: "live",
        fallbackPriority: 2,
        data: raceProgress,
      }),
      buildScreenFeedItem({
        id: `${context.race.id}-static-process-leaderboard`,
        feedItemType: "process_leaderboard",
        mode: "leaderboard",
        title: "静态过程榜单",
        order: 20,
        durationMs: 9000,
        recommendedDisplayMode: "leaderboard",
        fallbackPriority: 3,
        data: currentLeaderboard,
      }),
      buildScreenFeedItem({
        id: `${context.race.id}-static-final-leaderboard`,
        feedItemType: "final_leaderboard",
        mode: "leaderboard",
        title: "静态最终榜单",
        order: 30,
        durationMs: 10000,
        recommendedDisplayMode: "leaderboard",
        fallbackPriority: 1,
        data: finalLeaderboard,
      }),
      ...workItems.map((item, index) => buildScreenFeedItem({
        ...item,
        order: 40 + index,
        durationMs: 8000,
        recommendedDisplayMode: "works",
        fallbackPriority: 4,
      })),
      ...announcementItems.map((item, index) => buildScreenFeedItem({
        ...item,
        order: 60 + index,
        durationMs: 9000,
        recommendedDisplayMode: "announcement",
        fallbackPriority: 1,
      })),
    ].sort(compareScreenFeedItems);

  return {
    race: toRaceSummary(context.race),
    protocol: buildScreenFeedProtocol(items),
    items,
  };
}

function buildScreenFeedItem<T = unknown>(item: {
} & ScreenFeedItem<T>) {
  return item;
}

function compareScreenFeedItems(
  a: ScreenFeedItem,
  b: ScreenFeedItem,
) {
  return a.order - b.order || a.fallbackPriority - b.fallbackPriority || a.title.localeCompare(b.title);
}

function buildScreenFeedProtocol(items: ScreenFeedItem[]) {
  const modeOrder: Array<"live" | "leaderboard" | "works" | "announcement"> = ["live", "leaderboard", "works", "announcement"];
  const availableModes = modeOrder.filter((mode) => items.some((item) => item.mode === mode));
  return {
    defaultDisplayMode: availableModes[0] || "live",
    availableModes,
    autoRotate: items.length > 1,
    recommendedRotationOrder: items.map((item) => item.id),
  };
}

function buildWinningWorks(context: ProjectionContext, publishedAwards: Award[]) {
  const workById = new Map(context.works.map((work) => [work.id, work]));
  const seen = new Set<string>();
  const items: Array<{
    workId: string;
    title: string;
    slug: string;
    summary: string;
    publishedAt: string | null;
    awardNames: string[];
  }> = [];

  for (const award of publishedAwards) {
    if (!award.work_id) continue;
    const work = workById.get(award.work_id);
    if (!work || work.visibility !== "public" || !work.published_at) continue;
    if (!seen.has(work.id)) {
      seen.add(work.id);
      items.push({
        workId: work.id,
        title: work.title,
        slug: work.slug,
        summary: work.summary,
        publishedAt: work.published_at,
        awardNames: [award.award_name],
      });
      continue;
    }
    const current = items.find((item) => item.workId === work.id);
    if (current && !current.awardNames.includes(award.award_name)) current.awardNames.push(award.award_name);
  }

  return items.sort((a, b) => compareTimestamps(b.publishedAt, a.publishedAt));
}

function getPublishedReport(context: ProjectionContext, reportType: ReportRow["report_type"]) {
  return context.reports
    .filter((report) => report.report_type === reportType && report.status === "published" && report.visibility === "public" && report.published_at)
    .sort((a, b) => compareTimestamps(b.published_at, a.published_at))[0] || null;
}

function summarizeMetrics(context: ProjectionContext) {
  const sessions = getSessionsForRace(context);
  return {
    sessionCount: sessions.length,
    tokenCost: sessions.reduce((sum: number, row: SessionRow) => sum + Number(row.token_cost || 0), 0),
    toolCallCount: sessions.reduce((sum: number, row: SessionRow) => sum + Number(row.tool_call_count || 0), 0),
    messageCount: sessions.reduce((sum: number, row: SessionRow) => sum + Number(row.message_count || 0), 0),
    activeConnections: getConnectionsForRace(context).filter((connection: CAConnection) => connection.ingestion_status === "active" && !connection.disabled_at).length,
  };
}

function summarizeRegistrationMetrics(context: ProjectionContext, registrationId: string, raceProjectId: string | null) {
  if (!raceProjectId) {
    return { sessionCount: 0, tokenCost: 0, toolCallCount: 0, messageCount: 0 };
  }

  const sessions = getSessionsForRace(context).filter((row: SessionRow) => row.race_project_id === raceProjectId);
  return {
    sessionCount: sessions.length,
    tokenCost: sessions.reduce((sum: number, row: SessionRow) => sum + Number(row.token_cost || 0), 0),
    toolCallCount: sessions.reduce((sum: number, row: SessionRow) => sum + Number(row.tool_call_count || 0), 0),
    messageCount: sessions.reduce((sum: number, row: SessionRow) => sum + Number(row.message_count || 0), 0),
  };
}

function toRaceSummary(race: Race) {
  return {
    id: race.id,
    slug: race.slug,
    title: race.title,
    status: race.status,
    visibility: race.visibility,
  };
}

function buildRaceHeadline(status: string, metrics: ReturnType<typeof summarizeMetrics>) {
  if (status === "running") return `当前已累计 ${metrics.sessionCount} 个有效 Session，赛事过程持续更新中。`;
  if (status === "submitting") return `提交窗口已开启，当前记录到 ${metrics.toolCallCount} 次工具调用。`;
  if (status === "judging") return `评审进行中，过程数据保留为可追溯投影。`;
  if (status === "completed") return "赛事已结束，过程投影保留供复盘，大屏可回退到稳定版本。";
  return "赛事过程投影已就绪，可用于 Live Hall 与大屏展示。";
}

function formatRaceStage(status: string) {
  const labels: Record<string, string> = {
    draft: "草稿",
    published: "已发布",
    registration: "报名中",
    running: "进行中",
    submitting: "提交中",
    judging: "评审中",
    completed: "已结束",
    archived: "已归档",
  };
  return labels[status] || status;
}

function upsertProjection(raceId: string, type: ProjectionType, data: unknown, timestamp: string): ProjectionRow {
  const existing = findProjection(raceId, type);
  if (!existing) {
    const row: ProjectionRow = {
      id: uuid(),
      race_id: raceId,
      type,
      status: "ready",
      data,
      generated_at: timestamp,
      last_attempted_at: timestamp,
      last_error: null,
      created_at: timestamp,
      updated_at: timestamp,
    };
    insert("projections", row);
    return row;
  }

  const updated = update<ProjectionRow>("projections", existing.id, {
    status: "ready",
    data,
    generated_at: timestamp,
    last_attempted_at: timestamp,
    last_error: null,
    updated_at: timestamp,
  });
  return updated || { ...existing, status: "ready", data, generated_at: timestamp, last_attempted_at: timestamp, last_error: null, updated_at: timestamp };
}

function markProjectionFailed(raceId: string, type: ProjectionType, message: string, timestamp: string): ProjectionRow {
  const existing = findProjection(raceId, type);
  if (!existing) {
    const row: ProjectionRow = {
      id: uuid(),
      race_id: raceId,
      type,
      status: "failed",
      data: {},
      generated_at: null,
      last_attempted_at: timestamp,
      last_error: message,
      created_at: timestamp,
      updated_at: timestamp,
    };
    insert("projections", row);
    return row;
  }

  const updated = update<ProjectionRow>("projections", existing.id, {
    status: "failed",
    last_attempted_at: timestamp,
    last_error: message,
    updated_at: timestamp,
  });
  return updated || { ...existing, status: "failed", last_attempted_at: timestamp, last_error: message, updated_at: timestamp };
}

function findProjection(raceId: string, type: ProjectionType): ProjectionRow | null {
  return findAll<ProjectionRow>("projections").find((row) => row.race_id === raceId && row.type === type) || null;
}

function toProjectionResponse(result: ProjectionReadResult) {
  const row = result.row;
  const descriptor = PROJECTION_DESCRIPTORS[row.type];
  return {
    contractVersion: CONTRACT_VERSION,
    raceId: row.race_id,
    type: row.type,
    readKind: descriptor.readKind,
    sourceOfTruth: descriptor.sourceOfTruth,
    consumerBoundary: descriptor.consumerBoundary,
    status: row.status,
    generatedAt: row.generated_at,
    lastAttemptedAt: row.last_attempted_at,
    lastError: row.last_error,
    readMode: result.mode,
    usingStableFallback: result.mode === "stable_fallback",
    usingStaticFallback: result.mode === "static_fallback",
    fallbackReason: result.fallbackReason,
    fallback: {
      mode: result.mode,
      active: result.mode !== "live",
      code: toFallbackCode(result.mode),
      reason: result.fallbackReason,
    },
    data: row.data,
  };
}

function inspectProjectionStatus(race: Race, type: ProjectionType) {
  const descriptor = PROJECTION_DESCRIPTORS[type];
  const row = findProjection(race.id, type);

  if (!row) {
    return {
      type,
      readKind: descriptor.readKind,
      sourceOfTruth: descriptor.sourceOfTruth,
      consumerBoundary: descriptor.consumerBoundary,
      storageStatus: "missing" as const,
      effectiveReadMode: "not_built" as const,
      fallbackCode: "none" as const,
      fallbackActive: false,
      serveReady: false,
      publicReadable: isPublicRace(race),
      lastSuccessfulAt: null,
      lastAttemptedAt: null,
      lastError: null,
    };
  }

  const effectiveReadMode: StatusReadMode = row.status === "ready"
    ? "live"
    : row.generated_at
      ? "stable_fallback"
      : "static_fallback";

  return {
    type,
    readKind: descriptor.readKind,
    sourceOfTruth: descriptor.sourceOfTruth,
    consumerBoundary: descriptor.consumerBoundary,
    storageStatus: row.status,
    effectiveReadMode,
    fallbackCode: toFallbackCode(effectiveReadMode),
    fallbackActive: effectiveReadMode !== "live",
    serveReady: true,
    publicReadable: isPublicRace(race),
    lastSuccessfulAt: row.generated_at,
    lastAttemptedAt: row.last_attempted_at,
    lastError: row.last_error,
  };
}

function inspectReadModelStatus(race: Race, context: ProjectionContext, type: ReadModelType) {
  const descriptor = READ_MODEL_DESCRIPTORS[type];
  if (type === "leaderboard_read_model") {
    const data = buildLeaderboardReadModel(context);
    return {
      type,
      readKind: descriptor.readKind,
      sourceOfTruth: descriptor.sourceOfTruth,
      consumerBoundary: descriptor.consumerBoundary,
      available: data.groups.length > 0,
      serveReady: data.groups.length > 0,
      publicReadable: isPublicRace(race),
      generatedAt: newestTimestamp(data.groups.flatMap((group) => group.items.map((item) => item.publishedAt || "")).filter(Boolean)),
      note: data.groups.length > 0 ? "已可读取最终榜单。" : "当前没有已发布 Award，最终榜单为空。",
    };
  }
  if (type === "results_page_read_model") {
    const data = buildResultsPageReadModel(context);
    return {
      type,
      readKind: descriptor.readKind,
      sourceOfTruth: descriptor.sourceOfTruth,
      consumerBoundary: descriptor.consumerBoundary,
      available: data.leaderboard.groups.length > 0 || data.winningWorks.length > 0 || data.review.available,
      serveReady: data.leaderboard.groups.length > 0 || data.winningWorks.length > 0 || data.review.available,
      publicReadable: isPublicRace(race),
      generatedAt: newestTimestamp([
        data.review.report?.publishedAt || "",
        ...data.winningWorks.map((work) => work.publishedAt || ""),
        ...data.leaderboard.groups.flatMap((group) => group.items.map((item) => item.publishedAt || "")),
      ].filter(Boolean)),
      note: data.review.message,
    };
  }
  const data = buildReviewSummaryReadModel(context);
  return {
    type,
    readKind: descriptor.readKind,
    sourceOfTruth: descriptor.sourceOfTruth,
    consumerBoundary: descriptor.consumerBoundary,
    available: data.report.available || data.awards.length > 0 || data.winningWorks.length > 0,
    serveReady: data.report.available || data.awards.length > 0 || data.winningWorks.length > 0,
    publicReadable: isPublicRace(race),
    generatedAt: data.report.report?.publishedAt || newestTimestamp(data.winningWorks.map((work) => work.publishedAt || "").filter(Boolean)),
    note: data.report.message,
  };
}

function buildProjectionStatusSummary(
  race: Race,
  projections: Array<ReturnType<typeof inspectProjectionStatus>>,
  readModels: Array<ReturnType<typeof inspectReadModelStatus>>,
) {
  const readyCount = projections.filter((item) => item.storageStatus === "ready").length;
  const liveCount = projections.filter((item) => item.effectiveReadMode === "live").length;
  const stableFallbackCount = projections.filter((item) => item.effectiveReadMode === "stable_fallback").length;
  const staticFallbackCount = projections.filter((item) => item.effectiveReadMode === "static_fallback").length;
  const notBuiltCount = projections.filter((item) => item.effectiveReadMode === "not_built").length;
  const serveReadyCount = projections.filter((item) => item.serveReady).length;
  const readModelReadyCount = readModels.filter((item) => item.serveReady).length;
  const screenFeed = projections.find((item) => item.type === "screen_feed");

  return {
    projectionCount: projections.length,
    readyCount,
    liveCount,
    stableFallbackCount,
    staticFallbackCount,
    notBuiltCount,
    modeCounts: {
      live: liveCount,
      stableFallback: stableFallbackCount,
      staticFallback: staticFallbackCount,
      notBuilt: notBuiltCount,
    },
    readModelCount: readModels.length,
    readModelReadyCount,
    serveReadyCount,
    serveReadiness: deriveServeReadiness(projections),
    publicReadable: isPublicRace(race),
    screenReady: Boolean(screenFeed?.serveReady),
    screenServeMode: screenFeed?.effectiveReadMode || "not_built",
    latestSuccessfulAt: newestTimestamp([
      ...projections.map((item) => item.lastSuccessfulAt || ""),
      ...readModels.map((item) => item.generatedAt || ""),
    ].filter(Boolean)),
    latestAttemptedAt: newestTimestamp(projections.map((item) => item.lastAttemptedAt || "").filter(Boolean)),
    lastSuccessfulByType: Object.fromEntries([
      ...projections.map((item) => [item.type, item.lastSuccessfulAt || null]),
      ...readModels.map((item) => [item.type, item.generatedAt || null]),
    ]),
  };
}

function deriveServeReadiness(projections: Array<ReturnType<typeof inspectProjectionStatus>>): ServeReadiness {
  const serveReadyCount = projections.filter((item) => item.serveReady).length;
  if (serveReadyCount === 0) return "not_ready";
  if (projections.every((item) => item.effectiveReadMode === "live")) return "live";
  if (projections.every((item) => item.serveReady)) return "degraded";
  return "partial";
}

function toReadModelResponse<T>(raceId: string, type: ReadModelType, generatedAt: string, data: T) {
  const descriptor = READ_MODEL_DESCRIPTORS[type];
  return {
    contractVersion: CONTRACT_VERSION,
    raceId,
    type,
    readKind: descriptor.readKind,
    sourceOfTruth: descriptor.sourceOfTruth,
    consumerBoundary: descriptor.consumerBoundary,
    generatedAt,
    readMode: "live" as const,
    usingStableFallback: false,
    usingStaticFallback: false,
    fallbackReason: null,
    fallback: {
      mode: "live" as const,
      active: false,
      code: "none" as const,
      reason: null,
    },
    data,
  };
}

function toFallbackCode(mode: ReadMode): FallbackCode {
  if (mode === "stable_fallback") return "projection_failed_uses_stable";
  if (mode === "static_fallback") return "projection_failed_uses_static";
  return "none";
}

function isPublicRace(race: Pick<Race, "visibility">) {
  return race.visibility === "public";
}

function resolveRace(value: string): Race | null {
  return findById<Race>("races", value) || findBy<Race>("races", "slug", value);
}

function parseStringArray(value: string[] | string | null | undefined) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function readDisplayName(user: UserRow | undefined, fallback: string) {
  if (!user) return fallback;
  return user.displayName || user.display_name || user.githubAccount || user.github_account || fallback;
}

function compareTimestamps(a: string | null | undefined, b: string | null | undefined) {
  return (a || "").localeCompare(b || "");
}

function newestTimestamp(values: string[]) {
  return values.slice().sort((a, b) => compareTimestamps(b, a))[0] || null;
}

function isProjectionType(value: string): value is ProjectionType {
  return PROJECTION_TYPES.includes(value as ProjectionType);
}

function getSessionsForRace(context: ProjectionContext): SessionRow[] {
  const raceProjectIds = new Set(context.raceProjects.map((row) => row.id));
  const connectionIds = new Set(
    context.caConnections
      .filter((row) => raceProjectIds.has(row.race_project_id))
      .map((row) => row.id),
  );
  return context.sessions.filter((row) => raceProjectIds.has(row.race_project_id) || connectionIds.has(row.ca_connection_id));
}

function getConnectionsForRace(context: ProjectionContext): CAConnection[] {
  const raceProjectIds = new Set(context.raceProjects.map((row) => row.id));
  return context.caConnections.filter((row) => raceProjectIds.has(row.race_project_id));
}

import type { Express, Request, Response } from "express";
import { Router } from "express";
import { v4 as uuid } from "uuid";
import { findAll, findById, insert, update } from "../../db.js";
import { authorize, getCurrentUser, requireLogin } from "../../shared/auth.js";

type ReportType = "rider_report" | "race_report" | "review_summary";
type ReportStatus = "draft" | "generated" | "reviewed" | "published";
type Visibility = "private" | "public";

interface Report {
  id: string;
  race_id: string;
  type: ReportType;
  subject_registration_id: string | null;
  status: ReportStatus;
  visibility: Visibility;
  title: string;
  summary: string;
  body: string;
  sections: ReportSection[];
  cited_evidence_ids: string[];
  cited_award_ids: string[];
  source_counts: Record<string, number>;
  generated_at: string;
  published_at: string | null;
  created_by_user_id: string;
  updated_by_user_id: string;
  created_at: string;
  updated_at: string;
}

interface ReportSection {
  heading: string;
  body: string;
}

interface GeneratedReportContent {
  title: string;
  summary: string;
  body: string;
  sections: ReportSection[];
  citedEvidenceIds: string[];
  citedAwardIds: string[];
  sourceCounts: Record<string, number>;
}

type GeneratedReportDraft = Omit<GeneratedReportContent, "body">;

const REPORT_TYPES: ReportType[] = ["rider_report", "race_report", "review_summary"];

export function registerReportGenRoutes(app: Express): void {
  const router = Router();

  router.get("/", (req: Request, res: Response) => {
    const reports = findAll<Report>("reports");
    const currentUser = getCurrentUser(req);
    const raceId = asOptionalString(req.query.raceId);
    const raceSlug = asOptionalString(req.query.raceSlug);
    const type = asOptionalString(req.query.type) as ReportType | undefined;

    const filtered = reports
      .filter(report => !raceId || report.race_id === raceId)
      .filter(report => !raceSlug || getRaceSlug(report.race_id) === raceSlug)
      .filter(report => !type || report.type === type)
      .filter(report => canReadReport(report, currentUser))
      .sort((a, b) => b.updated_at.localeCompare(a.updated_at));

    res.json(filtered.map(toReportResponse));
  });

  router.post("/generate", requireLogin, (req: Request, res: Response) => {
    const user = getCurrentUser(req);
    if (!user) { res.status(401).json({ error: "Not authenticated" }); return; }

    const { raceId, type, subjectRegistrationId } = req.body;
    if (!raceId || typeof raceId !== "string") {
      res.status(400).json({ error: "raceId is required" }); return;
    }
    if (!REPORT_TYPES.includes(type)) {
      res.status(400).json({ error: "type must be rider_report, race_report, or review_summary" }); return;
    }

    const race = findById<any>("races", raceId);
    if (!race) { res.status(404).json({ error: "Race not found" }); return; }

    const validation = validateSubject(type, subjectRegistrationId, raceId);
    if (!validation.ok) { res.status(400).json({ error: validation.error }); return; }

    const auth = authorize(user, "Report", "generate", {
      raceOrganizerIds: getRaceOrganizerIds(race),
    });
    if (!auth.allowed) { res.status(403).json({ error: auth.reason }); return; }

    const now = new Date().toISOString();
    const content = buildReportContent(type, race, validation.subjectRegistrationId);
    const report: Report = {
      id: uuid(),
      race_id: raceId,
      type,
      subject_registration_id: validation.subjectRegistrationId,
      status: "generated",
      visibility: "private",
      title: content.title,
      summary: content.summary,
      body: content.body,
      sections: content.sections,
      cited_evidence_ids: content.citedEvidenceIds,
      cited_award_ids: content.citedAwardIds,
      source_counts: content.sourceCounts,
      generated_at: now,
      published_at: null,
      created_by_user_id: user.userId,
      updated_by_user_id: user.userId,
      created_at: now,
      updated_at: now,
    };

    insert("reports", report);
    res.status(201).json(toReportResponse(report));
  });

  router.get("/:id", (req: Request, res: Response) => {
    const report = findById<Report>("reports", req.params.id);
    if (!report) { res.status(404).json({ error: "Report not found" }); return; }

    const user = getCurrentUser(req);
    if (!canReadReport(report, user)) {
      res.status(user ? 403 : 401).json({ error: user ? "Not allowed to view this report" : "Login required" });
      return;
    }

    res.json(toReportResponse(report));
  });

  router.patch("/:id", requireLogin, (req: Request, res: Response) => {
    const user = getCurrentUser(req);
    if (!user) { res.status(401).json({ error: "Not authenticated" }); return; }

    const report = findById<Report>("reports", req.params.id);
    if (!report) { res.status(404).json({ error: "Report not found" }); return; }

    const race = findById<any>("races", report.race_id);
    const auth = authorize(user, "Report", "edit", { raceOrganizerIds: getRaceOrganizerIds(race) });
    if (!auth.allowed) { res.status(403).json({ error: auth.reason }); return; }
    if (report.status === "published") {
      res.status(409).json({ error: "Published reports cannot be edited" }); return;
    }

    const updates: Partial<Report> = {
      updated_by_user_id: user.userId,
      updated_at: new Date().toISOString(),
    };
    if (typeof req.body.title === "string") updates.title = req.body.title;
    if (typeof req.body.summary === "string") updates.summary = req.body.summary;
    if (typeof req.body.body === "string") updates.body = req.body.body;
    if (Array.isArray(req.body.sections)) updates.sections = req.body.sections;
    if (req.body.status === "draft" || req.body.status === "generated" || req.body.status === "reviewed") {
      updates.status = req.body.status;
    }

    const updated = update<Report>("reports", report.id, updates);
    res.json(toReportResponse(updated!));
  });

  router.post("/:id/publish", requireLogin, (req: Request, res: Response) => {
    const user = getCurrentUser(req);
    if (!user) { res.status(401).json({ error: "Not authenticated" }); return; }

    const report = findById<Report>("reports", req.params.id);
    if (!report) { res.status(404).json({ error: "Report not found" }); return; }

    const race = findById<any>("races", report.race_id);
    const auth = authorize(user, "Report", "publish", { raceOrganizerIds: getRaceOrganizerIds(race) });
    if (!auth.allowed) { res.status(403).json({ error: auth.reason }); return; }

    const now = new Date().toISOString();
    const visibility: Visibility = report.type === "rider_report" ? "private" : "public";
    const updated = update<Report>("reports", report.id, {
      status: "published",
      visibility,
      published_at: now,
      updated_by_user_id: user.userId,
      updated_at: now,
    });

    res.json(toReportResponse(updated!));
  });

  app.use("/reports", router);
  console.log("[report-gen] Routes registered: /reports/*");
}

function validateSubject(type: ReportType, rawSubjectRegistrationId: unknown, raceId: string) {
  if (type === "rider_report") {
    if (!rawSubjectRegistrationId || typeof rawSubjectRegistrationId !== "string") {
      return { ok: false as const, error: "subjectRegistrationId is required for rider_report" };
    }
    const registration = findById<any>("registrations", rawSubjectRegistrationId);
    if (!registration) return { ok: false as const, error: "Subject registration not found" };
    if (getField(registration, "race_id", "raceId") !== raceId) {
      return { ok: false as const, error: "subjectRegistrationId must belong to raceId" };
    }
    return { ok: true as const, subjectRegistrationId: rawSubjectRegistrationId };
  }

  if (rawSubjectRegistrationId) {
    return { ok: false as const, error: "subjectRegistrationId must be empty for race_report and review_summary" };
  }
  return { ok: true as const, subjectRegistrationId: null };
}

function canReadReport(report: Report, user: ReturnType<typeof getCurrentUser>): boolean {
  if (report.status === "published" && report.visibility === "public" && report.type !== "rider_report") {
    const publicAuth = authorize(null, "Report", "view_public_published", {
      visibility: "public",
      isPublished: true,
    });
    if (publicAuth.allowed) return true;
  }

  if (!user) return false;
  if (user.roles.includes("admin")) return true;

  const race = findById<any>("races", report.race_id);
  const managed = authorize(user, "Report", "edit", { raceOrganizerIds: getRaceOrganizerIds(race) });
  if (managed.allowed) return true;

  if (report.type !== "rider_report" || !report.subject_registration_id) return false;
  const registration = findById<any>("registrations", report.subject_registration_id);
  const own = authorize(user, "Report", "view_private", {
    ownerUserId: getField(registration, "user_id", "userId"),
  });
  return own.allowed;
}

function buildReportContent(type: ReportType, race: any, subjectRegistrationId: string | null) {
  const raceId = getField(race, "id");
  const registrations = findAll<any>("registrations").filter(r => getField(r, "race_id", "raceId") === raceId);
  const works = findAll<any>("works").filter(w => registrations.some(r => getField(w, "registration_id", "registrationId") === getField(r, "id")));
  const awards = findAll<any>("awards").filter(a => getField(a, "race_id", "raceId") === raceId);
  const judgingRecords = findAll<any>("judging_records").filter(j => registrations.some(r => getField(j, "registration_id", "registrationId") === getField(r, "id")));
  const evidences = findAll<any>("evidences").filter(e => registrations.some(r => getField(e, "registration_id", "registrationId") === getField(r, "id")));

  if (type === "rider_report") {
    const registration = registrations.find(r => getField(r, "id") === subjectRegistrationId);
    const riderWorks = works.filter(w => getField(w, "registration_id", "registrationId") === subjectRegistrationId);
    const riderAwards = awards.filter(a => getField(a, "registration_id", "registrationId") === subjectRegistrationId);
    const riderEvidence = evidences.filter(e => getField(e, "registration_id", "registrationId") === subjectRegistrationId);
    const riderName = getDisplayName(getField(registration, "user_id", "userId"));
    const sections = [
      { heading: "参赛表现", body: `${riderName} 在 ${raceTitle(race)} 中提交 ${riderWorks.length} 个作品，获得 ${riderAwards.length} 个奖项记录。` },
      { heading: "能力证据", body: `报告引用 ${riderEvidence.length} 条 Evidence 摘要，用于支撑骑行能力、风险处理和复盘判断。` },
    ];
    return composeContent({
      title: `${riderName} 个人成绩单`,
      summary: `${raceTitle(race)} 的个人报告草稿，聚合作品、奖项、评审和 Evidence 摘要。`,
      sections,
      citedEvidenceIds: riderEvidence.map(e => getField(e, "id")).filter(Boolean),
      citedAwardIds: riderAwards.map(a => getField(a, "id")).filter(Boolean),
      sourceCounts: { registrations: 1, works: riderWorks.length, awards: riderAwards.length, evidences: riderEvidence.length },
    });
  }

  if (type === "race_report") {
    const sections = [
      { heading: "赛事结果", body: `${raceTitle(race)} 当前聚合 ${registrations.length} 个报名、${works.length} 个作品、${awards.length} 个奖项记录。` },
      { heading: "评审输入", body: `报告草稿读取 ${judgingRecords.length} 条评审记录和 ${evidences.length} 条 Evidence 摘要，不读取过程 Projection 作为最终事实。` },
    ];
    return composeContent({
      title: `${raceTitle(race)} 赛事报告`,
      summary: "赛事报告草稿聚合最终奖项、作品提交、评审记录和公开证据摘要。",
      sections,
      citedEvidenceIds: evidences.map(e => getField(e, "id")).filter(Boolean),
      citedAwardIds: awards.map(a => getField(a, "id")).filter(Boolean),
      sourceCounts: { registrations: registrations.length, works: works.length, awards: awards.length, judgingRecords: judgingRecords.length, evidences: evidences.length },
    });
  }

  const sections = [
    { heading: "评审结论", body: `${raceTitle(race)} 的评审总结基于已发布奖项、评审记录和可公开 Evidence 摘要生成。` },
    { heading: "复盘重点", body: "总结关注作品完成度、Agent 协作、纠偏能力、成本控制和风险处理表现。主办方发布前应人工复核。"},
  ];
  return composeContent({
    title: `${raceTitle(race)} 评审总结`,
    summary: "公开 Review 草稿，用于解释赛果背后的评审判断和复盘价值。",
    sections,
    citedEvidenceIds: evidences.map(e => getField(e, "id")).filter(Boolean),
    citedAwardIds: awards.map(a => getField(a, "id")).filter(Boolean),
    sourceCounts: { awards: awards.length, judgingRecords: judgingRecords.length, evidences: evidences.length },
  });
}

function composeContent(input: GeneratedReportDraft): GeneratedReportContent {
  return {
    ...input,
    body: input.sections.map(section => `## ${section.heading}\n${section.body}`).join("\n\n"),
  };
}

function toReportResponse(report: Report) {
  return {
    id: report.id,
    raceId: report.race_id,
    raceSlug: getRaceSlug(report.race_id),
    type: report.type,
    subjectRegistrationId: report.subject_registration_id,
    status: report.status,
    visibility: report.visibility,
    title: report.title,
    summary: report.summary,
    body: report.body,
    sections: report.sections,
    citedEvidenceIds: report.cited_evidence_ids,
    citedAwardIds: report.cited_award_ids,
    sourceCounts: report.source_counts,
    generatedAt: report.generated_at,
    publishedAt: report.published_at,
    createdAt: report.created_at,
    updatedAt: report.updated_at,
  };
}

function getRaceOrganizerIds(race: any): string[] | undefined {
  if (!race) return undefined;
  const ids = getField(race, "organizer_user_ids", "organizerUserIds");
  if (Array.isArray(ids)) return ids;
  if (typeof ids === "string") {
    try {
      const parsed = JSON.parse(ids);
      return Array.isArray(parsed) ? parsed : undefined;
    } catch {
      return ids ? [ids] : undefined;
    }
  }
  const createdBy = getField(race, "created_by_user_id", "createdByUserId");
  return createdBy ? [createdBy] : undefined;
}

function getRaceSlug(raceId: string): string | null {
  const race = findById<any>("races", raceId);
  return race ? getField(race, "slug") ?? null : null;
}

function raceTitle(race: any): string {
  return getField(race, "title", "name") ?? "Untitled Race";
}

function getDisplayName(userId: string | undefined): string {
  if (!userId) return "Unknown Rider";
  const user = findById<any>("users", userId);
  return getField(user, "displayName", "display_name", "githubAccount", "github_account") ?? "Unknown Rider";
}

function getField<T = any>(row: any, ...fields: string[]): T | undefined {
  if (!row) return undefined;
  for (const field of fields) {
    if (row[field] !== undefined && row[field] !== null) return row[field] as T;
  }
  return undefined;
}

function asOptionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

// Shared API response types for module C (portfolio) pages.
// Keep in sync with server/src/modules/portfolio/routes.ts toXxxResponse functions.

export interface RaceSummary {
  id: string;
  slug: string;
  title: string;
  status: string;
}

export interface ReviewWarning {
  code: "ca_not_configured" | "ca_ingestion_failed" | "missing_race_project";
  severity: "warning";
  message: string;
  registrationId: string;
  raceProjectId?: string;
  aggregateIngestionStatus?: string;
}

export interface WorkResponse {
  id: string;
  registrationId: string;
  raceId: string;
  userId: string;
  slug: string;
  title: string;
  summary: string;
  problemStatement: string;
  solutionSummary: string;
  techStack: string;
  repoUrl: string | null;
  demoUrl: string | null;
  videoUrl: string | null;
  status: "draft" | "submitted" | "locked" | "hidden";
  visibility: "private" | "public";
  submittedAt: string | null;
  lockedAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  reviewWarnings: ReviewWarning[];
}

export interface JudgingRecordResponse {
  id: string;
  judgeAssignmentId: string;
  scoreResult: number | null;
  scoreRiding: number | null;
  comments: string;
  status: "draft" | "submitted";
  submittedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface JudgeAssignmentResponse {
  id: string;
  workId: string;
  judgeUserId: string;
  judgeGithubAccount: string;
  assignedByUserId: string;
  assignedAt: string;
  createdAt: string;
  updatedAt: string;
  work: WorkResponse | null;
  judgingRecord: JudgingRecordResponse | null;
}

export interface AwardResponse {
  id: string;
  raceId: string;
  registrationId: string;
  workId: string | null;
  awardName: string;
  rank: number;
  decisionReason: string;
  judgingRecordIds: string[];
  status: "draft" | "published";
  visibility: "private" | "public";
  publishedAt: string | null;
  createdByUserId: string;
  createdAt: string;
  updatedAt: string;
}

// ── Shared fetch helpers ──

export async function requestJson<T>(url: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: init.body ? { "Content-Type": "application/json", ...(init.headers || {}) } : init.headers,
    credentials: "include",
  });
  if (!response.ok) throw new Error(await readErrorMessage(response));
  return response.json() as Promise<T>;
}

export async function readErrorMessage(response: Response) {
  let error = "";
  try {
    const body = await response.json();
    error = typeof body.error === "string" ? body.error : "";
  } catch {
    error = "";
  }
  if (response.status === 400) return error || "提交内容不符合要求。";
  if (response.status === 403) return error || "当前账号没有操作权限。";
  if (response.status === 409) return error || "当前数据状态不允许继续操作。";
  return error || "请求失败，请稍后重试。";
}

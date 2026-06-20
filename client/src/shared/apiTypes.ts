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

export interface ProjectionResponse<T> {
  contractVersion?: "d.v1";
  raceId: string;
  type: string;
  readKind?: "projection" | "read_model";
  sourceOfTruth?: string[];
  consumerBoundary?: string;
  status?: "ready" | "failed";
  generatedAt: string | null;
  lastAttemptedAt?: string;
  lastError?: string | null;
  readMode?: "live" | "stable_fallback" | "static_fallback";
  usingStableFallback?: boolean;
  usingStaticFallback?: boolean;
  fallbackReason?: string | null;
  fallback?: {
    mode: "live" | "stable_fallback" | "static_fallback";
    active: boolean;
    code: "none" | "projection_failed_uses_stable" | "projection_failed_uses_static";
    reason: string | null;
  };
  data: T;
}

export interface ProjectionStatusSummaryResponse {
  contractVersion: "d.v1";
  race: RaceSummary & { visibility?: string };
  summary: {
    projectionCount: number;
    readyCount: number;
    liveCount: number;
    stableFallbackCount: number;
    staticFallbackCount: number;
    notBuiltCount: number;
    modeCounts: {
      live: number;
      stableFallback: number;
      staticFallback: number;
      notBuilt: number;
    };
    readModelCount: number;
    readModelReadyCount: number;
    serveReadyCount: number;
    serveReadiness: "live" | "degraded" | "partial" | "not_ready";
    publicReadable: boolean;
    screenReady: boolean;
    screenServeMode: "live" | "stable_fallback" | "static_fallback" | "not_built";
    latestSuccessfulAt: string | null;
    latestAttemptedAt: string | null;
    lastSuccessfulByType: Record<string, string | null>;
  };
  projections: Array<{
    type: string;
    readKind: "projection";
    sourceOfTruth: string[];
    consumerBoundary: string;
    storageStatus: "ready" | "failed" | "missing";
    effectiveReadMode: "live" | "stable_fallback" | "static_fallback" | "not_built";
    fallbackCode: "none" | "projection_failed_uses_stable" | "projection_failed_uses_static";
    fallbackActive: boolean;
    serveReady: boolean;
    publicReadable: boolean;
    lastSuccessfulAt: string | null;
    lastAttemptedAt: string | null;
    lastError: string | null;
  }>;
  readModels: Array<{
    type: "leaderboard_read_model" | "results_page_read_model" | "review_summary_read_model";
    readKind: "read_model";
    sourceOfTruth: string[];
    consumerBoundary: string;
    available: boolean;
    serveReady: boolean;
    publicReadable: boolean;
    generatedAt: string | null;
    note: string;
  }>;
}

export interface RaceProgressData {
  race: RaceSummary & { visibility?: string };
  stageLabel: string;
  headline: string;
  counts: {
    registrationsTotal: number;
    approvedRegistrations: number;
    worksSubmitted: number;
    worksPublished: number;
    judgingSubmitted: number;
    awardsPublished: number;
    activeConnections: number;
    sessionCount: number;
  };
  totals: {
    tokenCost: number;
    toolCallCount: number;
    messageCount: number;
  };
  eventStream: Array<{
    id: string;
    time: string;
    type: string;
    text: string;
  }>;
  note: string;
}

export interface RegistrationStatusData {
  race: RaceSummary;
  registrations: Array<{
    registrationId: string;
    userId: string;
    riderName: string;
    status: string;
    workStatus: string;
    workTitle: string | null;
    raceProjectId: string | null;
    aggregateIngestionStatus: string;
    connectionHealth: string;
    sessionCount: number;
    tokenCost: number;
    toolCallCount: number;
    lastSyncedAt: string | null;
  }>;
}

export interface RiskProjectionData {
  race: RaceSummary;
  counts: {
    total: number;
    caFailed: number;
    caNotConfigured: number;
    missingWork: number;
  };
  items: Array<{
    code: string;
    severity: "warning";
    registrationId?: string;
    raceProjectId?: string;
    title: string;
    message: string;
  }>;
}

export interface CurrentLeaderboardData {
  race: RaceSummary;
  note: string;
  items: Array<{
    rank: number;
    registrationId: string;
    userId: string;
    workId: string | null;
    workTitle: string;
    processScore: number;
    reviewAverage: number;
    sessionCount: number;
    aggregateIngestionStatus: string;
  }>;
}

export interface LeaderboardReadModelData {
  race: RaceSummary;
  groups: Array<{
    awardName: string;
    items: Array<{
      awardId: string;
      registrationId: string;
      workId: string | null;
      rank: number;
      decisionReason: string;
      publishedAt: string | null;
    }>;
  }>;
}

export interface ScreenFeedData {
  race: RaceSummary;
  protocol: {
    defaultDisplayMode: "live" | "leaderboard" | "works" | "announcement";
    availableModes: Array<"live" | "leaderboard" | "works" | "announcement">;
    autoRotate: boolean;
    recommendedRotationOrder: string[];
  };
  items: Array<{
    id: string;
    feedItemType: "live_metrics" | "process_leaderboard" | "final_leaderboard" | "work_highlight" | "announcement";
    mode: "live" | "leaderboard" | "works" | "announcement";
    title: string;
    order: number;
    durationMs: number;
    recommendedDisplayMode: "live" | "leaderboard" | "works" | "announcement";
    fallbackPriority: 1 | 2 | 3 | 4;
    data: any;
  }>;
}

export interface ResultsPageReadModelData {
  race: RaceSummary;
  boundaries: {
    finalResultsSource: string;
    processLeaderboardExcluded: boolean;
    reviewSummarySource: string;
  };
  leaderboard: LeaderboardReadModelData;
  awards: Array<{
    awardId: string;
    awardName: string;
    rank: number;
    registrationId: string;
    workId: string | null;
    decisionReason: string;
    publishedAt: string | null;
  }>;
  winningWorks: Array<{
    workId: string;
    title: string;
    slug: string;
    summary: string;
    publishedAt: string | null;
    awardNames: string[];
  }>;
  review: {
    available: boolean;
    report: {
      reportId: string;
      title: string;
      summary: string;
      publishedAt: string | null;
    } | null;
    message: string;
  };
}

export interface ReviewSummaryReadModelData {
  race: RaceSummary;
  report: {
    available: boolean;
    source: string;
    report: {
      reportId: string;
      title: string;
      summary: string;
      bodyMarkdown: string;
      publishedAt: string | null;
    } | null;
    message: string;
  };
  awards: Array<{
    awardId: string;
    awardName: string;
    rank: number;
    registrationId: string;
    workId: string | null;
    decisionReason: string;
    publishedAt: string | null;
  }>;
  winningWorks: Array<{
    workId: string;
    title: string;
    slug: string;
    summary: string;
    publishedAt: string | null;
    awardNames: string[];
  }>;
  nextEntries: {
    resultsPath: string;
    worksPath: string;
  };
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

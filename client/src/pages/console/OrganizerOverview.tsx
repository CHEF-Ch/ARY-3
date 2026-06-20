import { useEffect, useMemo, useState } from "react";

interface RaceReviewItem {
  id: string;
  slug: string;
  title: string;
  status: string;
  visibility: string;
  publicReadable: boolean;
}

interface RegistrationReview {
  race: { id: string; title: string; slug: string; status: string };
  summary: { total: number; submitted: number; approved: number; rejected: number; withdrawn: number; duplicateRegistrationKeys: string[] };
  registrations: Array<{
    id: string;
    userId: string;
    status: string;
    availableActions: string[];
    raceProject: { id: string; aggregateIngestionStatus: string; connectionHealth: string } | null;
  }>;
}

interface CAReview {
  summary: { total: number; pendingHandshake: number; verified: number; failedHandshake: number; disabled: number };
  connections: Array<{ id: string; caType: string; handshakeStatus: string; ingestionStatus: string; effectiveDataAllowed: boolean; rejectionReasonIfPushNow: string | null }>;
}

interface IngestionReview {
  summary: { acceptedSessions: number; rejectedPushes: number; lastSequence: number; lastNonce: string | null };
  audits: Array<{ id: string; accepted: boolean; reason: string; detail: string; received_at: string }>;
}

export default function OrganizerOverview() {
  const [races, setRaces] = useState<RaceReviewItem[]>([]);
  const [selectedRaceId, setSelectedRaceId] = useState("");
  const [review, setReview] = useState<RegistrationReview | null>(null);
  const [message, setMessage] = useState("");
  const [caReviews, setCaReviews] = useState<Record<string, CAReview>>({});
  const [ingestionReviews, setIngestionReviews] = useState<Record<string, IngestionReview>>({});

  useEffect(() => {
    loadRaces();
  }, []);

  useEffect(() => {
    if (!selectedRaceId) {
      setReview(null);
      return;
    }
    loadRegistrationReview(selectedRaceId);
  }, [selectedRaceId]);

  const selectedRace = races.find((race) => race.id === selectedRaceId);
  const nextRaceAction = selectedRace ? getNextRaceAction(selectedRace.status) : null;
  const caSummary = useMemo(() => summarizeCA(caReviews), [caReviews]);
  const riskCount = useMemo(() => {
    if (!review) return 0;
    return review.registrations.filter((registration) => {
      if (!registration.raceProject) return registration.status === "approved";
      const ca = caReviews[registration.raceProject.id];
      return !ca || ca.summary.total === 0 || ca.summary.pendingHandshake > 0 || ca.summary.failedHandshake > 0 || ca.summary.disabled > 0;
    }).length;
  }, [caReviews, review]);

  const loadRaces = () => {
    fetch("/races/review", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const items = data?.reviewableRaces || [];
        setRaces(items);
        setSelectedRaceId((current) => (items.some((race: RaceReviewItem) => race.id === current) ? current : items[0]?.id || ""));
      })
      .catch(() => setMessage("赛事列表加载失败。"));
  };

  const loadRegistrationReview = (raceId: string) => {
    fetch(`/races/${raceId}/registrations/review`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setReview(data);
        (data?.registrations || []).forEach((registration: RegistrationReview["registrations"][number]) => {
          if (registration.raceProject) loadCAReview(registration.raceProject.id);
        });
      })
      .catch(() => setMessage("报名审核数据加载失败。"));
  };

  const loadCAReview = (raceProjectId: string) => {
    fetch(`/race-projects/${raceProjectId}/ca-review`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setCaReviews((current) => ({ ...current, [raceProjectId]: data }));
          data.connections?.forEach((connection: CAReview["connections"][number]) => loadIngestionReview(connection.id));
        }
      })
      .catch(() => {});
  };

  const loadIngestionReview = (connectionId: string) => {
    fetch(`/ca-connections/${connectionId}/ingestion-review`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setIngestionReviews((current) => ({ ...current, [connectionId]: data }));
      })
      .catch(() => {});
  };

  const act = async (registrationId: string, action: "approve" | "reject" | "withdraw") => {
    const res = await fetch(`/registrations/${registrationId}/${action}`, {
      method: "POST",
      credentials: "include",
    });
    const data = await res.json().catch(() => null);
    setMessage(res.ok ? `${formatAction(action)}已完成。` : data?.error || `${formatAction(action)}失败。`);
    if (selectedRaceId) loadRegistrationReview(selectedRaceId);
  };

  const advanceRace = async () => {
    if (!selectedRace || !nextRaceAction) return;
    const res = nextRaceAction.kind === "publish"
      ? await fetch(`/races/${selectedRace.id}/publish`, { method: "POST", credentials: "include" })
      : nextRaceAction.kind === "archive"
        ? await fetch(`/races/${selectedRace.id}/archive`, { method: "POST", credentials: "include" })
        : await fetch(`/races/${selectedRace.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ status: nextRaceAction.nextStatus }),
          });
    const data = await res.json().catch(() => null);
    setMessage(res.ok ? `${nextRaceAction.label}已完成。` : data?.error || `${nextRaceAction.label}失败。`);
    if (res.ok) {
      loadRaces();
      loadRegistrationReview(selectedRace.id);
    }
  };

  return (
    <div>
      <h1 style={titleStyle}>主办方赛事总览</h1>
      <p style={muted}>集中处理赛事状态、报名审核、RaceProject 自动生成和 CA 接入风险。</p>

      <section style={summaryGridStyle}>
        <article style={cardStyle}>
          <h2 style={cardTitleStyle}>当前赛事</h2>
          <select value={selectedRaceId} onChange={(event) => setSelectedRaceId(event.target.value)} style={selectStyle}>
            {races.map((race) => <option key={race.id} value={race.id}>{race.title}</option>)}
          </select>
          <p style={metricTextStyle}>{selectedRace ? `${formatRaceStatus(selectedRace.status)} / ${formatVisibility(selectedRace.visibility)}` : "暂无可管理赛事"}</p>
          {nextRaceAction ? <button style={primaryButtonStyle} onClick={advanceRace}>{nextRaceAction.label}</button> : <p style={muted}>当前赛事已归档。</p>}
        </article>
        <article style={cardStyle}>
          <h2 style={cardTitleStyle}>报名审核</h2>
          <p style={metricTextStyle}>{review ? `${review.summary.total} 人报名` : "暂无数据"}</p>
          <p style={muted}>{review ? `${review.summary.submitted} 待审核 / ${review.summary.approved} 已通过 / ${review.summary.rejected} 未通过` : "选择赛事后查看报名状态。"}</p>
        </article>
        <article style={cardStyle}>
          <h2 style={cardTitleStyle}>CA 接入风险</h2>
          <p style={metricTextStyle}>{riskCount} 个需关注对象</p>
          <p style={muted}>{caSummary.total} 个连接 / {caSummary.verified} 已握手 / {caSummary.blocked} 异常或禁用</p>
        </article>
      </section>

      {review ? (
        <section style={{ ...cardStyle, marginTop: 16 }}>
          <div style={sectionHeaderStyle}>
            <h2 style={sectionTitleStyle}>报名与接入状态</h2>
            {review.summary.duplicateRegistrationKeys.length > 0 ? <span style={dangerPillStyle}>存在重复报名数据</span> : null}
          </div>
          {review.registrations.length === 0 ? (
            <p style={muted}>当前赛事暂无报名。</p>
          ) : (
            <div style={tableStyle}>
              <div style={tableHeaderStyle}>
                <span>选手</span>
                <span>报名</span>
                <span>RaceProject</span>
                <span>CA 风险</span>
                <span>操作</span>
              </div>
              {review.registrations.map((registration) => {
                const ca = registration.raceProject ? caReviews[registration.raceProject.id] : undefined;
                return (
                  <div key={registration.id} style={tableRowStyle}>
                    <span style={strongTextStyle}>{registration.userId}</span>
                    <span>{formatRegistrationStatus(registration.status)}</span>
                    <span>{registration.raceProject ? formatProjectStatus(registration.raceProject.aggregateIngestionStatus, registration.raceProject.connectionHealth) : "未生成"}</span>
                    <span>{formatCAWarning(registration, ca)}</span>
                    <span style={actionRowStyle}>
                      {registration.availableActions.includes("approve") ? <button style={smallButtonStyle} onClick={() => act(registration.id, "approve")}>通过</button> : null}
                      {registration.availableActions.includes("reject") ? <button style={smallButtonStyle} onClick={() => act(registration.id, "reject")}>拒绝</button> : null}
                      {registration.availableActions.includes("withdraw") ? <button style={smallButtonStyle} onClick={() => act(registration.id, "withdraw")}>撤回</button> : null}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      ) : null}

      {review ? (
        <section style={{ ...cardStyle, marginTop: 16 }}>
          <h2 style={sectionTitleStyle}>CA 接收审计</h2>
          <div style={auditGridStyle}>
            {review.registrations.flatMap((registration) => {
              const ca = registration.raceProject ? caReviews[registration.raceProject.id] : undefined;
              return (ca?.connections || []).map((connection) => {
                const ingestion = ingestionReviews[connection.id];
                return (
                  <article key={connection.id} style={auditCardStyle}>
                    <strong>{registration.userId}</strong>
                    <p style={muted}>{connection.caType} / {formatHandshakeStatus(connection.handshakeStatus)} / {formatIngestionStatus(connection.ingestionStatus)}</p>
                    <div style={auditMetricRowStyle}>
                      <span>有效 Session：{ingestion?.summary.acceptedSessions ?? 0}</span>
                      <span>拒收 push：{ingestion?.summary.rejectedPushes ?? 0}</span>
                    </div>
                    <p style={auditReasonStyle}>{formatLatestAuditReason(ingestion)}</p>
                  </article>
                );
              });
            })}
          </div>
        </section>
      ) : null}

      {message ? <p style={messageStyle}>{message}</p> : null}
    </div>
  );
}

function summarizeCA(rows: Record<string, CAReview>) {
  return Object.values(rows).reduce(
    (sum, item) => ({
      total: sum.total + item.summary.total,
      verified: sum.verified + item.summary.verified,
      blocked: sum.blocked + item.summary.failedHandshake + item.summary.disabled,
    }),
    { total: 0, verified: 0, blocked: 0 },
  );
}

function formatAction(action: string) {
  if (action === "approve") return "通过";
  if (action === "reject") return "拒绝";
  return "撤回";
}

function getNextRaceAction(status: string): { kind: "publish" | "patch" | "archive"; nextStatus?: string; label: string } | null {
  if (status === "draft") return { kind: "publish", label: "发布赛事" };
  if (status === "published") return { kind: "patch", nextStatus: "registration", label: "开放报名" };
  if (status === "registration") return { kind: "patch", nextStatus: "running", label: "开始比赛" };
  if (status === "running") return { kind: "patch", nextStatus: "submitting", label: "进入提交阶段" };
  if (status === "submitting") return { kind: "patch", nextStatus: "judging", label: "进入评审阶段" };
  if (status === "judging") return { kind: "patch", nextStatus: "completed", label: "完成赛事" };
  if (status === "completed") return { kind: "archive", label: "归档赛事" };
  return null;
}

function formatRaceStatus(value: string) {
  const labels: Record<string, string> = { draft: "草稿", published: "已发布", registration: "报名中", running: "进行中", submitting: "提交中", judging: "评审中", completed: "已结束", archived: "已归档" };
  return labels[value] || value;
}

function formatVisibility(value: string) {
  return value === "public" ? "公开" : "私有";
}

function formatRegistrationStatus(value: string) {
  const labels: Record<string, string> = { submitted: "待审核", approved: "已通过", rejected: "未通过", withdrawn: "已撤回" };
  return labels[value] || value;
}

function formatProjectStatus(status: string, health: string) {
  return `${formatIngestionStatus(status)} / ${formatConnectionHealth(health)}`;
}

function formatIngestionStatus(value: string) {
  const labels: Record<string, string> = { not_configured: "未配置", connected: "已连接", active: "有有效数据", failed: "接入异常" };
  return labels[value] || value;
}

function formatConnectionHealth(value: string) {
  const labels: Record<string, string> = { no_signal: "无信号", no_valid_signal: "暂无有效信号", healthy: "健康", partial_failed: "部分异常" };
  return labels[value] || value;
}

function formatCAWarning(registration: RegistrationReview["registrations"][number], ca?: CAReview) {
  if (!registration.raceProject) return registration.status === "approved" ? "已通过但缺少 RaceProject" : "待审核后生成";
  if (!ca || ca.summary.total === 0) return "无 CAConnection，将形成证据缺口提示";
  if (ca.summary.disabled > 0 || ca.summary.failedHandshake > 0) return "存在失败或禁用连接";
  if (ca.summary.pendingHandshake > 0) return "有连接待握手";
  return "暂无接入风险";
}

function formatHandshakeStatus(value: string) {
  const labels: Record<string, string> = { pending: "待握手", verified: "已握手", failed: "握手失败" };
  return labels[value] || value;
}

function formatLatestAuditReason(review?: IngestionReview) {
  const latestRejected = review?.audits?.find((audit) => !audit.accepted);
  if (!latestRejected) return "暂无拒收记录。";
  return `最近拒收：${formatAuditReason(latestRejected.reason)}。`;
}

function formatAuditReason(value: string) {
  const labels: Record<string, string> = {
    connection_not_found: "连接不存在",
    handshake_not_verified: "未完成握手",
    connection_disabled: "连接已禁用",
    connection_failed: "连接异常",
    nonce_replay: "nonce 重放",
    sequence_replay_or_stale: "序号重放或过期",
    payload_project_mismatch: "RaceProject 不匹配",
    payload_connection_mismatch: "CAConnection 不匹配",
    payload_hash_mismatch: "payload 被篡改",
    payload_too_large: "payload 超出大小限制",
    signature_mismatch: "签名不匹配",
    timestamp_out_of_window: "时间戳超窗",
  };
  return labels[value] || value;
}

const titleStyle: React.CSSProperties = {
  margin: "0 0 8px",
  fontSize: 28,
  color: "#06164a",
};

const summaryGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 16,
  marginTop: 20,
};

const cardStyle: React.CSSProperties = {
  padding: 20,
  border: "1px solid rgba(34,107,230,0.18)",
  borderRadius: 8,
  background: "rgba(255,255,255,0.72)",
};

const cardTitleStyle: React.CSSProperties = {
  margin: "0 0 12px",
  fontSize: 18,
  color: "#06164a",
};

const selectStyle: React.CSSProperties = {
  width: "100%",
  padding: 9,
  border: "1px solid rgba(34,107,230,0.18)",
  borderRadius: 8,
  color: "#06164a",
};

const metricTextStyle: React.CSSProperties = {
  margin: "12px 0 6px",
  color: "#06164a",
  fontSize: 22,
  fontWeight: 900,
};

const sectionHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  gap: 12,
  marginBottom: 12,
};

const sectionTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 20,
  color: "#06164a",
};

const dangerPillStyle: React.CSSProperties = {
  padding: "5px 9px",
  borderRadius: 8,
  color: "#b42318",
  background: "rgba(255,232,230,0.72)",
  fontWeight: 800,
  fontSize: 12,
};

const tableStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
};

const tableHeaderStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 100px 180px 220px 180px",
  gap: 12,
  padding: "8px 10px",
  color: "#667899",
  fontSize: 12,
  fontWeight: 900,
};

const tableRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 100px 180px 220px 180px",
  gap: 12,
  alignItems: "center",
  padding: 10,
  border: "1px solid rgba(34,107,230,0.12)",
  borderRadius: 8,
  background: "rgba(255,255,255,0.68)",
  color: "#06164a",
};

const actionRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 8,
  flexWrap: "wrap",
};

const strongTextStyle: React.CSSProperties = {
  fontWeight: 800,
};

const smallButtonStyle: React.CSSProperties = {
  padding: "6px 10px",
  border: "1px solid rgba(34,107,230,0.2)",
  borderRadius: 8,
  background: "#fff",
  color: "#0a3fb8",
  fontWeight: 800,
  cursor: "pointer",
};

const primaryButtonStyle: React.CSSProperties = {
  marginTop: 10,
  padding: "8px 12px",
  border: "none",
  borderRadius: 8,
  background: "#0b5ee8",
  color: "white",
  fontWeight: 800,
  cursor: "pointer",
};

const messageStyle: React.CSSProperties = {
  color: "#0a3fb8",
  fontWeight: 800,
};

const auditGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 12,
  marginTop: 12,
};

const auditCardStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  padding: 12,
  border: "1px solid rgba(34,107,230,0.12)",
  borderRadius: 8,
  background: "rgba(255,255,255,0.70)",
  color: "#06164a",
};

const auditMetricRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
  color: "#445a83",
  fontSize: 13,
  fontWeight: 800,
};

const auditReasonStyle: React.CSSProperties = {
  margin: 0,
  color: "#7a4a00",
  fontSize: 13,
  fontWeight: 800,
};

const muted: React.CSSProperties = {
  color: "#53668d",
  margin: 0,
};

import { useEffect, useMemo, useState } from "react";

interface Registration {
  id: string;
  raceId: string;
  raceTitle: string | null;
  raceSlug: string | null;
  status: string;
  submittedAt: string;
  approvedAt: string | null;
  raceProject: {
    id: string;
    aggregateIngestionStatus: string;
    connectionHealth: string;
  } | null;
}

interface CAConnection {
  id: string;
  caType: string;
  connectorId: string;
  handshakeStatus: string;
  ingestionStatus: string;
  connectionSecret?: string;
  handshakeChallenge: string;
  disabledAt?: string | null;
}

interface IngestionReview {
  summary: { acceptedSessions: number; rejectedPushes: number; lastSequence: number; lastNonce: string | null };
  audits: Array<{ id: string; accepted: boolean; reason: string; detail: string; received_at: string }>;
}

export default function RiderView() {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [connections, setConnections] = useState<Record<string, CAConnection[]>>({});
  const [message, setMessage] = useState("");
  const [secretNotice, setSecretNotice] = useState<{ connectionId: string; connectorId: string; challenge: string; secret: string; raceProjectId: string } | null>(null);
  const [ingestionReviews, setIngestionReviews] = useState<Record<string, IngestionReview>>({});

  useEffect(() => {
    fetch("/registrations/me", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        setRegistrations(data);
        data.forEach((registration: Registration) => {
          if (registration.raceProject) loadConnections(registration.raceProject.id);
        });
      })
      .catch(() => setRegistrations([]));
  }, []);

  const approvedRegistrations = useMemo(() => registrations.filter((registration) => registration.raceProject), [registrations]);

  const loadConnections = (raceProjectId: string) => {
    fetch(`/race-projects/${raceProjectId}/ca-connections`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        setConnections((current) => ({ ...current, [raceProjectId]: data }));
        data.forEach((connection: CAConnection) => loadIngestionReview(connection.id));
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

  const registerConnection = async (raceProjectId: string) => {
    setMessage("");
    setSecretNotice(null);
    const res = await fetch(`/race-projects/${raceProjectId}/ca-connections`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ caType: "codex", connectorVersion: "dcr-desktop-dev" }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setMessage(data?.error || "CAConnection 登记失败。");
      return;
    }
    setSecretNotice({
      connectionId: data.id,
      connectorId: data.connectorId,
      challenge: data.handshakeChallenge,
      secret: data.connectionSecret,
      raceProjectId,
    });
    setMessage("CAConnection 已登记，请在 DCR 客户端完成握手。");
    loadConnections(raceProjectId);
  };

  const handshakeConnection = async () => {
    if (!secretNotice) return;
    const signature = await signChallenge(secretNotice.secret, secretNotice.challenge);
    const res = await fetch(`/ca-connections/${secretNotice.connectionId}/handshake`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        connectorId: secretNotice.connectorId,
        challenge: secretNotice.challenge,
        securityVersion: "dcr-hmac-v1",
        signatureAlgorithm: "HMAC-SHA256",
        signature,
      }),
    });
    const data = await res.json().catch(() => null);
    setMessage(res.ok ? "DCR 握手已完成，可以接收有效骑行数据。" : data?.error || "DCR 握手失败。");
    if (res.ok) {
      setSecretNotice(null);
      loadConnections(secretNotice.raceProjectId);
    }
  };

  const disableConnection = async (raceProjectId: string, connectionId: string) => {
    const res = await fetch(`/ca-connections/${connectionId}/disable`, { method: "POST", credentials: "include" });
    const data = await res.json().catch(() => null);
    setMessage(res.ok ? "CAConnection 已禁用，后续 push 会被拒收并进入审计。" : data?.error || "禁用 CAConnection 失败。");
    if (res.ok) loadConnections(raceProjectId);
  };

  return (
    <div>
      <h1 style={titleStyle}>选手工作台</h1>
      <p style={muted}>查看报名、参赛工作区和 CA 接入状态；CA 异常只形成评审前风险提示，不会自动取消提交资格。</p>

      {secretNotice ? (
        <section style={secretPanelStyle}>
          <h2 style={sectionTitleStyle}>一次性 DCR 凭据</h2>
          <p style={muted}>请保存到本地 DCR 客户端。离开页面后，服务端不会再次返回 secret。</p>
          <div style={secretGridStyle}>
            <Info label="connectorId" value={secretNotice.connectorId} />
            <Info label="handshakeChallenge" value={secretNotice.challenge} />
            <Info label="connectionSecret" value={secretNotice.secret} />
          </div>
          <button style={primaryButtonStyle} onClick={handshakeConnection}>用当前凭据完成握手</button>
        </section>
      ) : null}

      <section style={gridStyle}>
        <article style={cardStyle}>
          <h2 style={sectionTitleStyle}>报名状态</h2>
          {registrations.length === 0 ? (
            <p style={muted}>暂无报名记录。</p>
          ) : (
            <div style={listStyle}>
              {registrations.map((registration) => (
                <div key={registration.id} style={registrationRowStyle}>
                  <strong>{registration.raceTitle || registration.raceId}</strong>
                  <span>{formatRegistrationStatus(registration.status)}</span>
                  <span>{registration.raceProject ? formatProjectStatus(registration.raceProject.aggregateIngestionStatus) : "审核通过后生成工作区"}</span>
                </div>
              ))}
            </div>
          )}
        </article>

        <article style={cardStyle}>
          <h2 style={sectionTitleStyle}>作品提交</h2>
          <p style={bodyTextStyle}>
            作品提交不以 CA 接入状态作为硬门禁。无 CA 数据、握手失败或连接禁用会进入评审前风险提示，由评委结合作品和证据摘要判断。
          </p>
        </article>
      </section>

      <section style={{ ...cardStyle, marginTop: 16 }}>
        <h2 style={sectionTitleStyle}>CA 接入</h2>
        {approvedRegistrations.length === 0 ? (
          <p style={muted}>等待报名审核通过后，系统会自动生成 RaceProject 并开放 CAConnection 登记。</p>
        ) : (
          <div style={projectGridStyle}>
            {approvedRegistrations.map((registration) => {
              const projectId = registration.raceProject!.id;
              const rows = connections[projectId] || [];
              return (
                <article key={projectId} style={projectCardStyle}>
                  <div style={projectHeaderStyle}>
                    <div>
                      <strong>{registration.raceTitle || registration.raceId}</strong>
                      <p style={muted}>{formatProjectStatus(registration.raceProject!.aggregateIngestionStatus)} / {formatConnectionHealth(registration.raceProject!.connectionHealth)}</p>
                    </div>
                    <button style={smallButtonStyle} onClick={() => registerConnection(projectId)}>登记 DCR</button>
                  </div>
                  <p style={warningTextStyle}>{getProjectWarning(registration, rows)}</p>
                  {rows.length === 0 ? (
                    <p style={muted}>暂无 CAConnection。</p>
                  ) : (
                    <div style={listStyle}>
                      {rows.map((connection) => (
                        <div key={connection.id} style={connectionCardStyle}>
                          <div style={connectionRowStyle}>
                            <span>{connection.caType}</span>
                            <span>{formatHandshakeStatus(connection.handshakeStatus)}</span>
                            <span>{formatIngestionStatus(connection.ingestionStatus)}</span>
                            <span>{connection.disabledAt ? "已禁用" : "可用"}</span>
                            <button
                              disabled={!!connection.disabledAt}
                              style={connection.disabledAt ? disabledButtonStyle : textButtonStyle}
                              onClick={() => disableConnection(projectId, connection.id)}
                            >
                              禁用
                            </button>
                          </div>
                          <ConnectionAudit review={ingestionReviews[connection.id]} />
                        </div>
                      ))}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      {message ? <p style={messageStyle}>{message}</p> : null}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div style={infoBlockStyle}>
      <div style={infoLabelStyle}>{label}</div>
      <div style={infoValueStyle}>{value}</div>
    </div>
  );
}

function ConnectionAudit({ review }: { review?: IngestionReview }) {
  return (
    <div style={auditPanelStyle}>
      <span>有效 Session：{review?.summary.acceptedSessions ?? 0}</span>
      <span>拒收 push：{review?.summary.rejectedPushes ?? 0}</span>
      <span>{formatLatestAuditReason(review)}</span>
    </div>
  );
}

function formatRegistrationStatus(value: string) {
  const labels: Record<string, string> = { submitted: "待审核", approved: "已通过", rejected: "未通过", withdrawn: "已撤回" };
  return labels[value] || value;
}

function formatProjectStatus(value: string) {
  const labels: Record<string, string> = { not_configured: "未配置 CA", connected: "已连接", active: "有有效数据", failed: "接入异常" };
  return labels[value] || value;
}

function formatConnectionHealth(value: string) {
  const labels: Record<string, string> = { no_signal: "无信号", no_valid_signal: "暂无有效信号", healthy: "健康", partial_failed: "部分异常" };
  return labels[value] || value;
}

function formatHandshakeStatus(value: string) {
  const labels: Record<string, string> = { pending: "待握手", verified: "已握手", failed: "握手失败" };
  return labels[value] || value;
}

function formatIngestionStatus(value: string) {
  const labels: Record<string, string> = { not_configured: "未配置", connected: "已连接", active: "有数据", failed: "异常" };
  return labels[value] || value;
}

function getProjectWarning(registration: Registration, rows: CAConnection[]) {
  if (!registration.raceProject) return "报名审核通过后生成参赛工作区。";
  if (rows.length === 0) return "尚未登记 CAConnection，提交作品时会形成证据缺口提示。";
  if (rows.some((row) => row.disabledAt || row.handshakeStatus === "failed" || row.ingestionStatus === "failed")) return "存在异常连接，评审前会提示接入风险。";
  if (rows.some((row) => row.handshakeStatus === "pending")) return "有连接待握手，完成握手后才会接收有效骑行数据。";
  return "CA 接入状态正常。";
}

function formatLatestAuditReason(review?: IngestionReview) {
  const latestRejected = review?.audits?.find((audit) => !audit.accepted);
  if (!latestRejected) return "暂无拒收记录";
  return `最近拒收：${formatAuditReason(latestRejected.reason)}`;
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

async function signChallenge(secretHex: string, challenge: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    hexToBytes(secretHex),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(challenge));
  return bytesToHex(new Uint8Array(signature));
}

function hexToBytes(value: string) {
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes: Uint8Array) {
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

const titleStyle: React.CSSProperties = {
  margin: "0 0 8px",
  fontSize: 28,
  color: "#06164a",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: 16,
  marginTop: 20,
};

const cardStyle: React.CSSProperties = {
  padding: 20,
  border: "1px solid rgba(34,107,230,0.18)",
  borderRadius: 8,
  background: "rgba(255,255,255,0.72)",
};

const secretPanelStyle: React.CSSProperties = {
  ...cardStyle,
  marginTop: 16,
  border: "1px solid rgba(186,112,0,0.28)",
  background: "rgba(255,249,235,0.84)",
};

const sectionTitleStyle: React.CSSProperties = {
  margin: "0 0 12px",
  fontSize: 20,
  color: "#06164a",
};

const bodyTextStyle: React.CSSProperties = {
  margin: 0,
  color: "#445a83",
  lineHeight: 1.7,
};

const listStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const registrationRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 90px 150px",
  gap: 12,
  padding: 10,
  border: "1px solid rgba(34,107,230,0.12)",
  borderRadius: 8,
  color: "#06164a",
};

const projectGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: 12,
};

const projectCardStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
  padding: 12,
  border: "1px solid rgba(34,107,230,0.12)",
  borderRadius: 8,
  background: "rgba(255,255,255,0.70)",
};

const projectHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "flex-start",
};

const connectionRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 90px 80px 70px 60px",
  gap: 8,
  padding: 10,
  border: "1px solid rgba(34,107,230,0.10)",
  borderRadius: 8,
  color: "#53668d",
  fontSize: 13,
};

const connectionCardStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
};

const auditPanelStyle: React.CSSProperties = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
  padding: "8px 10px",
  border: "1px solid rgba(186,112,0,0.16)",
  borderRadius: 8,
  background: "rgba(255,249,235,0.66)",
  color: "#7a4a00",
  fontSize: 13,
  fontWeight: 800,
};

const secretGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 10,
  marginTop: 12,
};

const infoBlockStyle: React.CSSProperties = {
  padding: 12,
  border: "1px solid rgba(186,112,0,0.20)",
  borderRadius: 8,
  background: "rgba(255,255,255,0.72)",
};

const infoLabelStyle: React.CSSProperties = {
  color: "#7a4a00",
  fontSize: 12,
  fontWeight: 800,
};

const infoValueStyle: React.CSSProperties = {
  marginTop: 6,
  color: "#06164a",
  fontWeight: 800,
  wordBreak: "break-all",
};

const smallButtonStyle: React.CSSProperties = {
  padding: "8px 11px",
  border: "1px solid rgba(34,107,230,0.2)",
  borderRadius: 8,
  background: "#fff",
  color: "#0a3fb8",
  fontWeight: 800,
  cursor: "pointer",
};

const primaryButtonStyle: React.CSSProperties = {
  marginTop: 12,
  padding: "9px 12px",
  border: "none",
  borderRadius: 8,
  background: "#0b5ee8",
  color: "white",
  fontWeight: 800,
  cursor: "pointer",
};

const textButtonStyle: React.CSSProperties = {
  border: "none",
  background: "transparent",
  color: "#075bec",
  fontWeight: 800,
  cursor: "pointer",
};

const disabledButtonStyle: React.CSSProperties = {
  ...textButtonStyle,
  color: "#8b99b0",
  cursor: "not-allowed",
};

const warningTextStyle: React.CSSProperties = {
  margin: 0,
  color: "#7a4a00",
  fontSize: 13,
  fontWeight: 800,
};

const messageStyle: React.CSSProperties = {
  color: "#0a3fb8",
  fontWeight: 800,
};

const muted: React.CSSProperties = {
  color: "#53668d",
  margin: 0,
};

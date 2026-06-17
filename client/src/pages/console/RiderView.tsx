import { useEffect, useState } from "react";

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
}

export default function RiderView() {
  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [connections, setConnections] = useState<Record<string, CAConnection[]>>({});
  const [message, setMessage] = useState("");

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

  const loadConnections = (raceProjectId: string) => {
    fetch(`/race-projects/${raceProjectId}/ca-connections`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => setConnections((current) => ({ ...current, [raceProjectId]: data })))
      .catch(() => {});
  };

  const registerConnection = async (raceProjectId: string) => {
    const res = await fetch(`/race-projects/${raceProjectId}/ca-connections`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ caType: "codex", connectorVersion: "dcr-desktop-dev" }),
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setMessage(data?.error || "CAConnection registration failed");
      return;
    }
    setMessage(`DCR secret shown once: ${data.connectionSecret}`);
    loadConnections(raceProjectId);
  };

  return (
    <div>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Rider View</h1>
      <p style={{ color: "#53668d", marginBottom: 24 }}>
        报名状态 / CA 接入 / 骑行状态 / 作品提交 / 评审结果 / 选手报告
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
        <div style={cardStyle}>
          <h3>报名状态</h3>
          {registrations.length === 0 ? (
            <p>暂无报名</p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {registrations.map((registration) => (
                <div key={registration.id} style={registrationRowStyle}>
                  <strong>{registration.raceTitle || registration.raceId}</strong>
                  <span>{registration.status}</span>
                  <span>{registration.raceProject ? registration.raceProject.aggregateIngestionStatus : "no project"}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div style={cardStyle}>
          <h3>CA 接入</h3>
          {registrations.filter((registration) => registration.raceProject).length === 0 ? (
            <p>等待报名审核通过</p>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {registrations.filter((registration) => registration.raceProject).map((registration) => {
                const projectId = registration.raceProject!.id;
                return (
                  <div key={projectId} style={caBlockStyle}>
                    <strong>{registration.raceTitle || registration.raceId}</strong>
                    <button style={smallButtonStyle} onClick={() => registerConnection(projectId)}>Register DCR</button>
                    {(connections[projectId] || []).map((connection) => (
                      <div key={connection.id} style={connectionRowStyle}>
                        <span>{connection.caType}</span>
                        <span>{connection.handshakeStatus}</span>
                        <span>{connection.ingestionStatus}</span>
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          )}
        </div>
        <div style={cardStyle}><h3>骑行状态</h3><p>—</p></div>
        <div style={cardStyle}><h3>作品提交</h3><p>—</p></div>
      </div>
      {message && <p style={{ color: "#0a3fb8", fontWeight: 800 }}>{message}</p>}

      <p style={{ color: "#53668d", fontSize: 13, marginTop: 24 }}>
        —— B（race-mgmt）实现
      </p>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  padding: 20,
  border: "1px solid rgba(34,107,230,0.18)",
  borderRadius: 8,
  background: "rgba(255,255,255,0.72)",
};

const registrationRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.2fr 0.5fr 0.8fr",
  gap: 12,
  padding: 10,
  border: "1px solid rgba(34,107,230,0.12)",
  borderRadius: 6,
};

const caBlockStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
  padding: 10,
  border: "1px solid rgba(34,107,230,0.12)",
  borderRadius: 6,
};

const connectionRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 1fr",
  gap: 8,
  color: "#53668d",
  fontSize: 13,
};

const smallButtonStyle: React.CSSProperties = {
  padding: "6px 10px",
  border: "1px solid rgba(34,107,230,0.2)",
  borderRadius: 6,
  background: "#fff",
  color: "#0a3fb8",
  fontWeight: 800,
  cursor: "pointer",
};

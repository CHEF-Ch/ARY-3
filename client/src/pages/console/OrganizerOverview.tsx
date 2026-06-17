import { useEffect, useState } from "react";

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

export default function OrganizerOverview() {
  const [races, setRaces] = useState<RaceReviewItem[]>([]);
  const [selectedRaceId, setSelectedRaceId] = useState("");
  const [review, setReview] = useState<RegistrationReview | null>(null);
  const [message, setMessage] = useState("");
  const [caReviews, setCaReviews] = useState<Record<string, CAReview>>({});

  useEffect(() => {
    fetch("/races/review", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const items = data?.reviewableRaces || [];
        setRaces(items);
        setSelectedRaceId(items[0]?.id || "");
      })
      .catch(() => setMessage("Unable to load race review"));
  }, []);

  useEffect(() => {
    if (!selectedRaceId) {
      setReview(null);
      return;
    }
    loadRegistrationReview(selectedRaceId);
  }, [selectedRaceId]);

  const loadRegistrationReview = (raceId: string) => {
    fetch(`/races/${raceId}/registrations/review`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setReview(data);
        (data?.registrations || []).forEach((registration: RegistrationReview["registrations"][number]) => {
          if (registration.raceProject) loadCAReview(registration.raceProject.id);
        });
      })
      .catch(() => setMessage("Unable to load registration review"));
  };

  const loadCAReview = (raceProjectId: string) => {
    fetch(`/race-projects/${raceProjectId}/ca-review`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setCaReviews((current) => ({ ...current, [raceProjectId]: data }));
      })
      .catch(() => {});
  };

  const act = async (registrationId: string, action: "approve" | "reject" | "withdraw") => {
    const res = await fetch(`/registrations/${registrationId}/${action}`, {
      method: "POST",
      credentials: "include",
    });
    const data = await res.json().catch(() => null);
    setMessage(res.ok ? `${action} completed` : data?.error || `${action} failed`);
    if (selectedRaceId) loadRegistrationReview(selectedRaceId);
  };

  return (
    <div>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Organizer View — 赛事管理</h1>
      <p style={{ color: "#53668d", marginBottom: 24 }}>
        赛事总览 / 报名管理 / CA 接入状态 / 选手名册
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        <div style={cardStyle}>
          <h3>赛道状态</h3>
          <select value={selectedRaceId} onChange={(event) => setSelectedRaceId(event.target.value)} style={selectStyle}>
            {races.map((race) => <option key={race.id} value={race.id}>{race.title}</option>)}
          </select>
          <p>{review ? `${review.race.status} / ${races.find((race) => race.id === selectedRaceId)?.visibility}` : "—"}</p>
        </div>
        <div style={cardStyle}>
          <h3>报名管理</h3>
          <p>{review ? `${review.summary.total} total / ${review.summary.submitted} submitted / ${review.summary.approved} approved` : "—"}</p>
        </div>
        <div style={cardStyle}>
          <h3>CA 接入</h3>
          <p>{Object.values(caReviews).reduce((sum, item) => sum + item.summary.total, 0)} registered</p>
        </div>
      </div>

      {review && (
        <div style={{ ...cardStyle, marginTop: 16 }}>
          <h3>Registration Review</h3>
          {review.registrations.length === 0 ? (
            <p style={{ color: "#53668d" }}>No registrations yet.</p>
          ) : (
            <div style={{ display: "grid", gap: 10 }}>
              {review.registrations.map((registration) => (
                <div key={registration.id} style={rowStyle}>
                  <span>{registration.userId}</span>
                  <strong>{registration.status}</strong>
                  <span>
                    {registration.raceProject
                      ? `${registration.raceProject.aggregateIngestionStatus} / ${caReviews[registration.raceProject.id]?.summary.verified || 0} verified`
                      : "no project"}
                  </span>
                  <span style={{ display: "flex", gap: 8 }}>
                    {registration.availableActions.includes("approve") && <button style={smallButtonStyle} onClick={() => act(registration.id, "approve")}>Approve</button>}
                    {registration.availableActions.includes("reject") && <button style={smallButtonStyle} onClick={() => act(registration.id, "reject")}>Reject</button>}
                    {registration.availableActions.includes("withdraw") && <button style={smallButtonStyle} onClick={() => act(registration.id, "withdraw")}>Withdraw</button>}
                  </span>
                </div>
              ))}
            </div>
          )}
          {review.summary.duplicateRegistrationKeys.length > 0 && <p style={{ color: "#b42318" }}>Duplicate registrations detected.</p>}
        </div>
      )}

      {message && <p style={{ color: "#0a3fb8", fontWeight: 800 }}>{message}</p>}

      <p style={{ color: "#53668d", fontSize: 13, marginTop: 24 }}>
        —— B（race-mgmt）实现：赛事 CRUD + 报名审核 + CAConnection 状态 + RaceProject 聚合
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

const selectStyle: React.CSSProperties = {
  width: "100%",
  padding: 8,
  border: "1px solid rgba(34,107,230,0.18)",
  borderRadius: 6,
};

const rowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1.4fr 0.5fr 0.8fr 1fr",
  gap: 12,
  alignItems: "center",
  padding: 10,
  border: "1px solid rgba(34,107,230,0.12)",
  borderRadius: 6,
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

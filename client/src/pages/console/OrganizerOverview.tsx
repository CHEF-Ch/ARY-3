export default function OrganizerOverview() {
  return (
    <div>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Organizer View — 赛事管理</h1>
      <p style={{ color: "#53668d", marginBottom: 24 }}>
        赛事总览 / 报名管理 / CA 接入状态 / 选手名册
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        <div style={cardStyle}><h3>赛道状态</h3><p>—</p></div>
        <div style={cardStyle}><h3>报名管理</h3><p>—</p></div>
        <div style={cardStyle}><h3>CA 接入</h3><p>—</p></div>
      </div>

      <p style={{ color: "#53668d", fontSize: 13, marginTop: 24 }}>
        —— B（race-mgmt）实现：赛事 CRUD + 报名审核 + CAConnection 状态 + RaceProject 聚合
      </p>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  padding: 20,
  border: "1px solid rgba(34,107,230,0.18)",
  borderRadius: 14,
  background: "rgba(255,255,255,0.72)",
};

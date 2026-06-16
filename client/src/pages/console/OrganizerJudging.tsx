export default function OrganizerJudging() {
  return (
    <div>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Organizer View — 评审与奖项</h1>
      <p style={{ color: "#53668d", marginBottom: 24 }}>
        评委分配 / 评审进度 / 奖项管理 / 榜单发布
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        <div style={cardStyle}><h3>评审进度</h3><p>—</p></div>
        <div style={cardStyle}><h3>奖项草稿</h3><p>—</p></div>
        <div style={cardStyle}><h3>榜单状态</h3><p>—</p></div>
      </div>

      <p style={{ color: "#53668d", fontSize: 13, marginTop: 24 }}>
        —— C（portfolio）实现：评委分配 + JudgingRecord + Award 管理 + 榜单发布
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

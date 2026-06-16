export default function ScreenConsole() {
  return (
    <div>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Screen Console</h1>
      <p style={{ color: "#53668d", marginBottom: 24 }}>
        赛事选择 / 展示模式 / 全屏输出 / Fallback
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 16 }}>
        <div style={cardStyle}><h3>Live</h3><p>—</p></div>
        <div style={cardStyle}><h3>Leaderboard</h3><p>—</p></div>
        <div style={cardStyle}><h3>Works</h3><p>—</p></div>
        <div style={cardStyle}><h3>Announcement</h3><p>—</p></div>
        <div style={cardStyle}><h3>Jumbotron</h3><p>—</p></div>
        <div style={cardStyle}><h3>全屏输出</h3><p>—</p></div>
      </div>

      <p style={{ color: "#53668d", fontSize: 13, marginTop: 24 }}>
        —— D（projection）实现
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

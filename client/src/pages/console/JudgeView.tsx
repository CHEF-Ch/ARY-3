export default function JudgeView() {
  return (
    <div>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Judge View</h1>
      <p style={{ color: "#53668d", marginBottom: 24 }}>
        分配作品 / 骑行摘要 / 评分表单 / 已提交评审
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
        <div style={cardStyle}><h3>待评审作品</h3><p>—</p></div>
        <div style={cardStyle}><h3>骑行摘要</h3><p>—</p></div>
        <div style={cardStyle}><h3>评分表单</h3><p>—</p></div>
        <div style={cardStyle}><h3>已提交评审</h3><p>—</p></div>
      </div>

      <p style={{ color: "#53668d", fontSize: 13, marginTop: 24 }}>
        —— C（portfolio）实现
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

export default function RiderView() {
  return (
    <div>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Rider View</h1>
      <p style={{ color: "#53668d", marginBottom: 24 }}>
        报名状态 / CA 接入 / 骑行状态 / 作品提交 / 评审结果 / 选手报告
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16 }}>
        <div style={cardStyle}><h3>报名状态</h3><p>—</p></div>
        <div style={cardStyle}><h3>CA 接入</h3><p>—</p></div>
        <div style={cardStyle}><h3>骑行状态</h3><p>—</p></div>
        <div style={cardStyle}><h3>作品提交</h3><p>—</p></div>
      </div>

      <p style={{ color: "#53668d", fontSize: 13, marginTop: 24 }}>
        —— B（race-mgmt）实现
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

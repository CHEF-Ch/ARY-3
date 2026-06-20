import { Link } from "react-router-dom";

export default function CooperationPage() {
  return (
    <div style={{ maxWidth: 860, margin: "0 auto" }}>
      <p style={{ color: "#075bec", fontSize: 13, fontWeight: 950, textTransform: "uppercase", marginBottom: 4 }}>Cooperation</p>
      <h1 style={{ fontSize: 42, fontWeight: 950, color: "#06164a", margin: "0 0 8px" }}>合作</h1>
      <p style={{ color: "#53668d", fontSize: 16, marginBottom: 32 }}>
        Agent Racing Yard 将开发者与 Coding Agent 协同完成任务的过程变成可观看、可评审、可沉淀的能力资产。
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 18, marginBottom: 32 }}>
        <section style={S.card}>
          <h2 style={S.title}>参赛</h2>
          <p style={S.body}>报名参加 Agent Racing 赛事。接入 CA、提交作品、获得评审反馈和骑行能力标签。</p>
          <Link to="/login" style={S.link}>注册成为骑手 →</Link>
        </section>
        <section style={S.card}>
          <h2 style={S.title}>办赛</h2>
          <p style={S.body}>围绕真实业务挑战创建 Agent Racing 赛道。管理报名、分配评委、发布赛果和复盘。</p>
          <Link to="/login" style={S.link}>注册主办方 →</Link>
        </section>
        <section style={S.card}>
          <h2 style={S.title}>赞助</h2>
          <p style={S.body}>支持赛题设计、奖项设置、导师点评和赛后公开资产沉淀。通过赛事发现人才和案例。</p>
          <Link to="/cooperation" style={S.link}>联系我们 →</Link>
        </section>
      </div>

      <section style={S.card}>
        <h2 style={S.title}>什么是 Agent Racing Yard</h2>
        <p style={S.body}>
          ARY 是面向 Agentic Development 时代的智能体骑行赛事平台。它通过赛事组织、过程展示、成果提交、评审总结和骑手档案，
          让 Agent Riding Skill 成为可观察、可展示、可评审、可证明的能力资产。
        </p>
      </section>
    </div>
  );
}

const S = {
  card: { padding: 24, border: "1px solid rgba(34,107,230,0.18)", borderRadius: 14, background: "rgba(255,255,255,0.72)", boxShadow: "0 8px 20px rgba(11,57,150,0.06)" } as React.CSSProperties,
  title: { fontSize: 20, fontWeight: 950, color: "#06164a", marginBottom: 10 } as React.CSSProperties,
  body: { color: "#53668d", fontSize: 15, lineHeight: 1.6, marginBottom: 12 } as React.CSSProperties,
  link: { color: "#075bec", fontWeight: 700, fontSize: 14, textDecoration: "none" } as React.CSSProperties,
};

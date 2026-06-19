import { Link, useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../App";

interface Race {
  id: string;
  slug: string;
  title: string;
  challenge: string;
  status: string;
  visibility: string;
  registrationOpensAt: string | null;
  registrationClosesAt: string | null;
  startsAt: string | null;
  endsAt: string | null;
  cta: { label: string; target: string };
}

interface Registration {
  id: string;
  raceId: string;
  raceSlug: string | null;
  raceTitle: string | null;
  status: string;
}

export default function RacePage() {
  const { slug } = useParams();
  const { user } = useAuth();
  const [race, setRace] = useState<Race | null>(null);
  const [myRegistration, setMyRegistration] = useState<Registration | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [actionMessage, setActionMessage] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/races/${slug}`, { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) throw new Error(res.status === 404 ? "未找到该赛事。" : "赛事加载失败。");
        return res.json();
      })
      .then((data) => {
        if (!active) return;
        setRace(data);
        setError("");
      })
      .catch((err) => {
        if (!active) return;
        setRace(null);
        setError(err.message || "赛事加载失败。");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [slug]);

  useEffect(() => {
    if (!user || !race) {
      setMyRegistration(null);
      return;
    }

    fetch("/registrations/me", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : []))
      .then((rows: Registration[]) => {
        setMyRegistration(rows.find((registration) => registration.raceId === race.id) || null);
      })
      .catch(() => setMyRegistration(null));
  }, [race, user]);

  const statusLabel = useMemo(() => (race ? formatRaceStatus(race.status) : ""), [race]);
  const stageHint = useMemo(() => (race ? getStageHint(race.status) : ""), [race]);

  const submitRegistration = async () => {
    if (!race) return;
    setActionMessage("正在提交报名...");
    const res = await fetch(`/races/${race.id}/registrations`, {
      method: "POST",
      credentials: "include",
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      setActionMessage(data?.error || "报名提交失败。");
      if (data?.registration) setMyRegistration(data.registration);
      return;
    }
    setMyRegistration(data);
    setActionMessage("报名已提交，等待主办方审核。");
  };

  if (loading) {
    return <PageShell><section style={panelStyle}><p style={muted}>正在加载赛事...</p></section></PageShell>;
  }

  if (error || !race) {
    return (
      <PageShell>
        <section style={panelStyle}>
          <h1 style={titleStyle}>赛事不可用</h1>
          <p style={muted}>{error || "未找到该赛事。"}</p>
          <Link to="/" style={secondaryLinkStyle}>返回赛事首页</Link>
        </section>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <section style={heroStyle}>
        <div>
          <div style={eyebrowStyle}>赛事 / {statusLabel}</div>
          <h1 style={titleStyle}>{race.title}</h1>
          <p style={summaryStyle}>{race.challenge || "赛题说明正在准备中。"}</p>
          <p style={stageHintStyle}>{stageHint}</p>
        </div>
        <RaceAction race={race} registration={myRegistration} user={user} onRegister={submitRegistration} />
      </section>

      <section style={gridStyle}>
        <Info label="公开状态" value={formatVisibility(race.visibility)} />
        <Info label="报名开始" value={formatDate(race.registrationOpensAt)} />
        <Info label="报名截止" value={formatDate(race.registrationClosesAt)} />
        <Info label="开赛时间" value={formatDate(race.startsAt)} />
        <Info label="结束时间" value={formatDate(race.endsAt)} />
        <Info label="我的报名" value={myRegistration ? formatRegistrationStatus(myRegistration.status) : (user ? "尚未报名" : "登录后可报名")} />
      </section>

      <section style={panelGridStyle}>
        <article style={panelStyle}>
          <h2 style={sectionTitleStyle}>当前阶段</h2>
          <p style={bodyTextStyle}>{getStageDescription(race.status)}</p>
        </article>
        <article style={panelStyle}>
          <h2 style={sectionTitleStyle}>赛事入口</h2>
          <div style={linkRowStyle}>
            <Link to={`/works?raceSlug=${race.slug}`} style={secondaryLinkStyle}>查看作品</Link>
            <Link to={`/races/${race.slug}/results`} style={secondaryLinkStyle}>查看赛果</Link>
          </div>
        </article>
      </section>

      {actionMessage ? <p style={messageStyle}>{actionMessage}</p> : null}
    </PageShell>
  );
}

function RaceAction({ race, registration, user, onRegister }: { race: Race; registration: Registration | null; user: unknown; onRegister: () => void }) {
  if (registration) {
    return <span style={statusPillStyle}>报名状态：{formatRegistrationStatus(registration.status)}</span>;
  }
  if (!user) {
    return <span style={statusPillStyle}>登录后可报名</span>;
  }
  if (race.status === "registration") {
    return <button type="button" onClick={onRegister} style={buttonStyle}>提交报名</button>;
  }
  return <Link to={race.cta.target} style={ctaStyle}>{formatCtaLabel(race.cta.label)}</Link>;
}

function PageShell({ children }: { children: React.ReactNode }) {
  return <div style={{ maxWidth: 1120, margin: "0 auto" }}>{children}</div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div style={infoStyle}>
      <div style={infoLabelStyle}>{label}</div>
      <div style={infoValueStyle}>{value}</div>
    </div>
  );
}

function formatDate(value: string | null) {
  if (!value) return "未设置";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function formatRaceStatus(value: string) {
  const labels: Record<string, string> = {
    draft: "草稿",
    published: "已发布",
    registration: "报名中",
    running: "进行中",
    submitting: "提交中",
    judging: "评审中",
    completed: "已结束",
    archived: "已归档",
  };
  return labels[value] || value;
}

function formatRegistrationStatus(value: string) {
  const labels: Record<string, string> = {
    submitted: "待审核",
    approved: "已通过",
    rejected: "未通过",
    withdrawn: "已撤回",
  };
  return labels[value] || value;
}

function formatVisibility(value: string) {
  return value === "public" ? "公开" : "私有";
}

function formatCtaLabel(value: string) {
  const labels: Record<string, string> = {
    "Register": "提交报名",
    "Open Live Hall": "进入实况大厅",
    "Review in progress": "查看评审进度",
    "View results": "查看赛果",
    "Archived": "查看归档",
    "View race": "查看赛事",
  };
  return labels[value] || value;
}

function getStageHint(status: string) {
  if (status === "registration") return "当前开放报名，审核通过后系统会自动生成参赛工作区。";
  if (status === "running") return "赛事进行中，Live Hall 和大屏优先展示过程投影。";
  if (status === "submitting") return "当前进入作品提交阶段，CA 接入异常不会阻断提交。";
  if (status === "judging") return "评委正在查看作品、证据摘要和评审前风险提示。";
  if (status === "completed") return "赛事已结束，公开端优先展示赛果、作品和评审总结。";
  return "赛事信息以主办方发布内容为准。";
}

function getStageDescription(status: string) {
  if (status === "registration") return "参赛者可以提交报名；主办方审核通过后，ARY 会幂等生成 RaceProject。";
  if (status === "running") return "参赛者可以在参赛过程中登记 CAConnection；只有完成握手且归属正确的连接数据会进入证据链。";
  if (status === "submitting") return "作品提交不以 CA 接入状态作为硬门禁；无 CA 数据或接入异常会进入评审前风险提示。";
  if (status === "judging") return "评审以作品、公开材料、证据摘要和风险提示为输入，不直接公开原始 CA Session。";
  if (status === "completed") return "最终结果来自 Award、Report 和公开 Evidence，不把过程 Projection 当作最终事实源。";
  return "主办方可以继续维护赛事信息，公开可见性由赛事状态和发布状态共同决定。";
}

const heroStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 32,
  alignItems: "flex-start",
  padding: 32,
  border: "1px solid rgba(34,107,230,0.16)",
  borderRadius: 8,
  background: "rgba(255,255,255,0.82)",
  boxShadow: "0 18px 50px rgba(26,74,140,0.08)",
};

const eyebrowStyle: React.CSSProperties = {
  color: "#226be6",
  fontSize: 13,
  fontWeight: 800,
};

const titleStyle: React.CSSProperties = {
  margin: "8px 0 12px",
  fontSize: 36,
  lineHeight: 1.1,
  color: "#06164a",
};

const summaryStyle: React.CSSProperties = {
  maxWidth: 680,
  color: "#445a83",
  lineHeight: 1.7,
};

const stageHintStyle: React.CSSProperties = {
  margin: "12px 0 0",
  color: "#075bec",
  fontWeight: 800,
};

const ctaStyle: React.CSSProperties = {
  flex: "0 0 auto",
  padding: "10px 16px",
  borderRadius: 8,
  background: "#0b5ee8",
  color: "white",
  fontWeight: 800,
  textDecoration: "none",
};

const buttonStyle: React.CSSProperties = {
  ...ctaStyle,
  border: "none",
  cursor: "pointer",
};

const statusPillStyle: React.CSSProperties = {
  flex: "0 0 auto",
  padding: "10px 14px",
  borderRadius: 8,
  border: "1px solid rgba(34,107,230,0.22)",
  color: "#0a3fb8",
  fontWeight: 800,
  background: "rgba(255,255,255,0.78)",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
  marginTop: 16,
};

const panelGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: 16,
  marginTop: 16,
};

const infoStyle: React.CSSProperties = {
  padding: 16,
  border: "1px solid rgba(34,107,230,0.14)",
  borderRadius: 8,
  background: "rgba(255,255,255,0.72)",
};

const panelStyle: React.CSSProperties = {
  padding: 20,
  border: "1px solid rgba(34,107,230,0.14)",
  borderRadius: 8,
  background: "rgba(255,255,255,0.72)",
};

const sectionTitleStyle: React.CSSProperties = {
  margin: "0 0 10px",
  fontSize: 20,
  color: "#06164a",
};

const bodyTextStyle: React.CSSProperties = {
  margin: 0,
  color: "#445a83",
  lineHeight: 1.7,
};

const infoLabelStyle: React.CSSProperties = {
  color: "#667899",
  fontSize: 12,
  fontWeight: 800,
};

const infoValueStyle: React.CSSProperties = {
  marginTop: 6,
  color: "#06164a",
  fontWeight: 800,
};

const linkRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 10,
  flexWrap: "wrap",
};

const secondaryLinkStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "8px 12px",
  border: "1px solid rgba(34,107,230,0.18)",
  borderRadius: 8,
  background: "rgba(255,255,255,0.64)",
  color: "#075bec",
  fontWeight: 800,
  textDecoration: "none",
};

const muted: React.CSSProperties = {
  color: "#53668d",
};

const messageStyle: React.CSSProperties = {
  color: "#0a3fb8",
  fontWeight: 800,
};

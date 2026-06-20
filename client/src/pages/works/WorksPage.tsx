import { Link, useParams, useSearchParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../App";
import type { RaceSummary, ReviewWarning, WorkResponse } from "../../shared/apiTypes";
import { requestJson } from "../../shared/apiTypes";

export default function WorksPage() {
  const { slug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user } = useAuth();
  const raceSlug = searchParams.get("raceSlug");
  const isDetail = Boolean(slug);
  const [works, setWorks] = useState<WorkResponse[]>([]);
  const [detailWork, setDetailWork] = useState<WorkResponse | null>(null);
  const [races, setRaces] = useState<RaceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Fetch races for the filter dropdown (once on mount)
  useEffect(() => {
    requestJson<RaceSummary[]>("/races")
      .then((data) => setRaces(Array.isArray(data) ? data : []))
      .catch(() => setRaces([])); // Dropdown silently degrades
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setDetailWork(null);

    if (isDetail && slug) {
      loadWorkDetail(slug)
        .then((work) => {
          if (!active) return;
          setDetailWork(work);
        })
        .catch((err) => {
          if (!active) return;
          setDetailWork(null);
          setError(err.message || "作品加载失败");
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => { active = false; };
    }

    const query = raceSlug ? `?raceSlug=${encodeURIComponent(raceSlug)}` : "";
    fetch(`/works${query}`, { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) throw new Error("作品列表加载失败");
        return res.json();
      })
      .then((data) => {
        if (!active) return;
        setWorks(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (!active) return;
        setWorks([]);
        setError(err.message || "作品列表加载失败");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [isDetail, raceSlug, slug]);

  const pageTitle = useMemo(() => {
    if (!raceSlug) return "作品";
    return `作品 / ${raceSlug}`;
  }, [raceSlug]);

  const raceMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const race of races) map[race.id] = race.title;
    return map;
  }, [races]);

  if (loading) {
    return (
      <PageShell>
        <section style={panelStyle}>
          <p style={muted}>正在加载作品数据...</p>
        </section>
      </PageShell>
    );
  }

  if (isDetail) {
    return (
      <PageShell>
        {error || !detailWork ? (
          <section style={panelStyle}>
            <div style={eyebrowStyle}>作品</div>
            <h1 style={titleStyle}>未找到作品</h1>
            <p style={muted}>{error || "请求的作品尚未公开，或当前账号没有查看权限。"}</p>
            <Link to="/works" style={secondaryLinkStyle}>返回作品列表</Link>
          </section>
        ) : (
          <WorkDetail work={detailWork} user={user} raceMap={raceMap} />
        )}
      </PageShell>
    );
  }

  return (
    <PageShell>
      <section style={heroStyle}>
        <div>
          <div style={eyebrowStyle}>作品集 / 公开作品</div>
          <h1 style={titleStyle}>{pageTitle}</h1>
          <p style={summaryStyle}>
            Agent Racing Yard 已公开的参赛作品。可按赛事筛选，集中查看同一场 Race 的作品集。
          </p>
        </div>
        <div style={filterStackStyle}>
          <div style={filterRowStyle}>
            <label style={filterLabelStyle}>赛事筛选</label>
            <select
              value={raceSlug || ""}
              onChange={(event) => {
                const value = event.target.value;
                if (value) setSearchParams({ raceSlug: value });
                else setSearchParams({});
              }}
              style={selectStyle}
            >
              <option value="">全部赛事</option>
              {races.map((race) => (
                <option key={race.slug} value={race.slug}>{race.title}</option>
              ))}
            </select>
          </div>
          {raceSlug ? (
            <Link to="/works" style={secondaryLinkStyle}>清除筛选</Link>
          ) : null}
        </div>
      </section>

      {error ? (
        <section style={panelStyle}>
          <h2 style={sectionTitleStyle}>加载失败</h2>
          <p style={muted}>{error}</p>
        </section>
      ) : works.length === 0 ? (
        <section style={panelStyle}>
          <h2 style={sectionTitleStyle}>暂无公开作品</h2>
          <p style={muted}>当前筛选下没有可展示的作品。</p>
        </section>
      ) : (
        <section style={gridStyle}>
          {works.map((work) => (
            <WorkCard key={work.id} work={work} raceMap={raceMap} />
          ))}
        </section>
      )}
    </PageShell>
  );
}

async function loadWorkDetail(slugOrId: string): Promise<WorkResponse> {
  const direct = await fetch(`/works/${encodeURIComponent(slugOrId)}`, { credentials: "include" });
  if (direct.ok) return direct.json();
  if (direct.status !== 404) throw new Error("作品详情加载失败");

  const list = await fetch("/works", { credentials: "include" });
  if (!list.ok) throw new Error("作品详情加载失败");
  const works = await list.json();
  if (!Array.isArray(works)) throw new Error("作品详情加载失败");
  const matched = works.find((work: WorkResponse) => work.slug === slugOrId || work.id === slugOrId);
  if (!matched) throw new Error("未找到作品");
  if (matched.id === slugOrId) return matched;

  const byId = await fetch(`/works/${encodeURIComponent(matched.id)}`, { credentials: "include" });
  if (!byId.ok) return matched;
  return byId.json();
}

function WorkCard({ work, raceMap }: { work: WorkResponse; raceMap: Record<string, string> }) {
  const raceLabel = raceMap[work.raceId] || work.raceId;
  return (
    <article style={cardStyle}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "flex-start" }}>
        <div>
          <div style={eyebrowStyle}>{raceLabel}</div>
          <h2 style={cardTitleStyle}>
            <Link to={`/works/${work.slug || work.id}`} style={titleLinkStyle}>{work.title}</Link>
          </h2>
        </div>
        <span style={statusStyle}>{formatStatus(work.status)}</span>
      </div>
      <p style={cardSummaryStyle}>{work.summary || "暂无摘要。"}</p>
      <InfoLine label="作者 ID" value={work.userId} />
      <InfoLine label="技术栈" value={work.techStack || "未填写"} />
      <div style={linkRowStyle}>
        {work.demoUrl ? <a href={work.demoUrl} style={primaryLinkStyle}>查看 Demo</a> : null}
        {work.repoUrl ? <a href={work.repoUrl} style={secondaryLinkStyle}>查看 Repo</a> : null}
      </div>
    </article>
  );
}

function WorkDetail({ work, user, raceMap }: { work: WorkResponse; user: any | null; raceMap: Record<string, string> }) {
  const canViewWarnings = canViewReviewWarnings(user, work);
  const techItems = splitTechStack(work.techStack);
  const raceLabel = raceMap[work.raceId] || work.raceId;

  return (
    <div>
      <section style={heroStyle}>
        <div>
          <div style={eyebrowStyle}>{raceLabel} / {formatStatus(work.status)}</div>
          <h1 style={titleStyle}>{work.title}</h1>
          <p style={summaryStyle}>{work.summary || "暂无摘要。"}</p>
        </div>
        <div style={actionStackStyle}>
          {work.demoUrl ? <a href={work.demoUrl} style={primaryLinkStyle}>打开 Demo</a> : null}
          {work.repoUrl ? <a href={work.repoUrl} style={secondaryLinkStyle}>查看 Repo</a> : null}
          {work.videoUrl ? <a href={work.videoUrl} style={secondaryLinkStyle}>观看视频</a> : null}
        </div>
      </section>

      <section style={detailGridStyle}>
        <article style={panelStyle}>
          <h2 style={sectionTitleStyle}>问题陈述</h2>
          <p style={bodyTextStyle}>{work.problemStatement || "暂无问题陈述。"}</p>
        </article>
        <article style={panelStyle}>
          <h2 style={sectionTitleStyle}>方案摘要</h2>
          <p style={bodyTextStyle}>{work.solutionSummary || "暂无方案摘要。"}</p>
        </article>
      </section>

      <section style={panelStyle}>
        <h2 style={sectionTitleStyle}>技术栈</h2>
        {techItems.length > 0 ? (
          <div style={tagWrapStyle}>
            {techItems.map((item) => <span key={item} style={tagStyle}>{item}</span>)}
          </div>
        ) : (
          <p style={muted}>未填写技术栈。</p>
        )}
      </section>

      <section style={metaGridStyle}>
        <InfoBlock label="报名 ID" value={work.registrationId} />
        <InfoBlock label="作者 ID" value={work.userId} />
        <InfoBlock label="公开时间" value={formatDate(work.publishedAt)} />
        <InfoBlock label="更新时间" value={formatDate(work.updatedAt)} />
      </section>

      {canViewWarnings ? (
        <section style={warningPanelStyle}>
          <h2 style={sectionTitleStyle}>评审前风险提示</h2>
          {work.reviewWarnings.length > 0 ? (
            <div style={{ display: "grid", gap: 10 }}>
              {work.reviewWarnings.map((warning) => (
                <div key={`${warning.registrationId}-${warning.code}`} style={warningItemStyle}>
                  <strong>{warning.code}</strong>
                  <p style={{ ...muted, margin: "6px 0 0" }}>{warning.message}</p>
                </div>
              ))}
            </div>
          ) : (
            <p style={muted}>当前作品没有评审前风险提示。</p>
          )}
        </section>
      ) : null}

      <Link to="/works" style={secondaryLinkStyle}>返回作品列表</Link>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div style={infoLineStyle}>
      <span style={infoLabelStyle}>{label}</span>
      <span style={infoValueStyle}>{value}</span>
    </div>
  );
}

function InfoBlock({ label, value }: { label: string; value: string }) {
  return (
    <div style={infoBlockStyle}>
      <div style={infoLabelStyle}>{label}</div>
      <div style={infoValueStyle}>{value}</div>
    </div>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return <div style={{ maxWidth: 1120, margin: "0 auto" }}>{children}</div>;
}

function canViewReviewWarnings(user: any | null, work: WorkResponse) {
  if (!user) return false;
  const roles = Array.isArray(user.roles) ? user.roles : [];
  return user.userId === work.userId || roles.includes("organizer") || roles.includes("judge");
}

function splitTechStack(value: string) {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function formatStatus(value: string) {
  const labels: Record<string, string> = {
    draft: "草稿",
    submitted: "已提交",
    locked: "已锁定",
    hidden: "已隐藏",
  };
  return labels[value] || value.replace(/_/g, " ");
}

function formatDate(value: string | null) {
  if (!value) return "未设置";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
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
  textTransform: "uppercase",
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

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
  gap: 16,
  marginTop: 18,
};

const cardStyle: React.CSSProperties = {
  padding: 20,
  border: "1px solid rgba(34,107,230,0.16)",
  borderRadius: 8,
  background: "rgba(255,255,255,0.76)",
  boxShadow: "0 12px 34px rgba(26,74,140,0.06)",
};

const cardTitleStyle: React.CSSProperties = {
  margin: "8px 0 0",
  fontSize: 22,
  lineHeight: 1.2,
};

const titleLinkStyle: React.CSSProperties = {
  color: "#06164a",
  textDecoration: "none",
};

const cardSummaryStyle: React.CSSProperties = {
  minHeight: 78,
  color: "#445a83",
  lineHeight: 1.6,
};

const statusStyle: React.CSSProperties = {
  flex: "0 0 auto",
  padding: "5px 9px",
  border: "1px solid rgba(34,107,230,0.18)",
  borderRadius: 8,
  background: "rgba(234,243,255,0.72)",
  color: "#075bec",
  fontSize: 12,
  fontWeight: 900,
};

const linkRowStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 10,
  marginTop: 16,
};

const primaryLinkStyle: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "9px 14px",
  borderRadius: 8,
  background: "#0b5ee8",
  color: "white",
  fontWeight: 800,
  textDecoration: "none",
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

const detailGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
  gap: 16,
  marginTop: 16,
};

const panelStyle: React.CSSProperties = {
  padding: 20,
  border: "1px solid rgba(34,107,230,0.14)",
  borderRadius: 8,
  background: "rgba(255,255,255,0.74)",
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

const tagWrapStyle: React.CSSProperties = {
  display: "flex",
  flexWrap: "wrap",
  gap: 8,
};

const tagStyle: React.CSSProperties = {
  padding: "6px 9px",
  border: "1px solid rgba(34,107,230,0.14)",
  borderRadius: 8,
  background: "rgba(234,243,255,0.66)",
  color: "#0a3fb8",
  fontSize: 13,
  fontWeight: 800,
};

const metaGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
  marginTop: 16,
};

const infoBlockStyle: React.CSSProperties = {
  padding: 16,
  border: "1px solid rgba(34,107,230,0.14)",
  borderRadius: 8,
  background: "rgba(255,255,255,0.72)",
};

const infoLineStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "88px 1fr",
  gap: 10,
  marginTop: 10,
  color: "#445a83",
  fontSize: 14,
};

const infoLabelStyle: React.CSSProperties = {
  color: "#667899",
  fontSize: 12,
  fontWeight: 800,
  textTransform: "uppercase",
};

const infoValueStyle: React.CSSProperties = {
  color: "#06164a",
  fontWeight: 800,
};

const actionStackStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
  minWidth: 140,
};

const warningPanelStyle: React.CSSProperties = {
  ...panelStyle,
  margin: "16px 0",
  border: "1px solid rgba(186,112,0,0.28)",
  background: "rgba(255,249,235,0.84)",
};

const warningItemStyle: React.CSSProperties = {
  padding: 12,
  borderRadius: 8,
  background: "rgba(255,255,255,0.72)",
  color: "#7a4a00",
};

const filterStackStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 10,
  alignItems: "flex-end",
  minWidth: 200,
};

const filterRowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 10,
};

const filterLabelStyle: React.CSSProperties = {
  color: "#53668d",
  fontSize: 13,
  fontWeight: 800,
  whiteSpace: "nowrap",
};

const selectStyle: React.CSSProperties = {
  padding: "8px 12px",
  border: "1px solid rgba(34,107,230,0.18)",
  borderRadius: 8,
  background: "rgba(255,255,255,0.82)",
  color: "#06164a",
  fontSize: 14,
  minWidth: 220,
};

const muted: React.CSSProperties = {
  margin: 0,
  color: "#53668d",
};

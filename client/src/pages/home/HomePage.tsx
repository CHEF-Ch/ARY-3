import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { ProjectionResponse, RaceProgressData } from "../../shared/apiTypes";
import { requestJson } from "../../shared/apiTypes";

interface RaceSummaryCard {
  id: string;
  slug: string;
  title: string;
  challenge: string;
  status: string;
  visibility: string;
  cta?: { label: string; target: string };
}

export default function HomePage() {
  const [races, setRaces] = useState<RaceSummaryCard[]>([]);
  const [projections, setProjections] = useState<Record<string, RaceProgressData>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    requestJson<RaceSummaryCard[]>("/races")
      .then(async (raceRows) => {
        if (!active) return;
        setRaces(Array.isArray(raceRows) ? raceRows : []);
        const visible = (Array.isArray(raceRows) ? raceRows : []).slice(0, 4);
        const results = await Promise.allSettled(
          visible.map((race) => requestJson<ProjectionResponse<RaceProgressData>>(`/projections/${encodeURIComponent(race.id)}/race_progress`)),
        );
        if (!active) return;
        const next: Record<string, RaceProgressData> = {};
        results.forEach((result, index) => {
          if (result.status === "fulfilled") {
            next[visible[index].id] = result.value.data;
          }
        });
        setProjections(next);
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || "赛事列表加载失败。");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <PageShell><section style={panelStyle}><p style={mutedStyle}>正在加载 Race Gallery...</p></section></PageShell>;
  }

  return (
    <PageShell>
      <section style={heroStyle}>
        <div>
          <div style={eyebrowStyle}>Gallery-first / Race Gallery</div>
          <h1 style={titleStyle}>Agent Racing Yard</h1>
          <p style={summaryStyle}>
            首页展示赛事资产，而不是后台入口。这里优先回答三件事：现在有什么比赛、哪场正在进行、观众下一步去哪里看。
          </p>
        </div>
        <div style={heroNoteStyle}>
          <div style={heroMetricStyle}>{races.length}</div>
          <p style={mutedStyle}>当前可浏览赛事</p>
        </div>
      </section>

      {error ? (
        <section style={panelStyle}>
          <h2 style={sectionTitleStyle}>加载失败</h2>
          <p style={mutedStyle}>{error}</p>
        </section>
      ) : races.length === 0 ? (
        <section style={panelStyle}>
          <h2 style={sectionTitleStyle}>暂无赛事</h2>
          <p style={mutedStyle}>公开赛事还没有准备好，稍后再来看看。</p>
        </section>
      ) : (
        <section style={gridStyle}>
          {races.map((race) => {
            const progress = projections[race.id];
            return (
              <article key={race.id} style={cardStyle}>
                <div style={{ display: "flex", justifyContent: "space-between", gap: 16, alignItems: "start" }}>
                  <div>
                    <div style={eyebrowStyle}>{formatRaceStatus(race.status)}</div>
                    <h2 style={cardTitleStyle}>{race.title}</h2>
                  </div>
                  <span style={pillStyle}>{race.visibility === "public" ? "公开" : "私有"}</span>
                </div>
                <p style={cardSummaryStyle}>{race.challenge || "赛题说明待补充。"}</p>
                <div style={metricsGridStyle}>
                  <Metric label="报名" value={String(progress?.counts.approvedRegistrations ?? 0)} />
                  <Metric label="作品" value={String(progress?.counts.worksSubmitted ?? 0)} />
                  <Metric label="Session" value={String(progress?.counts.sessionCount ?? 0)} />
                  <Metric label="奖项" value={String(progress?.counts.awardsPublished ?? 0)} />
                </div>
                <div style={linkRowStyle}>
                  <Link to={`/races/${race.slug}`} style={primaryLinkStyle}>进入赛事</Link>
                  <Link to={`/races/${race.slug}/live`} style={secondaryLinkStyle}>进入 Live Hall</Link>
                  <Link to={`/races/${race.slug}/results`} style={secondaryLinkStyle}>查看赛果</Link>
                </div>
              </article>
            );
          })}
        </section>
      )}
    </PageShell>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div style={metricCardStyle}>
      <div style={metricValueStyle}>{value}</div>
      <div style={metricLabelStyle}>{label}</div>
    </div>
  );
}

function formatRaceStatus(status: string) {
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
  return labels[status] || status;
}

function PageShell({ children }: { children: React.ReactNode }) {
  return <div style={{ maxWidth: 1180, margin: "0 auto" }}>{children}</div>;
}

const heroStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 24,
  alignItems: "stretch",
  padding: 32,
  borderRadius: 12,
  border: "1px solid rgba(34,107,230,0.16)",
  background: "linear-gradient(135deg, rgba(255,255,255,0.94), rgba(230,241,255,0.88))",
  boxShadow: "0 20px 55px rgba(26,74,140,0.08)",
};

const heroNoteStyle: React.CSSProperties = {
  minWidth: 180,
  padding: 24,
  borderRadius: 12,
  background: "rgba(7,91,236,0.08)",
  display: "grid",
  alignContent: "center",
};

const heroMetricStyle: React.CSSProperties = {
  fontSize: 42,
  fontWeight: 900,
  color: "#075bec",
};

const eyebrowStyle: React.CSSProperties = {
  color: "#226be6",
  fontSize: 12,
  fontWeight: 900,
  textTransform: "uppercase",
  letterSpacing: 0.8,
};

const titleStyle: React.CSSProperties = {
  margin: "10px 0 12px",
  fontSize: 40,
  lineHeight: 1.08,
  color: "#06164a",
};

const summaryStyle: React.CSSProperties = {
  maxWidth: 720,
  margin: 0,
  color: "#445a83",
  lineHeight: 1.7,
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
  gap: 16,
  marginTop: 18,
};

const cardStyle: React.CSSProperties = {
  padding: 22,
  borderRadius: 12,
  border: "1px solid rgba(34,107,230,0.14)",
  background: "rgba(255,255,255,0.78)",
  display: "grid",
  gap: 14,
};

const cardTitleStyle: React.CSSProperties = {
  margin: "6px 0 0",
  fontSize: 24,
  color: "#06164a",
};

const cardSummaryStyle: React.CSSProperties = {
  margin: 0,
  color: "#53668d",
  lineHeight: 1.7,
};

const metricsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 10,
};

const metricCardStyle: React.CSSProperties = {
  padding: 12,
  borderRadius: 10,
  background: "rgba(238,246,255,0.9)",
  border: "1px solid rgba(34,107,230,0.10)",
};

const metricValueStyle: React.CSSProperties = {
  color: "#06164a",
  fontSize: 20,
  fontWeight: 900,
};

const metricLabelStyle: React.CSSProperties = {
  color: "#667899",
  fontSize: 12,
  fontWeight: 800,
};

const linkRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
};

const primaryLinkStyle: React.CSSProperties = {
  textDecoration: "none",
  padding: "10px 14px",
  borderRadius: 999,
  background: "#075bec",
  color: "#ffffff",
  fontWeight: 800,
};

const secondaryLinkStyle: React.CSSProperties = {
  textDecoration: "none",
  padding: "10px 14px",
  borderRadius: 999,
  background: "rgba(7,91,236,0.08)",
  color: "#075bec",
  fontWeight: 800,
};

const pillStyle: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 999,
  background: "rgba(7,91,236,0.08)",
  color: "#075bec",
  fontWeight: 800,
  fontSize: 12,
};

const panelStyle: React.CSSProperties = {
  padding: 20,
  marginTop: 16,
  borderRadius: 12,
  border: "1px solid rgba(34,107,230,0.12)",
  background: "rgba(255,255,255,0.78)",
};

const sectionTitleStyle: React.CSSProperties = {
  margin: "0 0 10px",
  fontSize: 20,
  color: "#06164a",
};

const mutedStyle: React.CSSProperties = {
  margin: 0,
  color: "#53668d",
};

import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import type { ProjectionResponse, ResultsPageReadModelData } from "../../shared/apiTypes";
import { requestJson } from "../../shared/apiTypes";

export default function ResultsPage() {
  const { slug } = useParams();
  const [model, setModel] = useState<ResultsPageReadModelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setModel(null);

    if (!slug) {
      setError("缺少 Race slug。");
      setLoading(false);
      return () => { active = false; };
    }

    requestJson<any>(`/races/${encodeURIComponent(slug)}`)
      .then((raceData) => requestJson<ProjectionResponse<ResultsPageReadModelData>>(`/projections/${encodeURIComponent(raceData.id)}/results_page_read_model`))
      .then((response) => {
        if (!active) return;
        setModel(response.data);
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || "榜单加载失败。");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [slug]);

  if (loading) {
    return (
      <PageShell>
        <section style={panelStyle}>
          <p style={muted}>正在加载最终榜单...</p>
        </section>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <section style={heroStyle}>
        <div>
          <div style={eyebrowStyle}>赛果 / {model?.race.slug || slug || "未指定 Race"}</div>
          <h1 style={titleStyle}>{model?.race.title || "最终榜单"}</h1>
          <p style={summaryStyle}>
            当前页读取 `results_page_read_model`：最终榜单来自 `Award + leaderboard_read_model`，不混入过程榜单。
          </p>
          {model ? (
            <p style={boundaryNoteStyle}>
              {model.boundaries.finalResultsSource}；{model.review.message}
            </p>
          ) : null}
        </div>
      </section>

      {error ? (
        <section style={panelStyle}>
          <h2 style={sectionTitleStyle}>加载失败</h2>
          <p style={muted}>{error}</p>
        </section>
      ) : !model || model.leaderboard.groups.length === 0 ? (
        <section style={panelStyle}>
          <h2 style={sectionTitleStyle}>暂无已发布奖项</h2>
          <p style={muted}>当前 Race 还没有可公开展示的榜单。</p>
        </section>
      ) : (
        <div style={groupStackStyle}>
          {model.leaderboard.groups.map((group) => (
            <section key={group.awardName} style={panelStyle}>
              <div style={sectionHeaderStyle}>
                <h2 style={sectionTitleStyle}>{group.awardName}</h2>
                <span style={countStyle}>{group.items.length} 条记录</span>
              </div>
              <div style={tableStyle}>
                <div style={tableHeaderStyle}>
                  <span>名次</span>
                  <span>报名 ID</span>
                  <span>作品 ID</span>
                  <span>评审理由</span>
                </div>
                {group.items.map((award) => (
                  <div key={award.awardId} style={tableRowStyle}>
                    <span style={rankStyle}>#{award.rank}</span>
                    <span>{award.registrationId}</span>
                    <span>{award.workId || "未绑定作品"}</span>
                    <span style={reasonStyle}>{award.decisionReason || "暂无说明。"}</span>
                  </div>
                ))}
              </div>
            </section>
          ))}

          <section style={panelStyle}>
            <div style={sectionHeaderStyle}>
              <h2 style={sectionTitleStyle}>Winning Works</h2>
              <span style={countStyle}>{model.winningWorks.length} 个公开作品</span>
            </div>
            {model.winningWorks.length === 0 ? (
              <p style={muted}>当前没有可公开展示的获奖作品。</p>
            ) : (
              <div style={winningWorksGridStyle}>
                {model.winningWorks.map((work) => (
                  <article key={work.workId} style={winningWorkCardStyle}>
                    <h3 style={winningWorkTitleStyle}>{work.title}</h3>
                    <p style={reasonStyle}>{work.summary || "暂无摘要。"}</p>
                    <p style={tinyStyle}>奖项：{work.awardNames.join(" / ")}</p>
                    <p style={tinyStyle}>slug：{work.slug}</p>
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return <div style={{ maxWidth: 1120, margin: "0 auto" }}>{children}</div>;
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

const boundaryNoteStyle: React.CSSProperties = {
  marginTop: 12,
  color: "#075bec",
  fontWeight: 700,
};

const groupStackStyle: React.CSSProperties = {
  display: "grid",
  gap: 16,
  marginTop: 16,
};

const panelStyle: React.CSSProperties = {
  padding: 20,
  border: "1px solid rgba(34,107,230,0.14)",
  borderRadius: 8,
  background: "rgba(255,255,255,0.74)",
};

const sectionHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 16,
  alignItems: "center",
  marginBottom: 12,
};

const sectionTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 20,
  color: "#06164a",
};

const countStyle: React.CSSProperties = {
  color: "#53668d",
  fontSize: 13,
  fontWeight: 800,
};

const tableStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
};

const tableHeaderStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "80px 180px 180px 1fr",
  gap: 12,
  padding: "8px 10px",
  color: "#667899",
  fontSize: 12,
  fontWeight: 900,
  textTransform: "uppercase",
  borderBottom: "1px solid rgba(34,107,230,0.12)",
};

const tableRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "80px 180px 180px 1fr",
  gap: 12,
  alignItems: "start",
  padding: "12px 10px",
  border: "1px solid rgba(34,107,230,0.10)",
  borderRadius: 8,
  background: "rgba(255,255,255,0.68)",
  color: "#06164a",
};

const rankStyle: React.CSSProperties = {
  color: "#075bec",
  fontWeight: 900,
};

const reasonStyle: React.CSSProperties = {
  color: "#445a83",
  lineHeight: 1.6,
};

const winningWorksGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 12,
};

const winningWorkCardStyle: React.CSSProperties = {
  padding: 16,
  borderRadius: 8,
  border: "1px solid rgba(34,107,230,0.10)",
  background: "rgba(255,255,255,0.68)",
};

const winningWorkTitleStyle: React.CSSProperties = {
  margin: "0 0 8px",
  color: "#06164a",
  fontSize: 18,
};

const tinyStyle: React.CSSProperties = {
  margin: "8px 0 0",
  color: "#667899",
  fontSize: 12,
};

const muted: React.CSSProperties = {
  margin: 0,
  color: "#53668d",
};

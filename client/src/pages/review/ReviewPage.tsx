import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type { ProjectionResponse, ReviewSummaryReadModelData } from "../../shared/apiTypes";
import { requestJson } from "../../shared/apiTypes";

export default function ReviewPage() {
  const { slug } = useParams();
  const [model, setModel] = useState<ReviewSummaryReadModelData | null>(null);
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
      .then((raceData) => requestJson<ProjectionResponse<ReviewSummaryReadModelData>>(`/projections/${encodeURIComponent(raceData.id)}/review_summary_read_model`))
      .then((response) => {
        if (!active) return;
        setModel(response.data);
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || "Review 读取失败。");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => { active = false; };
  }, [slug]);

  if (loading) {
    return <PageShell><section style={panelStyle}><p style={mutedStyle}>正在加载 Review...</p></section></PageShell>;
  }

  if (error || !model) {
    return (
      <PageShell>
        <section style={panelStyle}>
          <h1 style={titleStyle}>Review 不可用</h1>
          <p style={mutedStyle}>{error || "当前没有可读取的 Review 数据。"}</p>
        </section>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <section style={heroStyle}>
        <div>
          <div style={eyebrowStyle}>Review / {model.race.slug}</div>
          <h1 style={titleStyle}>{model.race.title}</h1>
          <p style={summaryStyle}>{model.report.message}</p>
        </div>
      </section>

      {model.report.available && model.report.report ? (
        <section style={panelStyle}>
          <h2 style={sectionTitleStyle}>{model.report.report.title}</h2>
          <p style={summaryStyle}>{model.report.report.summary || "暂无摘要。"}</p>
          <pre style={markdownBlockStyle}>{model.report.report.bodyMarkdown || "暂无正文。"}</pre>
        </section>
      ) : (
        <section style={panelStyle}>
          <h2 style={sectionTitleStyle}>Review Summary 尚未发布</h2>
          <p style={mutedStyle}>
            当前先回退展示联调可用的赛后资产：Award、Winning Works，以及前往 Results / Works 的公开入口。
          </p>
          <div style={linkRowStyle}>
            <Link to={model.nextEntries.resultsPath} style={primaryLinkStyle}>查看 Results</Link>
            <Link to={model.nextEntries.worksPath} style={secondaryLinkStyle}>查看 Works</Link>
          </div>
        </section>
      )}

      <section style={panelStyle}>
        <div style={sectionHeaderStyle}>
          <h2 style={sectionTitleStyle}>Award Snapshot</h2>
          <span style={countStyle}>{model.awards.length} 条</span>
        </div>
        {model.awards.length === 0 ? (
          <p style={mutedStyle}>当前没有可公开展示的 Award。</p>
        ) : (
          <div style={awardListStyle}>
            {model.awards.map((award) => (
              <div key={award.awardId} style={awardRowStyle}>
                <strong>{award.awardName}</strong>
                <span>#{award.rank}</span>
                <span>{award.registrationId}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section style={panelStyle}>
        <div style={sectionHeaderStyle}>
          <h2 style={sectionTitleStyle}>Winning Works</h2>
          <span style={countStyle}>{model.winningWorks.length} 个</span>
        </div>
        {model.winningWorks.length === 0 ? (
          <p style={mutedStyle}>当前没有可公开展示的获奖作品。</p>
        ) : (
          <div style={worksGridStyle}>
            {model.winningWorks.map((work) => (
              <article key={work.workId} style={workCardStyle}>
                <h3 style={workTitleStyle}>{work.title}</h3>
                <p style={mutedStyle}>{work.summary || "暂无摘要。"}</p>
                <p style={chipTextStyle}>{work.awardNames.join(" / ")}</p>
              </article>
            ))}
          </div>
        )}
      </section>
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return <div style={{ maxWidth: 1120, margin: "0 auto" }}>{children}</div>;
}

const heroStyle: React.CSSProperties = {
  padding: 32,
  borderRadius: 8,
  border: "1px solid rgba(34,107,230,0.16)",
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
  color: "#445a83",
  lineHeight: 1.7,
};

const panelStyle: React.CSSProperties = {
  padding: 20,
  border: "1px solid rgba(34,107,230,0.14)",
  borderRadius: 8,
  background: "rgba(255,255,255,0.74)",
  marginTop: 16,
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

const linkRowStyle: React.CSSProperties = {
  display: "flex",
  gap: 12,
  flexWrap: "wrap",
  marginTop: 12,
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

const markdownBlockStyle: React.CSSProperties = {
  whiteSpace: "pre-wrap",
  margin: 0,
  padding: 16,
  borderRadius: 8,
  background: "rgba(238,246,255,0.92)",
  color: "#06164a",
  lineHeight: 1.7,
};

const awardListStyle: React.CSSProperties = {
  display: "grid",
  gap: 8,
};

const awardRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 90px 1fr",
  gap: 12,
  padding: "12px 10px",
  border: "1px solid rgba(34,107,230,0.10)",
  borderRadius: 8,
  background: "rgba(255,255,255,0.68)",
  color: "#06164a",
};

const worksGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
  gap: 12,
};

const workCardStyle: React.CSSProperties = {
  padding: 16,
  borderRadius: 8,
  border: "1px solid rgba(34,107,230,0.10)",
  background: "rgba(255,255,255,0.68)",
};

const workTitleStyle: React.CSSProperties = {
  margin: "0 0 8px",
  color: "#06164a",
  fontSize: 18,
};

const chipTextStyle: React.CSSProperties = {
  margin: "8px 0 0",
  color: "#075bec",
  fontSize: 12,
  fontWeight: 800,
};

const mutedStyle: React.CSSProperties = {
  margin: 0,
  color: "#53668d",
};

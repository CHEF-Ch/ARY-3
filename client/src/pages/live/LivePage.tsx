import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type {
  CurrentLeaderboardData,
  ProjectionResponse,
  RaceProgressData,
  RegistrationStatusData,
  RiskProjectionData,
  ScreenFeedData,
} from "../../shared/apiTypes";
import { requestJson } from "../../shared/apiTypes";

interface RaceResponse {
  id: string;
  slug: string;
  title: string;
  status: string;
}

export default function LivePage() {
  const { slug } = useParams();
  const [race, setRace] = useState<RaceResponse | null>(null);
  const [progressMeta, setProgressMeta] = useState<ProjectionResponse<RaceProgressData> | null>(null);
  const [progress, setProgress] = useState<RaceProgressData | null>(null);
  const [registrationStatus, setRegistrationStatus] = useState<RegistrationStatusData | null>(null);
  const [risk, setRisk] = useState<RiskProjectionData | null>(null);
  const [leaderboard, setLeaderboard] = useState<CurrentLeaderboardData | null>(null);
  const [screenFeed, setScreenFeed] = useState<ScreenFeedData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    if (!slug) {
      setError("缺少 Race slug。");
      setLoading(false);
      return () => {
        active = false;
      };
    }

    requestJson<RaceResponse>(`/races/${encodeURIComponent(slug)}`)
      .then(async (raceData) => {
        if (!active) return;
        setRace(raceData);
        const [progressRes, registrationRes, riskRes, leaderboardRes, feedRes] = await Promise.all([
          requestJson<ProjectionResponse<RaceProgressData>>(`/projections/${encodeURIComponent(raceData.id)}/race_progress`),
          requestJson<ProjectionResponse<RegistrationStatusData>>(`/projections/${encodeURIComponent(raceData.id)}/registration_status`),
          requestJson<ProjectionResponse<RiskProjectionData>>(`/projections/${encodeURIComponent(raceData.id)}/risk`),
          requestJson<ProjectionResponse<CurrentLeaderboardData>>(`/projections/${encodeURIComponent(raceData.id)}/current_leaderboard`),
          requestJson<ProjectionResponse<ScreenFeedData>>(`/projections/${encodeURIComponent(raceData.id)}/screen_feed`),
        ]);
        if (!active) return;
        setProgressMeta(progressRes);
        setProgress(progressRes.data);
        setRegistrationStatus(registrationRes.data);
        setRisk(riskRes.data);
        setLeaderboard(leaderboardRes.data);
        setScreenFeed(feedRes.data);
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || "Live Hall 加载失败。");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [slug]);

  if (loading) {
    return <PageShell><section style={panelStyle}><p style={muted}>正在加载 Live Hall...</p></section></PageShell>;
  }

  if (error || !race || !progress) {
    return (
      <PageShell>
        <section style={panelStyle}>
          <h1 style={titleStyle}>Live Hall 不可用</h1>
          <p style={muted}>{error || "过程投影尚未准备好。"}</p>
          <Link to="/" style={secondaryLinkStyle}>返回首页</Link>
        </section>
      </PageShell>
    );
  }

  const announcementCount = screenFeed?.items.filter((item) => item.feedItemType === "announcement").length || 0;

  return (
    <PageShell>
      <section style={heroStyle}>
        <div>
          <div style={eyebrowStyle}>Live Hall / {progress.stageLabel}</div>
          <h1 style={titleStyle}>{race.title}</h1>
          <p style={summaryStyle}>{progress.headline}</p>
          <p style={noteStyle}>{progress.note}</p>
          {progressMeta?.usingStableFallback ? (
            <p style={fallbackNoteStyle}>
              当前读取的是最近一次稳定 Projection。原因：{progressMeta.fallbackReason || "最新投影暂不可用。"}
            </p>
          ) : progressMeta?.usingStaticFallback ? (
            <p style={fallbackNoteStyle}>
              当前读取的是静态 fallback。原因：{progressMeta.fallbackReason || "实时投影与稳定快照都不可用。"}
            </p>
          ) : null}
        </div>
        <div style={heroMetaStyle}>
          <div style={heroNumberStyle}>{progress.counts.sessionCount}</div>
          <p style={muted}>有效 Session</p>
        </div>
      </section>

      <section style={metricGridStyle}>
        <MetricCard label="已通过报名" value={String(progress.counts.approvedRegistrations)} />
        <MetricCard label="已提交作品" value={String(progress.counts.worksSubmitted)} />
        <MetricCard label="活跃连接" value={String(progress.counts.activeConnections)} />
        <MetricCard label="风险项" value={String(risk?.counts.total || 0)} />
        <MetricCard label="工具调用" value={String(progress.totals.toolCallCount)} />
        <MetricCard label="公告" value={String(announcementCount)} />
      </section>

      <div style={contentGridStyle}>
        <section style={panelStyle}>
          <div style={sectionHeaderStyle}>
            <h2 style={sectionTitleStyle}>事件流</h2>
            <span style={badgeStyle}>{progress.eventStream.length} 条</span>
          </div>
          <div style={stackStyle}>
            {progress.eventStream.length === 0 ? (
              <p style={muted}>暂无过程事件。</p>
            ) : progress.eventStream.map((event) => (
              <article key={event.id} style={timelineItemStyle}>
                <div style={timelineTimeStyle}>{formatDateTime(event.time)}</div>
                <div style={timelineTextStyle}>{event.text}</div>
              </article>
            ))}
          </div>
        </section>

        <section style={panelStyle}>
          <div style={sectionHeaderStyle}>
            <h2 style={sectionTitleStyle}>过程榜单</h2>
            <span style={badgeStyle}>非最终赛果</span>
          </div>
          <div style={stackStyle}>
            {leaderboard?.items.length ? leaderboard.items.slice(0, 6).map((item) => (
              <div key={item.registrationId} style={leaderboardRowStyle}>
                <div>
                  <div style={rankStyle}>#{item.rank}</div>
                  <div style={leaderboardTitleStyle}>{item.workTitle}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={scoreStyle}>{item.processScore.toFixed(1)}</div>
                  <div style={tinyStyle}>{item.aggregateIngestionStatus} / {item.sessionCount} sessions</div>
                </div>
              </div>
            )) : <p style={muted}>过程榜单尚无可展示数据。</p>}
          </div>
        </section>
      </div>

      <div style={contentGridStyle}>
        <section style={panelStyle}>
          <div style={sectionHeaderStyle}>
            <h2 style={sectionTitleStyle}>Rider 状态</h2>
            <span style={badgeStyle}>{registrationStatus?.registrations.length || 0} 人</span>
          </div>
          <div style={stackStyle}>
            {registrationStatus?.registrations.length ? registrationStatus.registrations.slice(0, 8).map((item) => (
              <div key={item.registrationId} style={statusRowStyle}>
                <div>
                  <div style={leaderboardTitleStyle}>{item.riderName}</div>
                  <div style={tinyStyle}>{item.status} / {item.workStatus}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={tinyStyle}>{item.aggregateIngestionStatus}</div>
                  <div style={tinyStyle}>{item.sessionCount} sessions</div>
                </div>
              </div>
            )) : <p style={muted}>暂无报名状态数据。</p>}
          </div>
        </section>

        <section style={panelStyle}>
          <div style={sectionHeaderStyle}>
            <h2 style={sectionTitleStyle}>风险提示</h2>
            <span style={badgeStyle}>{risk?.counts.total || 0}</span>
          </div>
          <div style={stackStyle}>
            {risk?.items.length ? risk.items.map((item, index) => (
              <article key={`${item.code}-${index}`} style={riskItemStyle}>
                <div style={riskTitleStyle}>{item.title}</div>
                <div style={tinyStyle}>{item.message}</div>
              </article>
            )) : <p style={muted}>当前没有需要提醒的风险。</p>}
          </div>
        </section>
      </div>
    </PageShell>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <article style={metricCardStyle}>
      <div style={metricValueStyle}>{value}</div>
      <div style={metricLabelStyle}>{label}</div>
    </article>
  );
}

function formatDateTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function PageShell({ children }: { children: React.ReactNode }) {
  return <div style={{ maxWidth: 1180, margin: "0 auto" }}>{children}</div>;
}

const heroStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 24,
  padding: 32,
  border: "1px solid rgba(34,107,230,0.16)",
  borderRadius: 12,
  background: "linear-gradient(135deg, rgba(255,255,255,0.94), rgba(225,242,255,0.9))",
  boxShadow: "0 20px 55px rgba(26,74,140,0.08)",
};

const heroMetaStyle: React.CSSProperties = {
  minWidth: 180,
  padding: 24,
  borderRadius: 12,
  background: "rgba(7,91,236,0.08)",
  display: "grid",
  alignContent: "center",
};

const heroNumberStyle: React.CSSProperties = {
  fontSize: 40,
  fontWeight: 900,
  color: "#075bec",
};

const eyebrowStyle: React.CSSProperties = {
  color: "#226be6",
  fontSize: 12,
  fontWeight: 900,
  textTransform: "uppercase",
};

const titleStyle: React.CSSProperties = {
  margin: "8px 0 12px",
  fontSize: 38,
  lineHeight: 1.08,
  color: "#06164a",
};

const summaryStyle: React.CSSProperties = {
  margin: 0,
  maxWidth: 720,
  color: "#445a83",
  lineHeight: 1.7,
};

const noteStyle: React.CSSProperties = {
  margin: "12px 0 0",
  color: "#075bec",
  fontWeight: 700,
};

const fallbackNoteStyle: React.CSSProperties = {
  margin: "12px 0 0",
  color: "#b94a00",
  fontWeight: 700,
};

const metricGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
  gap: 12,
  marginTop: 18,
};

const metricCardStyle: React.CSSProperties = {
  padding: 18,
  borderRadius: 12,
  border: "1px solid rgba(34,107,230,0.12)",
  background: "rgba(255,255,255,0.82)",
};

const metricValueStyle: React.CSSProperties = {
  color: "#06164a",
  fontSize: 24,
  fontWeight: 900,
};

const metricLabelStyle: React.CSSProperties = {
  color: "#667899",
  fontSize: 12,
  fontWeight: 800,
};

const contentGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1.2fr) minmax(0, 0.8fr)",
  gap: 16,
  marginTop: 16,
};

const panelStyle: React.CSSProperties = {
  padding: 20,
  borderRadius: 12,
  border: "1px solid rgba(34,107,230,0.12)",
  background: "rgba(255,255,255,0.8)",
};

const sectionHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  marginBottom: 14,
};

const sectionTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 20,
  color: "#06164a",
};

const badgeStyle: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: 999,
  background: "rgba(7,91,236,0.08)",
  color: "#075bec",
  fontSize: 12,
  fontWeight: 800,
};

const stackStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const timelineItemStyle: React.CSSProperties = {
  display: "grid",
  gap: 4,
  padding: 12,
  borderRadius: 10,
  background: "rgba(238,246,255,0.92)",
};

const timelineTimeStyle: React.CSSProperties = {
  color: "#226be6",
  fontSize: 12,
  fontWeight: 800,
};

const timelineTextStyle: React.CSSProperties = {
  color: "#06164a",
  lineHeight: 1.6,
};

const leaderboardRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  padding: 12,
  borderRadius: 10,
  background: "rgba(238,246,255,0.92)",
};

const rankStyle: React.CSSProperties = {
  color: "#226be6",
  fontWeight: 900,
  fontSize: 18,
};

const leaderboardTitleStyle: React.CSSProperties = {
  color: "#06164a",
  fontWeight: 800,
};

const scoreStyle: React.CSSProperties = {
  color: "#06164a",
  fontSize: 22,
  fontWeight: 900,
};

const statusRowStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 12,
  alignItems: "center",
  padding: 12,
  borderRadius: 10,
  background: "rgba(238,246,255,0.92)",
};

const riskItemStyle: React.CSSProperties = {
  padding: 12,
  borderRadius: 10,
  border: "1px solid rgba(236,111,7,0.18)",
  background: "rgba(255,245,232,0.92)",
};

const riskTitleStyle: React.CSSProperties = {
  color: "#7a3d00",
  fontWeight: 800,
  marginBottom: 4,
};

const secondaryLinkStyle: React.CSSProperties = {
  display: "inline-block",
  textDecoration: "none",
  padding: "10px 14px",
  borderRadius: 999,
  background: "rgba(7,91,236,0.08)",
  color: "#075bec",
  fontWeight: 800,
};

const tinyStyle: React.CSSProperties = {
  color: "#667899",
  fontSize: 12,
};

const muted: React.CSSProperties = {
  margin: 0,
  color: "#53668d",
};

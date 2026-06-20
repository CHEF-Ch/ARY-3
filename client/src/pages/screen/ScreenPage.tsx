import { useEffect, useMemo, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import type { ProjectionResponse, ScreenFeedData } from "../../shared/apiTypes";
import { requestJson } from "../../shared/apiTypes";

interface RaceResponse {
  id: string;
  slug: string;
  title: string;
}

type ScreenMode = "live" | "leaderboard" | "works" | "announcement";

export default function ScreenPage() {
  const { slug } = useParams();
  const [searchParams] = useSearchParams();
  const requestedMode = (searchParams.get("mode") || "live") as ScreenMode;
  const [race, setRace] = useState<RaceResponse | null>(null);
  const [feedMeta, setFeedMeta] = useState<ProjectionResponse<ScreenFeedData> | null>(null);
  const [feed, setFeed] = useState<ScreenFeedData | null>(null);
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
        const response = await requestJson<ProjectionResponse<ScreenFeedData>>(`/projections/${encodeURIComponent(raceData.id)}/screen_feed`);
        if (!active) return;
        setFeedMeta(response);
        setFeed(response.data);
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || "大屏数据加载失败。");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [slug]);

  if (loading) {
    return <div style={screenShellStyle}><p style={mutedStyle}>正在加载大屏...</p></div>;
  }

  if (error || !race || !feed) {
    return <div style={screenShellStyle}><p style={mutedStyle}>{error || "大屏不可用。"}</p></div>;
  }

  const mode = useMemo(() => {
    if (!feed) return requestedMode;
    return feed.protocol.availableModes.includes(requestedMode) ? requestedMode : feed.protocol.defaultDisplayMode;
  }, [feed, requestedMode]);
  const items = feed.items
    .filter((item) => item.mode === mode)
    .slice()
    .sort((a, b) => a.order - b.order || a.fallbackPriority - b.fallbackPriority);
  const primary = items[0];

  return (
    <div style={screenShellStyle}>
      <header style={headerStyle}>
        <div>
          <div style={eyebrowStyle}>Screen Display / {formatMode(mode)}</div>
          <h1 style={titleStyle}>{race.title}</h1>
          {feedMeta?.usingStableFallback ? (
            <p style={fallbackTextStyle}>当前展示来自最近一次稳定 Projection。</p>
          ) : feedMeta?.usingStaticFallback ? (
            <p style={fallbackTextStyle}>当前展示来自静态 fallback。</p>
          ) : null}
        </div>
        <div style={metaStyle}>
          {items.length} 个可轮播 feed item
          <div style={protocolTextStyle}>
            默认模式 {formatMode(feed.protocol.defaultDisplayMode)} / {feed.protocol.autoRotate ? "自动轮播" : "静态展示"}
          </div>
        </div>
      </header>

      {!primary ? (
        <section style={cardStyle}>
          <h2 style={sectionTitleStyle}>Fallback</h2>
          <p style={bodyStyle}>当前模式没有稳定 projection，应该回退到最近一次稳定版本或静态公告。</p>
        </section>
      ) : primary.feedItemType === "live_metrics" ? (
        <section style={cardStyle}>
          <h2 style={sectionTitleStyle}>赛事进行态</h2>
          <div style={metricGridStyle}>
            <Metric label="Session" value={String(primary.data.counts.sessionCount)} />
            <Metric label="作品" value={String(primary.data.counts.worksSubmitted)} />
            <Metric label="连接" value={String(primary.data.counts.activeConnections)} />
            <Metric label="奖项" value={String(primary.data.counts.awardsPublished)} />
          </div>
          <p style={bodyStyle}>{primary.data.headline}</p>
          <p style={subMetaStyle}>建议停留 {Math.round(primary.durationMs / 1000)} 秒，fallback 优先级 {primary.fallbackPriority}。</p>
        </section>
      ) : primary.feedItemType === "process_leaderboard" || primary.feedItemType === "final_leaderboard" ? (
        <section style={cardStyle}>
          <h2 style={sectionTitleStyle}>{primary.title}</h2>
          <div style={leaderboardGridStyle}>
            {primary.feedItemType === "process_leaderboard"
              ? primary.data.items.slice(0, 8).map((item: any) => (
                  <div key={item.registrationId} style={leaderboardRowStyle}>
                    <strong>#{item.rank}</strong>
                    <span>{item.workTitle}</span>
                    <span>{item.processScore.toFixed(1)}</span>
                  </div>
                ))
              : primary.data.groups.flatMap((group: any) => group.items.map((item: any) => (
                  <div key={item.awardId} style={leaderboardRowStyle}>
                    <strong>{group.awardName}</strong>
                    <span>#{item.rank}</span>
                    <span>{item.registrationId}</span>
                  </div>
                )))}
          </div>
          <p style={subMetaStyle}>建议停留 {Math.round(primary.durationMs / 1000)} 秒，推荐模式 {formatMode(primary.recommendedDisplayMode)}。</p>
        </section>
      ) : primary.feedItemType === "work_highlight" ? (
        <section style={cardStyle}>
          <h2 style={sectionTitleStyle}>{primary.title}</h2>
          <p style={bodyStyle}>{primary.data.summary || "公开作品展示。"}</p>
          <p style={subMetaStyle}>建议停留 {Math.round(primary.durationMs / 1000)} 秒。</p>
        </section>
      ) : (
        <section style={cardStyle}>
          <h2 style={sectionTitleStyle}>{primary.title}</h2>
          <p style={bodyStyle}>{primary.data.body || "赛事公告。"}</p>
          <p style={subMetaStyle}>建议停留 {Math.round(primary.durationMs / 1000)} 秒。</p>
        </section>
      )}
    </div>
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

function formatMode(mode: ScreenMode) {
  const labels: Record<ScreenMode, string> = {
    live: "Live",
    leaderboard: "Leaderboard",
    works: "Works",
    announcement: "Announcement",
  };
  return labels[mode];
}

const screenShellStyle: React.CSSProperties = {
  minHeight: "calc(100vh - 120px)",
  padding: 24,
  background: "linear-gradient(180deg, #021531, #0b3b78 70%, #0e4c98)",
  color: "#f7fbff",
};

const headerStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 20,
  alignItems: "end",
  marginBottom: 20,
};

const eyebrowStyle: React.CSSProperties = {
  color: "#8fc2ff",
  fontSize: 12,
  fontWeight: 900,
  textTransform: "uppercase",
};

const titleStyle: React.CSSProperties = {
  margin: "8px 0 0",
  fontSize: 40,
};

const metaStyle: React.CSSProperties = {
  color: "#c5dcff",
  fontSize: 14,
  fontWeight: 700,
};

const protocolTextStyle: React.CSSProperties = {
  marginTop: 8,
  color: "#9fc7ff",
  fontSize: 12,
  fontWeight: 600,
};

const fallbackTextStyle: React.CSSProperties = {
  margin: "10px 0 0",
  color: "#ffd49a",
  fontWeight: 700,
};

const cardStyle: React.CSSProperties = {
  padding: 28,
  borderRadius: 18,
  background: "rgba(255,255,255,0.08)",
  border: "1px solid rgba(255,255,255,0.16)",
  backdropFilter: "blur(8px)",
};

const sectionTitleStyle: React.CSSProperties = {
  margin: "0 0 16px",
  fontSize: 28,
};

const bodyStyle: React.CSSProperties = {
  margin: 0,
  color: "#d6e7ff",
  lineHeight: 1.7,
  fontSize: 18,
};

const subMetaStyle: React.CSSProperties = {
  marginTop: 14,
  color: "#b8d4ff",
  fontSize: 13,
};

const metricGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
  gap: 14,
  marginBottom: 18,
};

const metricCardStyle: React.CSSProperties = {
  padding: 18,
  borderRadius: 14,
  background: "rgba(255,255,255,0.08)",
};

const metricValueStyle: React.CSSProperties = {
  fontSize: 30,
  fontWeight: 900,
};

const metricLabelStyle: React.CSSProperties = {
  color: "#b8d4ff",
  fontSize: 12,
  fontWeight: 700,
};

const leaderboardGridStyle: React.CSSProperties = {
  display: "grid",
  gap: 10,
};

const leaderboardRowStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr 1fr",
  gap: 14,
  padding: 14,
  borderRadius: 12,
  background: "rgba(255,255,255,0.08)",
};

const mutedStyle: React.CSSProperties = {
  margin: 0,
  color: "#d6e7ff",
};

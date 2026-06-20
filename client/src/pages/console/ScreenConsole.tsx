import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { ProjectionResponse, ScreenFeedData } from "../../shared/apiTypes";
import { requestJson } from "../../shared/apiTypes";

interface RaceSummaryCard {
  id: string;
  slug: string;
  title: string;
  status: string;
}

type ScreenMode = "live" | "leaderboard" | "works" | "announcement";

const MODES: ScreenMode[] = ["live", "leaderboard", "works", "announcement"];

export default function ScreenConsole() {
  const [races, setRaces] = useState<RaceSummaryCard[]>([]);
  const [selectedRaceId, setSelectedRaceId] = useState("");
  const [selectedMode, setSelectedMode] = useState<ScreenMode>("live");
  const [preview, setPreview] = useState<ScreenFeedData | null>(null);
  const [previewMeta, setPreviewMeta] = useState<ProjectionResponse<ScreenFeedData> | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    requestJson<RaceSummaryCard[]>("/races")
      .then((rows) => {
        const raceRows = Array.isArray(rows) ? rows : [];
        setRaces(raceRows);
        if (raceRows[0]) setSelectedRaceId(raceRows[0].id);
      })
      .catch((err) => setMessage(err.message || "赛事列表加载失败。"));
  }, []);

  useEffect(() => {
    if (!selectedRaceId) return;
    requestJson<ProjectionResponse<ScreenFeedData>>(`/projections/${encodeURIComponent(selectedRaceId)}/screen_feed`)
      .then((response) => {
        setPreviewMeta(response);
        setPreview(response.data);
        setMessage("");
      })
      .catch((err) => setMessage(err.message || "大屏预览加载失败。"));
  }, [selectedRaceId]);

  const selectedRace = races.find((race) => race.id === selectedRaceId) || null;
  const currentItems = preview?.items
    .filter((item) => item.mode === selectedMode)
    .slice()
    .sort((a, b) => a.order - b.order || a.fallbackPriority - b.fallbackPriority) || [];

  return (
    <div>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Screen Console</h1>
      <p style={{ color: "#53668d", marginBottom: 24 }}>
        这里不是重新算业务数据，而是切换 `screen_feed_projection` 的展示视角。大屏失败时也应该能退回最近稳定版本。
      </p>

      <section style={toolbarStyle}>
        <label style={fieldStyle}>
          <span style={labelStyle}>赛事</span>
          <select value={selectedRaceId} onChange={(event) => setSelectedRaceId(event.target.value)} style={selectStyle}>
            <option value="">请选择赛事</option>
            {races.map((race) => (
              <option key={race.id} value={race.id}>{race.title}</option>
            ))}
          </select>
        </label>

        <label style={fieldStyle}>
          <span style={labelStyle}>模式</span>
          <select value={selectedMode} onChange={(event) => setSelectedMode(event.target.value as ScreenMode)} style={selectStyle}>
            {MODES.map((mode) => (
              <option key={mode} value={mode}>{formatMode(mode)}</option>
            ))}
          </select>
        </label>

        {selectedRace ? (
          <Link to={`/console/screen/${selectedRace.slug}?mode=${selectedMode}`} style={openLinkStyle}>
            打开大屏输出
          </Link>
        ) : null}
      </section>

      {preview ? (
        <p style={{ color: "#53668d", marginBottom: 16 }}>
          协议：默认模式 {formatMode(preview.protocol.defaultDisplayMode)}，可用模式 {preview.protocol.availableModes.map(formatMode).join(" / ")}，
          {preview.protocol.autoRotate ? "建议自动轮播" : "当前无需自动轮播"}。
        </p>
      ) : null}

      {message ? <p style={{ color: "#b94a00", marginBottom: 16 }}>{message}</p> : null}
      {previewMeta?.usingStableFallback ? (
        <p style={{ color: "#b94a00", marginBottom: 16 }}>
          当前预览使用最近一次稳定 Projection。原因：{previewMeta.fallbackReason || "最新投影暂不可用。"}
        </p>
      ) : previewMeta?.usingStaticFallback ? (
        <p style={{ color: "#b94a00", marginBottom: 16 }}>
          当前预览使用静态 fallback。原因：{previewMeta.fallbackReason || "实时投影与稳定快照都不可用。"}
        </p>
      ) : null}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 16 }}>
        {currentItems.length === 0 ? (
          <div style={cardStyle}>
            <h3 style={cardTitleStyle}>暂无预览</h3>
            <p style={mutedStyle}>当前模式还没有投影数据，或所选赛事尚未生成稳定 feed。</p>
          </div>
        ) : currentItems.map((item) => (
          <div key={item.id} style={cardStyle}>
            <div style={chipStyle}>{item.feedItemType}</div>
            <h3 style={cardTitleStyle}>{item.title}</h3>
            <p style={mutedStyle}>{summarizeFeedItem(item)}</p>
            <p style={metaLineStyle}>
              顺序 {item.order} / 停留 {Math.round(item.durationMs / 1000)}s / 推荐模式 {formatMode(item.recommendedDisplayMode)} / fallback 优先级 {item.fallbackPriority}
            </p>
          </div>
        ))}
      </div>
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

function summarizeFeedItem(item: ScreenFeedData["items"][number]) {
  if (item.feedItemType === "live_metrics") return "赛事状态、指标卡、事件流。";
  if (item.feedItemType === "process_leaderboard") return "过程榜单，强调“正在发生”而非最终赛果。";
  if (item.feedItemType === "final_leaderboard") return "最终榜单，来源于 Award / leaderboard_read_model。";
  if (item.feedItemType === "work_highlight") return item.data?.summary || "公开作品高亮。";
  return item.data?.body || "赛事公告。";
}

const toolbarStyle: React.CSSProperties = {
  display: "flex",
  gap: 16,
  alignItems: "end",
  flexWrap: "wrap",
  marginBottom: 20,
};

const fieldStyle: React.CSSProperties = {
  display: "grid",
  gap: 6,
  minWidth: 220,
};

const labelStyle: React.CSSProperties = {
  color: "#53668d",
  fontSize: 12,
  fontWeight: 800,
};

const selectStyle: React.CSSProperties = {
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(34,107,230,0.18)",
  background: "rgba(255,255,255,0.72)",
};

const openLinkStyle: React.CSSProperties = {
  textDecoration: "none",
  padding: "11px 14px",
  borderRadius: 999,
  background: "#075bec",
  color: "#ffffff",
  fontWeight: 800,
};

const cardStyle: React.CSSProperties = {
  padding: 20,
  border: "1px solid rgba(34,107,230,0.18)",
  borderRadius: 14,
  background: "rgba(255,255,255,0.72)",
};

const cardTitleStyle: React.CSSProperties = {
  margin: "10px 0 8px",
  color: "#06164a",
};

const chipStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "6px 10px",
  borderRadius: 999,
  background: "rgba(7,91,236,0.08)",
  color: "#075bec",
  fontSize: 12,
  fontWeight: 800,
};

const mutedStyle: React.CSSProperties = {
  margin: 0,
  color: "#53668d",
  lineHeight: 1.6,
};

const metaLineStyle: React.CSSProperties = {
  margin: "8px 0 0",
  color: "#7a8cab",
  fontSize: 12,
};

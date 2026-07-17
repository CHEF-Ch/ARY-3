import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import type { AwardResponse } from "../../shared/apiTypes";

interface RaceResponse {
  id: string;
  slug: string;
  title: string;
}

export default function ResultsPage() {
  const { slug } = useParams();
  const [race, setRace] = useState<RaceResponse | null>(null);
  const [awards, setAwards] = useState<AwardResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setRace(null);
    setAwards([]);

    if (!slug) {
      setError("缺少 Race slug。");
      setLoading(false);
      return () => { active = false; };
    }

    fetch(`/races/${encodeURIComponent(slug)}`, { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) throw new Error(res.status === 404 ? "未找到 Race。" : "Race 加载失败。");
        return res.json();
      })
      .then(async (raceData: RaceResponse) => {
        if (!active) return;
        setRace(raceData);
        const awardsRes = await fetch(`/awards?raceId=${encodeURIComponent(raceData.id)}`, { credentials: "include" });
        if (!awardsRes.ok) throw new Error("榜单加载失败。");
        return awardsRes.json();
      })
      .then((data) => {
        if (!active) return;
        setAwards(Array.isArray(data) ? data : []);
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

  const groupedAwards = useMemo(() => {
    const groups = new Map<string, AwardResponse[]>();
    awards
      .filter((award) => award.status === "published" && award.visibility === "public")
      .forEach((award) => {
        const current = groups.get(award.awardName) || [];
        groups.set(award.awardName, [...current, award]);
      });

    return Array.from(groups.entries()).map(([awardName, rows]) => ({
      awardName,
      awards: rows.slice().sort((a, b) => a.rank - b.rank),
    }));
  }, [awards]);

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
          <div style={eyebrowStyle}>赛果 / {race?.slug || slug || "未指定 Race"}</div>
          <h1 style={titleStyle}>{race?.title || "最终榜单"}</h1>
          <p style={summaryStyle}>
            通过 Race slug 查到 Race ID 后读取公开奖项，仅展示已发布且公开的最终结果。
          </p>
        </div>
      </section>

      {error ? (
        <section style={panelStyle}>
          <h2 style={sectionTitleStyle}>加载失败</h2>
          <p style={muted}>{error}</p>
        </section>
      ) : groupedAwards.length === 0 ? (
        <section style={panelStyle}>
          <h2 style={sectionTitleStyle}>暂无已发布奖项</h2>
          <p style={muted}>当前 Race 还没有可公开展示的榜单。</p>
        </section>
      ) : (
        <div style={groupStackStyle}>
          {groupedAwards.map((group) => (
            <section key={group.awardName} style={panelStyle}>
              <div style={sectionHeaderStyle}>
                <h2 style={sectionTitleStyle}>{group.awardName}</h2>
                <span style={countStyle}>{group.awards.length} 条记录</span>
              </div>
              <div style={tableStyle}>
                <div style={tableHeaderStyle}>
                  <span>名次</span>
                  <span>报名 ID</span>
                  <span>作品 ID</span>
                  <span>评审理由</span>
                </div>
                {group.awards.map((award) => (
                  <div key={award.id} style={tableRowStyle}>
                    <span style={rankStyle}>#{award.rank}</span>
                    <span>{award.registrationId}</span>
                    <span>{award.workId || "未绑定作品"}</span>
                    <span style={reasonStyle}>{award.decisionReason || "暂无说明。"}</span>
                  </div>
                ))}
              </div>
            </section>
          ))}
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

const muted: React.CSSProperties = {
  margin: 0,
  color: "#53668d",
};

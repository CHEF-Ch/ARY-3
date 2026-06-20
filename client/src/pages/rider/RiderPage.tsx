import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";

interface RiderData {
  userId: string;
  displayName: string;
  registrations: number;
  roles: string[];
  works?: { title: string; status: string }[];
  awards?: { name: string; rank: number; race: string }[];
  races?: { title: string; status: string }[];
}

export default function RiderPage() {
  const { slug } = useParams();
  const [rider, setRider] = useState<RiderData | null>(null);
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/communication/riders/${slug}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { setRider(data); setLoading(false); })
      .catch(() => setLoading(false));

    fetch("/reports?type=rider_report", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : []))
      .then(setReports)
      .catch(() => {});
  }, [slug]);

  if (loading) return <p style={S.muted}>加载中…</p>;
  if (!rider) return <p style={S.muted}>骑手未找到</p>;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <div style={{ marginBottom: 32 }}>
        <p style={S.eyebrow}>Rider Profile</p>
        <h1 style={S.h1}>{rider.displayName}</h1>
        <p style={S.summary}>
          {rider.registrations} 场参赛 · {rider.works?.length || 0} 件作品 · {rider.awards?.length || 0} 项获奖
        </p>
      </div>

      <div style={S.grid}>
        <section style={S.card}><h2 style={S.cardTitle}>参赛记录</h2>
          {(rider.races || []).length > 0
            ? rider.races!.map((r: any) => <div key={r.title} style={S.row}><span>{r.title}</span><b>{S.statusText(r.status)}</b></div>)
            : <p style={S.empty}>暂无参赛记录</p>}
        </section>
        <section style={S.card}><h2 style={S.cardTitle}>作品</h2>
          {(rider.works || []).length > 0
            ? rider.works!.map((w: any) => <div key={w.title} style={S.row}><span>{w.title}</span><b>{S.statusText(w.status)}</b></div>)
            : <p style={S.empty}>暂无公开作品</p>}
        </section>
        <section style={S.card}><h2 style={S.cardTitle}>获奖</h2>
          {(rider.awards || []).length > 0
            ? rider.awards!.map((a: any) => <div key={a.name} style={S.row}><span>{a.name}</span><b>No.{a.rank}</b></div>)
            : <p style={S.empty}>暂无获奖记录</p>}
        </section>
        <section style={S.card}><h2 style={S.cardTitle}>能力标签</h2>
          <p style={S.empty}>完成赛事后系统将根据骑行数据生成。</p>
        </section>
      </div>

      {reports.length > 0 && (
        <section style={{ marginTop: 32 }}>
          <h2 style={S.cardTitle}>个人报告</h2>
          <div style={S.stack}>
            {reports.map((r: any) => (
              <article key={r.id} style={S.reportCard}>
                <h3 style={{ margin: 0 }}>{r.title}</h3>
                <p>{r.summary}</p>
                <small>{r.status} · {new Date(r.updatedAt || r.generatedAt).toLocaleDateString()}</small>
              </article>
            ))}
          </div>
        </section>
      )}

      <p style={{ marginTop: 24 }}>
        <Link to="/riders/1" style={{ fontSize: 13, color: "#53668d" }}>← 骑手列表</Link>
      </p>
    </div>
  );
}

const statusLabels: Record<string, string> = {
  draft: "草稿", submitted: "已提交", locked: "已锁定", hidden: "隐藏",
  registration: "报名中", running: "进行中", judging: "评审中", completed: "已结束", archived: "已归档",
};

const S = {
  eyebrow: { color: "#075bec", fontSize: 13, fontWeight: 950, textTransform: "uppercase", marginBottom: 4 } as React.CSSProperties,
  h1: { fontSize: 42, fontWeight: 950, color: "#06164a", margin: 0 } as React.CSSProperties,
  summary: { color: "#53668d", fontSize: 16, marginBottom: 0 } as React.CSSProperties,
  muted: { color: "#53668d", padding: 40 } as React.CSSProperties,
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 } as React.CSSProperties,
  card: { padding: 20, border: "1px solid rgba(34,107,230,0.18)", borderRadius: 14, background: "rgba(255,255,255,0.72)", boxShadow: "0 8px 20px rgba(11,57,150,0.06)" } as React.CSSProperties,
  cardTitle: { fontSize: 18, fontWeight: 950, color: "#06164a", marginBottom: 12 } as React.CSSProperties,
  row: { display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(34,107,230,0.08)", fontSize: 14, color: "#344a7b" } as React.CSSProperties,
  empty: { color: "#aaa", fontSize: 13 } as React.CSSProperties,
  stack: { display: "grid", gap: 12 } as React.CSSProperties,
  reportCard: { padding: 16, border: "1px solid rgba(34,107,230,0.16)", borderRadius: 8, background: "rgba(255,255,255,0.72)" } as React.CSSProperties,
  statusText: (s: string) => statusLabels[s] || s,
};

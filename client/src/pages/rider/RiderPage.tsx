import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";

interface RiderData {
  userId: string; displayName: string; registrations: number; roles: string[];
  works?: { title: string; status: string }[];
  awards?: { name: string; rank: number; race: string }[];
  races?: { title: string; status: string }[];
}

export default function RiderPage() {
  const { slug } = useParams();
  const [rider, setRider] = useState<RiderData | null>(null);
  useEffect(() => {
    fetch(`/communication/riders/${slug}`)
      .then((r) => (r.ok ? r.json() : null))
      .then(setRider).catch(() => {});
  }, [slug]);

  if (!rider) return <p style={{ color: "#53668d", padding: 40 }}>骑手未找到</p>;

  return (
    <div style={{ maxWidth: 900, margin: "0 auto" }}>
      <p style={{ color: "#075bec", fontSize: 13, fontWeight: 950, textTransform: "uppercase", marginBottom: 4 }}>Rider Profile</p>
      <h1 style={{ fontSize: 42, fontWeight: 950, color: "#06164a", margin: 0 }}>{rider.displayName}</h1>
      <p style={{ color: "#53668d", fontSize: 16, marginBottom: 32 }}>
        {rider.registrations} 场参赛 · {rider.works?.length || 0} 件作品 · {rider.awards?.length || 0} 项获奖
      </p>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18 }}>
        <section style={S.card}><h2 style={S.title}>参赛记录</h2>
          {(rider.races || []).length > 0
            ? rider.races!.map((r: any) => <div key={r.title} style={S.row}><span>{r.title}</span><b>{r.status}</b></div>)
            : <p style={S.empty}>暂无参赛记录。报名后显示。</p>}
        </section>
        <section style={S.card}><h2 style={S.title}>作品</h2>
          {(rider.works || []).length > 0
            ? rider.works!.map((w: any) => <div key={w.title} style={S.row}><span>{w.title}</span><b>{w.status}</b></div>)
            : <p style={S.empty}>暂无公开作品。提交并发布后显示。</p>}
        </section>
        <section style={S.card}><h2 style={S.title}>获奖</h2>
          {(rider.awards || []).length > 0
            ? rider.awards!.map((a: any) => <div key={a.name} style={S.row}><span>{a.name}</span><b>No.{a.rank}</b></div>)
            : <p style={S.empty}>暂无获奖记录。参赛并获奖后显示。</p>}
        </section>
        <section style={S.card}><h2 style={S.title}>能力标签</h2>
          <p style={S.empty}>完成赛事后系统将根据骑行数据生成能力标签。</p>
        </section>
      </div>
      <p style={{ marginTop: 24 }}><Link to="/riders/1" style={{ fontSize: 13, color: "#53668d" }}>← 骑手列表</Link></p>
    </div>
  );
}

const S = {
  card: { padding: 20, border: "1px solid rgba(34,107,230,0.18)", borderRadius: 14, background: "rgba(255,255,255,0.72)", boxShadow: "0 8px 20px rgba(11,57,150,0.06)" } as React.CSSProperties,
  title: { fontSize: 18, fontWeight: 950, color: "#06164a", marginBottom: 12 } as React.CSSProperties,
  row: { display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid rgba(34,107,230,0.08)", fontSize: 14, color: "#344a7b" } as React.CSSProperties,
  empty: { color: "#aaa", fontSize: 13 } as React.CSSProperties,
};

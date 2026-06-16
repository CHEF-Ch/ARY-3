import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";

interface Report {
  id: string;
  title: string;
  summary: string;
  sections: { heading: string; body: string }[];
  publishedAt: string | null;
  sourceCounts: Record<string, number>;
}

export default function ReviewPage() {
  const { slug } = useParams();
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetch(`/reports?raceSlug=${slug}&type=review_summary`, { credentials: "include" })
      .then((res) => (res.ok ? res.json() : []))
      .then((rows) => setReport(rows[0] ?? null))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return <div><h1>Review</h1><p>Loading review summary...</p></div>;
  if (!report) {
    return (
      <div>
        <h1>Review: {slug}</h1>
        <p>评审总结尚未发布。</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 920, margin: "0 auto" }}>
      <p style={{ color: "#53668d", fontWeight: 700 }}>Review Summary</p>
      <h1>{report.title}</h1>
      <p style={{ fontSize: 18, lineHeight: 1.7 }}>{report.summary}</p>

      <section style={{ display: "grid", gap: 16, marginTop: 28 }}>
        {report.sections.map((section) => (
          <article
            key={section.heading}
            style={{
              padding: 20,
              border: "1px solid rgba(34,107,230,0.16)",
              borderRadius: 8,
              background: "rgba(255,255,255,0.72)",
            }}
          >
            <h2 style={{ marginTop: 0 }}>{section.heading}</h2>
            <p style={{ lineHeight: 1.7 }}>{section.body}</p>
          </article>
        ))}
      </section>

      <p style={{ marginTop: 24, color: "#53668d" }}>
        Published: {report.publishedAt ? new Date(report.publishedAt).toLocaleString() : "pending"}
      </p>
    </div>
  );
}

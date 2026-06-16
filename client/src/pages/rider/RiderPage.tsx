import { useParams } from "react-router-dom";
import { useEffect, useState } from "react";

interface RiderReport {
  id: string;
  title: string;
  summary: string;
  status: string;
  visibility: string;
  updatedAt: string;
}

export default function RiderPage() {
  const { slug } = useParams();
  const [reports, setReports] = useState<RiderReport[]>([]);

  useEffect(() => {
    fetch("/reports?type=rider_report", { credentials: "include" })
      .then((res) => (res.ok ? res.json() : []))
      .then(setReports)
      .catch(() => setReports([]));
  }, [slug]);

  return (
    <div>
      <h1>Rider: {slug}</h1>
      <p>Rider Profile — A module owns the profile base. E adds rider report visibility here.</p>

      <section style={{ marginTop: 24 }}>
        <h2>Rider Reports</h2>
        {reports.length === 0 ? (
          <p>暂无可查看的个人成绩单。</p>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {reports.map((report) => (
              <article
                key={report.id}
                style={{
                  padding: 16,
                  border: "1px solid rgba(34,107,230,0.16)",
                  borderRadius: 8,
                  background: "rgba(255,255,255,0.72)",
                }}
              >
                <h3 style={{ margin: 0 }}>{report.title}</h3>
                <p>{report.summary}</p>
                <small>{report.status} / {report.visibility} / {new Date(report.updatedAt).toLocaleString()}</small>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

import { useParams } from "react-router-dom";
import { useEffect, useMemo, useState } from "react";

interface Race {
  id: string;
  slug: string;
  title: string;
  challenge: string;
  status: string;
  visibility: string;
  registrationOpensAt: string | null;
  registrationClosesAt: string | null;
  startsAt: string | null;
  endsAt: string | null;
  cta: { label: string; target: string };
}

export default function RacePage() {
  const { slug } = useParams();
  const [race, setRace] = useState<Race | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetch(`/races/${slug}`, { credentials: "include" })
      .then(async (res) => {
        if (!res.ok) throw new Error(res.status === 404 ? "Race not found" : "Failed to load race");
        return res.json();
      })
      .then((data) => {
        if (!active) return;
        setRace(data);
        setError("");
      })
      .catch((err) => {
        if (!active) return;
        setRace(null);
        setError(err.message || "Failed to load race");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [slug]);

  const statusLabel = useMemo(() => {
    if (!race) return "";
    return race.status.replace(/_/g, " ");
  }, [race]);

  if (loading) {
    return <PageShell><p style={muted}>Loading race...</p></PageShell>;
  }

  if (error || !race) {
    return (
      <PageShell>
        <h1 style={titleStyle}>Race unavailable</h1>
        <p style={muted}>{error || "Race not found"}</p>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <section style={heroStyle}>
        <div>
          <div style={eyebrowStyle}>Race / {statusLabel}</div>
          <h1 style={titleStyle}>{race.title}</h1>
          <p style={summaryStyle}>{race.challenge || "Challenge brief is being prepared."}</p>
        </div>
        <a href={race.cta.target} style={ctaStyle}>{race.cta.label}</a>
      </section>

      <section style={gridStyle}>
        <Info label="Visibility" value={race.visibility} />
        <Info label="Registration opens" value={formatDate(race.registrationOpensAt)} />
        <Info label="Registration closes" value={formatDate(race.registrationClosesAt)} />
        <Info label="Starts" value={formatDate(race.startsAt)} />
        <Info label="Ends" value={formatDate(race.endsAt)} />
        <Info label="Human review" value="B1 Race CRUD / CTA" />
      </section>
    </PageShell>
  );
}

function PageShell({ children }: { children: React.ReactNode }) {
  return <div style={{ maxWidth: 1120, margin: "0 auto" }}>{children}</div>;
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div style={infoStyle}>
      <div style={infoLabelStyle}>{label}</div>
      <div style={infoValueStyle}>{value}</div>
    </div>
  );
}

function formatDate(value: string | null) {
  if (!value) return "Not set";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
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

const ctaStyle: React.CSSProperties = {
  flex: "0 0 auto",
  padding: "10px 16px",
  borderRadius: 8,
  background: "#0b5ee8",
  color: "white",
  fontWeight: 800,
  textDecoration: "none",
};

const gridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
  gap: 12,
  marginTop: 16,
};

const infoStyle: React.CSSProperties = {
  padding: 16,
  border: "1px solid rgba(34,107,230,0.14)",
  borderRadius: 8,
  background: "rgba(255,255,255,0.72)",
};

const infoLabelStyle: React.CSSProperties = {
  color: "#667899",
  fontSize: 12,
  fontWeight: 800,
  textTransform: "uppercase",
};

const infoValueStyle: React.CSSProperties = {
  marginTop: 6,
  color: "#06164a",
  fontWeight: 800,
};

const muted: React.CSSProperties = {
  color: "#53668d",
};

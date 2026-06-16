import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import OrganizerOverview from "./OrganizerOverview";
import OrganizerJudging from "./OrganizerJudging";
import AdminView from "./AdminView";
import RiderView from "./RiderView";
import JudgeView from "./JudgeView";
import ScreenConsole from "./ScreenConsole";

type RoleView = "organizer_overview" | "organizer_judging" | "rider" | "judge" | "admin" | "screen";

interface ConsoleUser { userId: string; displayName: string; roles: string[]; }

export default function ConsoleShell() {
  const [user, setUser] = useState<ConsoleUser | null>(null);
  const [view, setView] = useState<RoleView>("organizer_overview");
  const navigate = useNavigate();

  useEffect(() => {
    fetch("/auth/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) {
          setUser(data);
          // Default to first available role
          if (data.roles.includes("organizer")) setView("organizer_overview");
          else if (data.roles.includes("admin")) setView("admin");
          else if (data.roles.includes("rider")) setView("rider");
          else if (data.roles.includes("judge")) setView("judge");
        }
      })
      .catch(() => {});
  }, []);

  if (!user) {
    return (
      <div style={{ padding: 40, textAlign: "center" }}>
        <h1>Console</h1>
        <p>请先登录后访问管理端。</p>
        <button onClick={() => navigate("/")}>回到首页</button>
      </div>
    );
  }

  const availableViews: { key: RoleView; label: string; owner: string }[] = [
    ...(user.roles.includes("organizer")
      ? [
          { key: "organizer_overview" as RoleView, label: "赛事管理", owner: "B" },
          { key: "organizer_judging" as RoleView, label: "评审与奖项", owner: "C" },
        ]
      : []),
    ...(user.roles.includes("rider") ? [{ key: "rider" as RoleView, label: "Rider View", owner: "B" }] : []),
    ...(user.roles.includes("judge") ? [{ key: "judge" as RoleView, label: "Judge View", owner: "C" }] : []),
    ...(user.roles.includes("admin") ? [{ key: "admin" as RoleView, label: "Admin Console", owner: "A" }] : []),
    { key: "screen" as RoleView, label: "Screen Console", owner: "D" },
  ];

  return (
    <div style={{ display: "flex", gap: 24, minHeight: "80vh" }}>
      {/* Sidebar */}
      <aside style={{ width: 220, flexShrink: 0 }}>
        <h2 style={{ fontSize: 18, marginBottom: 16 }}>Race Workspace</h2>
        {availableViews.map((v) => (
          <button
            key={v.key}
            onClick={() => setView(v.key)}
            style={{
              display: "block",
              width: "100%",
              textAlign: "left",
              padding: "10px 14px",
              marginBottom: 6,
              border: view === v.key ? "2px solid #075bec" : "1px solid rgba(34,107,230,0.18)",
              borderRadius: 10,
              background: view === v.key ? "rgba(234,243,255,0.86)" : "rgba(255,255,255,0.58)",
              color: view === v.key ? "#075bec" : "#53668d",
              fontWeight: view === v.key ? 900 : 600,
              fontSize: 14,
              cursor: "pointer",
            }}
          >
            <span>{v.owner !== "A" ? `${v.label}` : v.label}</span>
            <small style={{ color: "#aaa", fontSize: 10 }}>{v.owner}</small>
          </button>
        ))}
        <hr style={{ margin: "16px 0", borderColor: "rgba(34,107,230,0.12)" }} />
        <button
          onClick={() => navigate("/")}
          style={{
            width: "100%",
            padding: "8px",
            border: "1px solid rgba(34,107,230,0.15)",
            borderRadius: 8,
            background: "rgba(255,255,255,0.5)",
            color: "#53668d",
            fontSize: 13,
            cursor: "pointer",
          }}
        >
          ← 返回公开端
        </button>
      </aside>

      {/* Main content area */}
      <main style={{ flex: 1 }}>
        {view === "admin" && <AdminView user={user} />}
        {view === "organizer_overview" && <OrganizerOverview />}
        {view === "organizer_judging" && <OrganizerJudging />}
        {view === "rider" && <RiderView />}
        {view === "judge" && <JudgeView />}
        {view === "screen" && <ScreenConsole />}
      </main>
    </div>
  );
}



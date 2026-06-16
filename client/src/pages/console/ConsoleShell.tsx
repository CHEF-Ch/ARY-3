import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import OrganizerOverview from "./OrganizerOverview";
import OrganizerJudging from "./OrganizerJudging";
import RiderView from "./RiderView";
import JudgeView from "./JudgeView";
import ScreenConsole from "./ScreenConsole";

type RoleView = "organizer_overview" | "organizer_judging" | "rider" | "judge" | "admin" | "screen";

interface User {
  userId: string;
  displayName: string;
  roles: string[];
}

export default function ConsoleShell() {
  const [user, setUser] = useState<User | null>(null);
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

// ── Admin View (A's implementation) ──

function AdminView({ user }: { user: User }) {
  const [users, setUsers] = useState<any[]>([]);
  const [message, setMessage] = useState("");

  const loadUsers = () => {
    fetch("/admin/users", { credentials: "include" })
      .then((r) => r.json())
      .then(setUsers)
      .catch(() => setMessage("加载失败"));
  };

  useEffect(() => { loadUsers(); }, []);

  const updateRoles = async (userId: string, roles: string[]) => {
    const res = await fetch(`/admin/users/${userId}/roles`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ roles }),
    });
    if (res.ok) {
      setMessage(`角色已更新`);
      loadUsers();
    } else {
      const err = await res.json();
      setMessage(err.error || "更新失败");
    }
  };

  const roleOptions: string[] = ["rider", "judge", "organizer", "admin"];

  return (
    <div>
      <h1 style={{ fontSize: 28, marginBottom: 8 }}>Admin Console</h1>
      <p style={{ color: "#53668d", marginBottom: 20 }}>
        当前用户：{user.displayName}（{user.roles.join(", ")}）
      </p>
      {message && (
        <div style={{ padding: "8px 12px", marginBottom: 16, background: "#eaf3ff", borderRadius: 8, fontSize: 13 }}>
          {message}
        </div>
      )}
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid rgba(34,107,230,0.18)" }}>
            <th style={{ padding: 8 }}>GitHub</th>
            <th style={{ padding: 8 }}>显示名</th>
            <th style={{ padding: 8 }}>资料</th>
            <th style={{ padding: 8 }}>角色</th>
            <th style={{ padding: 8 }}>操作</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u: any) => (
            <tr key={u.userId} style={{ borderBottom: "1px solid rgba(34,107,230,0.08)" }}>
              <td style={{ padding: 8 }}>{u.githubAccount}</td>
              <td style={{ padding: 8 }}>{u.displayName || "—"}</td>
              <td style={{ padding: 8 }}>{u.profileCompleted ? "✅" : "❌"}</td>
              <td style={{ padding: 8 }}>
                {roleOptions.map((r) => (
                  <label key={r} style={{ marginRight: 8, fontSize: 13 }}>
                    <input
                      type="checkbox"
                      checked={u.roles.includes(r)}
                      onChange={() => {
                        const newRoles = u.roles.includes(r)
                          ? u.roles.filter((x: string) => x !== r)
                          : [...u.roles, r];
                        updateRoles(u.userId, newRoles);
                      }}
                    />
                    {" "}{r}
                  </label>
                ))}
              </td>
              <td style={{ padding: 8 }}>
                <span style={{ fontSize: 12, color: "#53668d" }}>
                  {u.userId.slice(0, 8)}…
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


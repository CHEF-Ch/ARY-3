import { useState, useEffect } from "react";

interface User {
  userId: string;
  displayName: string;
  roles: string[];
}

function OrganizerApplications() {
  const [apps, setApps] = useState<any[]>([]);

  const load = () => {
    fetch("/admin/applications", { credentials: "include" })
      .then((r) => r.json())
      .then(setApps)
      .catch(() => {});
  };

  useEffect(() => { load(); }, []);

  const pendingApps = apps.filter((a: any) => a.status === "pending");
  if (pendingApps.length === 0) return null;

  const handle = (id: string, action: "approve" | "reject") => {
    fetch(`/admin/applications/${id}/${action}`, {
      method: "POST", credentials: "include",
    }).then(() => load());
  };

  return (
    <div style={{ marginTop: 32 }}>
      <h2 style={{ fontSize: 20, marginBottom: 12 }}>主办方审核队列</h2>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid rgba(34,107,230,0.18)" }}>
            <th style={{ padding: 8 }}>用户名</th>
            <th style={{ padding: 8 }}>申请时间</th>
            <th style={{ padding: 8 }}>操作</th>
          </tr>
        </thead>
        <tbody>
          {pendingApps.map((a: any) => (
            <tr key={a.id} style={{ borderBottom: "1px solid rgba(34,107,230,0.08)" }}>
              <td style={{ padding: 8 }}>{a.username}</td>
              <td style={{ padding: 8, fontSize: 13, color: "#53668d" }}>
                {a.createdAt ? new Date(a.createdAt).toLocaleDateString() : "—"}
              </td>
              <td style={{ padding: 8 }}>
                <button onClick={() => handle(a.id, "approve")} style={approveBtn}>✓ 通过</button>
                <button onClick={() => handle(a.id, "reject")} style={rejectBtn}>✗ 拒绝</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const approveBtn: React.CSSProperties = {
  marginRight: 8, padding: "4px 12px",
  border: "1px solid rgba(34,180,80,0.3)", borderRadius: 6,
  background: "rgba(230,255,240,0.7)", color: "#2a8040",
  fontSize: 12, fontWeight: 700, cursor: "pointer",
};

const rejectBtn: React.CSSProperties = {
  padding: "4px 12px",
  border: "1px solid rgba(200,60,60,0.25)", borderRadius: 6,
  background: "rgba(255,240,240,0.7)", color: "#a03030",
  fontSize: 12, fontWeight: 700, cursor: "pointer",
};

export default function AdminView({ user }: { user: User }) {
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
      setMessage("角色已更新");
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
            <th style={{ padding: 8 }}>用户名</th>
            <th style={{ padding: 8 }}>显示名</th>
            <th style={{ padding: 8 }}>资料</th>
            <th style={{ padding: 8 }}>角色</th>
            <th style={{ padding: 8 }}>ID</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u: any) => (
            <tr key={u.userId} style={{ borderBottom: "1px solid rgba(34,107,230,0.08)" }}>
              <td style={{ padding: 8 }}>{u.username || u.githubAccount}</td>
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
                    />{" "}{r}
                  </label>
                ))}
              </td>
              <td style={{ padding: 8 }}>
                <span style={{ fontSize: 12, color: "#53668d" }}>{u.userId.slice(0, 8)}…</span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <OrganizerApplications />
    </div>
  );
}

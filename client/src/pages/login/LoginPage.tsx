import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../App";

type Role = "rider" | "organizer";

export default function LoginPage() {
  const [step, setStep] = useState<"choose" | "login" | "register">("choose");
  const [role, setRole] = useState<Role>("rider");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [error, setError] = useState("");
  const { login } = useAuth();
  const navigate = useNavigate();

  const openForm = (mode: "login" | "register", r: Role) => {
    setRole(r);
    setStep(mode);
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    const isRegister = step === "register";
    const endpoint = isRegister ? "/auth/register" : "/auth/login";
    const body: any = { username, password, role };
    if (isRegister) body.displayName = displayName;

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Request failed"); return; }

      login(data);
      navigate(role === "organizer" ? "/console" : "/console");
    } catch {
      setError("Network error — is the server running?");
    }
  };

  const label = role === "organizer" ? "主办方" : "骑手";

  // ── Step 1: Role selection ──
  if (step === "choose") {
    return (
      <div style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", maxWidth: 620 }}>
          <h1 style={{ fontSize: 36, fontWeight: 950, color: "#06164a", marginBottom: 8 }}>
            Agent Racing Yard
          </h1>
          <p style={{ color: "#53668d", fontSize: 16, marginBottom: 40 }}>选择你的身份进入 ARY</p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            {/* Rider card */}
            <div
              style={{
                padding: "32px 24px",
                border: "1px solid rgba(34,107,230,0.22)",
                borderRadius: 18,
                background: "rgba(255,255,255,0.85)",
                backdropFilter: "blur(14px)",
                boxShadow: "0 14px 36px rgba(11,57,150,0.1)",
                cursor: "pointer",
              }}
            >
              <div style={{ fontSize: 48, marginBottom: 12 }}>&#127943;</div>
              <h2 style={{ fontSize: 22, fontWeight: 950, color: "#06164a", marginBottom: 8 }}>骑手 Rider</h2>
              <p style={{ color: "#53668d", fontSize: 14, lineHeight: 1.6, marginBottom: 20, minHeight: 44 }}>
                报名参赛、接入 CA、提交作品、查看评审结果
              </p>
              <button onClick={() => openForm("login", "rider")} style={btnPrimary}>
                登录
              </button>
              <div style={{ marginTop: 8 }}>
                <button onClick={() => openForm("register", "rider")} style={btnLink}>
                  注册成为骑手
                </button>
              </div>
            </div>

            {/* Organizer card */}
            <div
              style={{
                padding: "32px 24px",
                border: "1px solid rgba(34,107,230,0.22)",
                borderRadius: 18,
                background: "rgba(255,255,255,0.85)",
                backdropFilter: "blur(14px)",
                boxShadow: "0 14px 36px rgba(11,57,150,0.1)",
                cursor: "pointer",
              }}
            >
              <div style={{ fontSize: 48, marginBottom: 12 }}>&#127905;</div>
              <h2 style={{ fontSize: 22, fontWeight: 950, color: "#06164a", marginBottom: 8 }}>主办方 Organizer</h2>
              <p style={{ color: "#53668d", fontSize: 14, lineHeight: 1.6, marginBottom: 20, minHeight: 44 }}>
                创建赛事、管理报名、分配评委、发布赛果。注册后需管理员审核开通。
              </p>
              <button onClick={() => openForm("login", "organizer")} style={btnPrimary}>
                登录
              </button>
              <div style={{ marginTop: 8 }}>
                <button onClick={() => openForm("register", "organizer")} style={btnLink}>
                  注册主办方账号
                </button>
              </div>
            </div>
          </div>

          <p style={{ marginTop: 32, color: "#aaa", fontSize: 13 }}>
            评委和教练身份由骑手申请、管理员审批后开通
          </p>

          <p style={{ marginTop: 8 }}>
            <Link to="/" style={{ fontSize: 13, color: "#53668d" }}>← 回到首页</Link>
          </p>
        </div>
      </div>
    );
  }

  // ── Step 2: Login / Register form ──
  const isRegister = step === "register";

  return (
    <div style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <form onSubmit={handleSubmit} style={formStyle}>
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 36 }}>{role === "organizer" ? "🏟️" : "🏇"}</div>
          <h1 style={{ fontSize: 22, fontWeight: 950, color: "#06164a", margin: "8px 0 4px" }}>
            {isRegister ? "注册" : "登录"} — {label}
          </h1>
        </div>

        {error && (
          <div style={errorStyle}>{error}</div>
        )}

        {role === "organizer" && isRegister && (
          <div style={noticeStyle}>
            主办方账号注册后需等待管理员审核开通 organizer 角色。审核通过前可正常登录但无法创建赛事。
          </div>
        )}

        <label style={labelStyle}>用户名</label>
        <input value={username} onChange={(e) => setUsername(e.target.value)} style={inputStyle} placeholder="your-username" />

        <label style={labelStyle}>密码</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={inputStyle} placeholder="••••••••" />

        {isRegister && (
          <>
            <label style={labelStyle}>显示名称</label>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} style={inputStyle} placeholder="你的名字" />
          </>
        )}

        <a
          href="http://localhost:3000/auth/github"
          style={{
            ...btnSubmit,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            background: "#24292e",
            textDecoration: "none",
            marginBottom: 12,
          }}
        >
          GitHub 登录
        </a>

        <button type="submit" style={btnSubmit}>{isRegister ? "注册" : "登录"}</button>

        <p style={{ textAlign: "center", marginTop: 14, fontSize: 13, color: "#53668d" }}>
          {isRegister ? "已有账号？" : "没有账号？"}{" "}
          <button type="button" onClick={() => setStep(isRegister ? "login" : "register")} style={btnLinkText}>
            {isRegister ? "去登录" : "去注册"}
          </button>
        </p>

        <p style={{ textAlign: "center", marginTop: 8 }}>
          <button type="button" onClick={() => setStep("choose")} style={btnLinkText}>← 返回身份选择</button>
        </p>
      </form>
    </div>
  );
}

const formStyle: React.CSSProperties = {
  width: 380, padding: "28px 24px",
  border: "1px solid rgba(34,107,230,0.18)", borderRadius: 18,
  background: "rgba(255,255,255,0.85)", backdropFilter: "blur(14px)",
  boxShadow: "0 18px 44px rgba(11,57,150,0.12)",
};

const labelStyle: React.CSSProperties = { display: "block", fontSize: 13, fontWeight: 700, color: "#344a7b", marginBottom: 4 };

const inputStyle: React.CSSProperties = {
  width: "100%", padding: "10px 12px", marginBottom: 14,
  border: "1px solid rgba(34,107,230,0.22)", borderRadius: 10, fontSize: 15,
  outline: "none", boxSizing: "border-box",
};

const btnPrimary: React.CSSProperties = {
  width: "100%", padding: "10px", border: "none", borderRadius: 10,
  background: "linear-gradient(135deg, #0a3fb8, #168cff)", color: "#fff",
  fontSize: 15, fontWeight: 900, cursor: "pointer",
};

const btnLink: React.CSSProperties = {
  width: "100%", padding: "8px", border: "1px solid rgba(34,107,230,0.15)", borderRadius: 10,
  background: "transparent", color: "#075bec", fontSize: 14, fontWeight: 700, cursor: "pointer",
};

const btnLinkText: React.CSSProperties = {
  border: "none", background: "transparent", color: "#075bec", fontWeight: 700, cursor: "pointer", fontSize: 13,
};

const btnSubmit: React.CSSProperties = {
  width: "100%", padding: "12px", marginTop: 6, border: "none", borderRadius: 12,
  background: "linear-gradient(135deg, #0a3fb8, #168cff)", color: "#fff",
  fontSize: 16, fontWeight: 900, cursor: "pointer",
};

const errorStyle: React.CSSProperties = {
  padding: "8px 12px", marginBottom: 14,
  background: "#fff0f0", border: "1px solid rgba(220,50,50,0.2)", borderRadius: 8,
  color: "#c53030", fontSize: 13,
};

const noticeStyle: React.CSSProperties = {
  padding: "8px 12px", marginBottom: 14,
  background: "#fffdf0", border: "1px solid rgba(200,160,30,0.2)", borderRadius: 8,
  color: "#8a7030", fontSize: 12, lineHeight: 1.5,
};

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

// Simple auth state — will connect to server in later modules
const API = "";

export default function Header() {
  const [user, setUser] = useState<any>(null);
  const navigate = useNavigate();

  const handleLogin = async () => {
    // Open GitHub OAuth flow
    // For development: prompt for GitHub username
    const githubAccount = prompt("Enter GitHub username (dev mode):");
    if (!githubAccount) return;

    try {
      const res = await fetch("/auth/github", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ githubAccount }),
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
        navigate("/console");
      }
    } catch (err) {
      console.error("Login failed:", err);
    }
  };

  const handleLogout = async () => {
    await fetch("/auth/logout", { method: "POST", credentials: "include" });
    setUser(null);
    navigate("/");
  };

  return (
    <header
      style={{
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        padding: "12px 32px",
        borderBottom: "1px solid rgba(34,107,230,0.18)",
        background: "rgba(255,255,255,0.72)",
        backdropFilter: "blur(14px)",
      }}
    >
      <Link to="/" style={{ fontWeight: 900, fontSize: 20, color: "#06164a", textDecoration: "none" }}>
        Agent Racing Yard
      </Link>

      <nav style={{ display: "flex", gap: 20 }}>
        <Link to="/">Races</Link>
        <Link to="/works">Works</Link>
        <Link to="/riders/1">Riders</Link>
        <Link to="/cooperation">Cooperation</Link>
      </nav>

      <div>
        {user ? (
          <span>
            {user.displayName}{" "}
            <button onClick={handleLogout}>Logout</button>
          </span>
        ) : (
          <button
            onClick={handleLogin}
            style={{
              padding: "6px 16px",
              border: "1px solid rgba(34,107,230,0.18)",
              borderRadius: 8,
              background: "rgba(255,255,255,0.58)",
              color: "#0a3fb8",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Login
          </button>
        )}
      </div>
    </header>
  );
}

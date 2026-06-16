import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../App";

const navLink = (to: string, label: string, current: string) => {
  const active = current === to || (to !== "/" && current.startsWith(to));
  return (
    <Link
      to={to}
      style={{
        color: active ? "#075bec" : "#53668d",
        fontWeight: active ? 900 : 500,
        textDecoration: "none",
        borderBottom: active ? "2px solid #075bec" : "2px solid transparent",
        paddingBottom: 4,
        transition: "border-color 150ms ease, color 150ms ease",
      }}
    >
      {label}
    </Link>
  );
};

export default function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const path = location.pathname;

  const handleLogout = async () => {
    await logout();
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
      <Link
        to="/"
        style={{ fontWeight: 900, fontSize: 20, color: "#06164a", textDecoration: "none" }}
      >
        Agent Racing Yard
      </Link>

      <nav style={{ display: "flex", gap: 20, alignItems: "flex-end" }}>
        {navLink("/", "Races", path)}
        {navLink("/works", "Works", path)}
        {navLink("/riders", "Riders", path)}
        {navLink("/cooperation", "Cooperation", path)}
      </nav>

      <div>
        {user ? (
          <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 14, color: "#53668d" }}>{user.displayName}</span>
            <Link
              to="/console"
              style={{
                padding: "4px 12px",
                border: "1px solid rgba(34,107,230,0.25)",
                borderRadius: 6,
                fontSize: 13,
                fontWeight: 700,
                color: "#075bec",
                textDecoration: "none",
              }}
            >
              Workspace
            </Link>
            <button
              onClick={handleLogout}
              style={{
                padding: "4px 10px",
                border: "none",
                background: "transparent",
                color: "#53668d",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Logout
            </button>
          </span>
        ) : (
          <Link
            to="/login"
            style={{
              padding: "6px 16px",
              border: "1px solid rgba(34,107,230,0.18)",
              borderRadius: 8,
              background: "rgba(255,255,255,0.58)",
              color: "#0a3fb8",
              fontWeight: 700,
              textDecoration: "none",
            }}
          >
            Login
          </Link>
        )}
      </div>
    </header>
  );
}

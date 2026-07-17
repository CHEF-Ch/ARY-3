import { useState, useEffect, createContext, useContext } from "react";
import { Routes, Route } from "react-router-dom";
import Header from "./shared/Header";
import HomePage from "./pages/home/HomePage";
import RacePage from "./pages/race/RacePage";
import LivePage from "./pages/live/LivePage";
import WorksPage from "./pages/works/WorksPage";
import ResultsPage from "./pages/results/ResultsPage";
import ReviewPage from "./pages/review/ReviewPage";
import RiderPage from "./pages/rider/RiderPage";
import CooperationPage from "./pages/cooperation/CooperationPage";
import ConsoleShell from "./pages/console/ConsoleShell";
import ScreenPage from "./pages/screen/ScreenPage";
import LoginPage from "./pages/login/LoginPage";

// Shared auth context so Header and Console share login state
interface AuthState {
  user: any | null;
  login: (user: any) => void;
  logout: () => void;
}
export const AuthContext = createContext<AuthState>({ user: null, login: () => {}, logout: () => {} });
export const useAuth = () => useContext(AuthContext);

export default function App() {
  const [user, setUser] = useState<any | null>(null);

  useEffect(() => {
    // Check existing session on mount
    fetch("/auth/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { if (data) setUser(data); })
      .catch(() => {});
  }, []);

  const login = (u: any) => setUser(u);
  const logout = async () => {
    await fetch("/auth/logout", { method: "POST", credentials: "include" });
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      <div style={{ minHeight: "100vh", background: "#eef6ff", color: "#07163e" }}>
        <Header />
        <main style={{ padding: "24px 32px" }}>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/races/:slug" element={<RacePage />} />
            <Route path="/races/:slug/live" element={<LivePage />} />
            <Route path="/works" element={<WorksPage />} />
            <Route path="/works/:slug" element={<WorksPage />} />
            <Route path="/races/:slug/results" element={<ResultsPage />} />
            <Route path="/races/:slug/review" element={<ReviewPage />} />
            <Route path="/riders/:slug" element={<RiderPage />} />
            <Route path="/cooperation" element={<CooperationPage />} />
            <Route path="/console" element={<ConsoleShell />} />
            <Route path="/console/screen/:slug" element={<ScreenPage />} />
          </Routes>
        </main>
      </div>
    </AuthContext.Provider>
  );
}

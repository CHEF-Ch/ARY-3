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
import ConsolePage from "./pages/console/ConsolePage";
import ScreenPage from "./pages/screen/ScreenPage";

export default function App() {
  return (
    <div style={{ minHeight: "100vh", background: "#eef6ff", color: "#07163e" }}>
      <Header />
      <main style={{ padding: "24px 32px" }}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/races/:slug" element={<RacePage />} />
          <Route path="/races/:slug/live" element={<LivePage />} />
          <Route path="/works" element={<WorksPage />} />
          <Route path="/works/:slug" element={<WorksPage />} />
          <Route path="/races/:slug/results" element={<ResultsPage />} />
          <Route path="/races/:slug/review" element={<ReviewPage />} />
          <Route path="/riders/:slug" element={<RiderPage />} />
          <Route path="/cooperation" element={<CooperationPage />} />
          <Route path="/console" element={<ConsolePage />} />
          <Route path="/console/screen/:slug" element={<ScreenPage />} />
        </Routes>
      </main>
    </div>
  );
}

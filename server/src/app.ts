import express from "express";
import session from "express-session";
import cors from "cors";
import { runMigrations } from "./db.js";
import { registerIdentityRoutes } from "./modules/identity/routes.js";
import { registerCommunicationRoutes } from "./modules/communication/routes.js";
import { registerRaceMgmtRoutes } from "./modules/race-mgmt/routes.js";
import { registerPortfolioRoutes } from "./modules/portfolio/routes.js";

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ──
app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(express.json());
app.use(
  session({
    secret: process.env.SESSION_SECRET || "ary-dev-secret-change-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, httpOnly: true, maxAge: 24 * 60 * 60 * 1000 },
  }),
);

// ── Run database migrations ──
runMigrations();

// ── Module routes ──
// To add a new module: import its register function and call it here.
// Each module gets its own URL prefix and manages its own routes internally.
registerIdentityRoutes(app);       // /auth/*, /admin/*
registerCommunicationRoutes(app);  // /communication/*
registerRaceMgmtRoutes(app);       // /races/*
registerPortfolioRoutes(app);      // /works/*

// ── Future modules (uncomment when ready) ──
// import { registerProjectionRoutes } from "./modules/projection/routes.js";
// registerProjectionRoutes(app);     // /projections/*
// import { registerReportGenRoutes } from "./modules/report-gen/routes.js";
// registerReportGenRoutes(app);      // /reports/*

// ── Health check ──
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// ── Global error handler ──
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error("[ARY] Unhandled error:", err.message || err);
  res.status(err.status || 500).json({
    error: err.message || "Internal server error",
  });
});

// ── Start ──
app.listen(PORT, () => {
  console.log(`[ARY] Server running on http://localhost:${PORT}`);
});

export default app;

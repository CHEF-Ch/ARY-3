import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// Load .env at startup (before any other imports need env vars)
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "..", ".env");
if (existsSync(envPath)) {
  readFileSync(envPath, "utf-8").split("\n").forEach((line) => {
    const [key, ...rest] = line.split("=");
    if (key && rest.length && !key.startsWith("#")) {
      process.env[key.trim()] = rest.join("=").trim();
    }
  });
}

import express from "express";
import session from "express-session";
import passport from "passport";
import { Strategy as GitHubStrategy } from "passport-github2";
import cors from "cors";
import { v4 as uuid } from "uuid";
import { runMigrations, findAll, findBy, insert } from "./db.js";
import { registerIdentityRoutes } from "./modules/identity/routes.js";
import { registerCommunicationRoutes } from "./modules/communication/routes.js";
import { registerRaceMgmtRoutes } from "./modules/race-mgmt/routes.js";
import { registerPortfolioRoutes } from "./modules/portfolio/routes.js";
import { registerReportGenRoutes } from "./modules/report-gen/routes.js";
import { registerProjectionRoutes } from "./modules/projection/routes.js";

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ──
app.use(cors({ origin: "http://localhost:5173", credentials: true }));
app.use(express.json({ limit: "256kb" }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || "ary-dev-secret-change-in-production",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false, httpOnly: true, maxAge: 24 * 60 * 60 * 1000 },
  }),
);

// ── Passport (GitHub OAuth) ──
passport.use(
  new GitHubStrategy(
    {
      clientID: process.env.GITHUB_CLIENT_ID || "ary-dev-github-client-id",
      clientSecret: process.env.GITHUB_CLIENT_SECRET || "ary-dev-github-client-secret",
      callbackURL: `http://localhost:${PORT}/auth/github/callback`,
      scope: ["user:email"],
    },
    (_accessToken: string, _refreshToken: string, profile: any, done: any) => {
      const githubAccount = profile.username || profile.id;
      let user = findBy("users", "githubAccount", githubAccount);
      if (!user) {
        user = {
          id: uuid(),
          githubAccount,
          displayName: profile.displayName || githubAccount,
          profileCompleted: !!profile.displayName,
          roles: ["rider"],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        insert("users", user);
      }
      done(null, { id: user.id } as any);
    },
  ),
);

passport.serializeUser((user: any, done) => done(null, user.id));
passport.deserializeUser((id: string, done) => {
  import("./db.js").then(({ findById }) => {
    const row = findById("users", id);
    done(null, row || null);
  });
});
app.use(passport.initialize());
app.use(passport.session());

// ── Run database migrations ──
runMigrations();

// ── Module routes ──
// To add a new module: import its register function and call it here.
// Each module gets its own URL prefix and manages its own routes internally.
registerIdentityRoutes(app);       // /auth/*, /admin/*
registerCommunicationRoutes(app);  // /communication/*
registerRaceMgmtRoutes(app);       // /races/*
registerPortfolioRoutes(app);      // /works/*
registerReportGenRoutes(app);      // /reports/*

registerProjectionRoutes(app);     // /projections/*

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

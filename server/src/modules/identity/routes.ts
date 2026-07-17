import type { Express, Request, Response } from "express";
import { Router } from "express";
import { v4 as uuid } from "uuid";
import { createHash } from "node:crypto";
import passport from "passport";
import { findAll, findById, findBy, insert, update } from "../../db.js";
import { reqUser, requireLogin, requireAdmin, authorize } from "../../shared/auth.js";
import type { RoleType, User } from "../../shared/types.js";

const VALID_ROLES: RoleType[] = ["rider", "judge", "organizer", "admin"];

function hashPassword(password: string): string {
  return createHash("sha256").update("ary-salt-" + password).digest("hex");
}

export function registerIdentityRoutes(app: Express): void {
  const auth = Router();
  const admin = Router();

  // ── Register ──
  auth.post("/register", (req: Request, res: Response) => {
    const { username, password, displayName, role } = req.body;
    if (!username || !password) {
      res.status(400).json({ error: "username and password are required" });
      return;
    }
    if (username.length < 3 || password.length < 6) {
      res.status(400).json({ error: "Username must be 3+ chars, password must be 6+ chars" });
      return;
    }

    const existing = findBy<User>("users", "username", username);
    if (existing) {
      res.status(409).json({ error: "Username already taken" });
      return;
    }

    // Everyone is a rider by default.
    // Organizer role must be approved by admin — it is NOT auto-assigned.
    const roles: RoleType[] = ["rider"];

    const user: User = {
      id: uuid(),
      username,
      passwordHash: hashPassword(password),
      displayName: displayName || username,
      profileCompleted: !!displayName,
      roles,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    insert("users", user);

    // Track organizer applications for admin review
    if (role === "organizer") {
      insert("organizer_applications", {
        id: uuid(),
        userId: user.id,
        username,
        status: "pending",
        createdAt: new Date().toISOString(),
      });
    }

    // Auto-login after registration
    req.session.userId = user.id;
    req.session.save((err) => {
      if (err) { res.status(500).json({ error: "Session save failed" }); return; }
      res.status(201).json(toUserResponse(user));
    });
  });

  // ── Login ──
  auth.post("/login", (req: Request, res: Response) => {
    const { username, password } = req.body;
    if (!username || !password) {
      res.status(400).json({ error: "username and password are required" });
      return;
    }

    const user = findBy<User>("users", "username", username);
    if (!user || user.passwordHash !== hashPassword(password)) {
      res.status(401).json({ error: "Invalid username or password" });
      return;
    }

    req.session.userId = user.id;
    req.session.save((err) => {
      if (err) { res.status(500).json({ error: "Session save failed" }); return; }
      res.json(toUserResponse(user));
    });
  });

  // ── DCR Peer Login ──
  // DCR Desktop App calls this to register a login attempt before opening browser
  auth.post("/peer-attempts", (req: Request, res: Response) => {
    const { loginAttemptId, state, redirectUri, bindSecretHash, expiresAt, stateHash } = req.body;
    if (!loginAttemptId || !state) {
      res.status(400).json({ error: "loginAttemptId and state are required" });
      return;
    }
    // Store attempt for callback verification
    insert("dcr_login_attempts", {
      loginAttemptId,
      state,
      redirectUri,
      bindSecretHash,
      expiresAt,
      stateHash,
      createdAt: new Date().toISOString(),
    });
    // Return the peerLoginUrl that DCR will open in browser
    res.json({
      loginAttemptId,
      peerLoginUrl: `http://localhost:3001/auth/github/start?loginAttemptId=${encodeURIComponent(loginAttemptId)}&state=${encodeURIComponent(state)}`,
    });
  });

  // DCR redirects user here → start GitHub OAuth
  auth.get("/github/start", (req: Request, res: Response, next) => {
    const { loginAttemptId, state } = req.query;
    if (loginAttemptId) {
      req.session.dcrLoginAttemptId = loginAttemptId as string;
      req.session.dcrState = state as string;
      req.session.save(() => next());
    } else {
      next();
    }
  }, passport.authenticate("github", { scope: ["user:email"] }));

  // Regular GitHub OAuth (for web users)
  auth.get("/github", passport.authenticate("github", { scope: ["user:email"] }));

  // GitHub OAuth callback
  auth.get(
    "/github/callback",
    passport.authenticate("github", { failureRedirect: "http://localhost:5173/login" }),
    (req: Request, res: Response) => {
      req.session.userId = (req.user as any).id;
      req.session.save(() => {
        // If this was a DCR login, redirect back to DCR's peer-auth-bridge
        if (req.session.dcrLoginAttemptId && req.session.dcrState) {
          const attempt = findBy("dcr_login_attempts", "loginAttemptId", req.session.dcrLoginAttemptId) as any;
          if (attempt?.redirectUri) {
            const redirectUrl = new URL(attempt.redirectUri);
            redirectUrl.searchParams.set("state", req.session.dcrState);
            redirectUrl.searchParams.set("loginAttemptId", req.session.dcrLoginAttemptId);
            redirectUrl.searchParams.set("userId", (req.user as any).id);
            return res.redirect(redirectUrl.toString());
          }
        }
        // Regular web login → go to console
        res.redirect("http://localhost:5173/console");
      });
    },
  );

  // ── Current user ──
  auth.get("/me", requireLogin, (req: Request, res: Response) => {
    const user = reqUser(req);
    const row = findById<User>("users", user.userId);
    if (!row) { res.status(404).json({ error: "User not found" }); return; }
    res.json(toUserResponse(row));
  });

  // ── Update profile ──
  auth.patch("/me", requireLogin, (req: Request, res: Response) => {
    const user = reqUser(req);
    const result = authorize(user, "User", "update_profile", { ownerUserId: user.userId });
    if (!result.allowed) { res.status(403).json({ error: result.reason }); return; }

    const { displayName } = req.body;
    if (!displayName || typeof displayName !== "string") {
      res.status(400).json({ error: "displayName is required" }); return;
    }

    update<User>("users", user.userId, {
      displayName,
      profileCompleted: true,
      updatedAt: new Date().toISOString(),
    } as any);
    res.json({ ok: true, displayName });
  });

  // ── Logout ──
  auth.post("/logout", (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) { res.status(500).json({ error: "Logout failed" }); return; }
      res.clearCookie("connect.sid");
      res.json({ ok: true });
    });
  });

  // ── Admin: List users ──
  admin.get("/users", requireLogin, requireAdmin, (_req: Request, res: Response) => {
    const rows = findAll<User>("users");
    res.json(rows.map(toUserResponse));
  });

  // ── Admin: Update user roles ──
  admin.put("/users/:id/roles", requireLogin, requireAdmin, (req: Request, res: Response) => {
    const { roles } = req.body;
    if (!Array.isArray(roles)) { res.status(400).json({ error: "roles must be an array" }); return; }
    for (const r of roles) {
      if (!VALID_ROLES.includes(r)) { res.status(400).json({ error: `Invalid role: ${r}` }); return; }
    }

    const target = findById<User>("users", req.params.id);
    if (!target) { res.status(404).json({ error: "User not found" }); return; }

    update<User>("users", req.params.id, {
      roles: roles as any,
      updatedAt: new Date().toISOString(),
    } as any);
    res.json({ ok: true, userId: req.params.id, roles });
  });

  // ── Admin: List organizer applications ──
  admin.get("/applications", requireLogin, requireAdmin, (_req: Request, res: Response) => {
    res.json(findAll("organizer_applications"));
  });

  // ── Admin: Approve organizer application ──
  admin.post("/applications/:id/approve", requireLogin, requireAdmin, (req: Request, res: Response) => {
    const app = findById("organizer_applications", req.params.id) as any;
    if (!app) { res.status(404).json({ error: "Application not found" }); return; }

    const user = findById<User>("users", app.userId);
    if (user) {
      const newRoles = [...new Set([...user.roles, "organizer"])] as RoleType[];
      update<User>("users", app.userId, { roles: newRoles as any, updatedAt: new Date().toISOString() } as any);
    }

    update("organizer_applications", req.params.id, { status: "approved" } as any);
    res.json({ ok: true, userId: app.userId, roles: user ? [...user.roles, "organizer"] : ["organizer"] });
  });

  // ── Admin: Reject organizer application ──
  admin.post("/applications/:id/reject", requireLogin, requireAdmin, (req: Request, res: Response) => {
    const app = findById("organizer_applications", req.params.id) as any;
    if (!app) { res.status(404).json({ error: "Application not found" }); return; }
    update("organizer_applications", req.params.id, { status: "rejected" } as any);
    res.json({ ok: true, id: req.params.id, status: "rejected" });
  });

  app.use("/auth", auth);
  app.use("/admin", admin);
  console.log("[identity] Routes registered: /auth/*, /admin/*");
}

function toUserResponse(u: User) {
  return {
    userId: u.id,
    username: u.username,
    displayName: u.displayName,
    profileCompleted: u.profileCompleted,
    roles: u.roles,
  };
}

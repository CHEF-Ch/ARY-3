import type { Express, Request, Response } from "express";
import { Router } from "express";
import { v4 as uuid } from "uuid";
import { findAll, findById, findBy, insert, update } from "../../db.js";
import { getCurrentUser, requireLogin, authorize } from "../../shared/auth.js";
import type { RoleType, User } from "../../shared/types.js";

const VALID_ROLES: RoleType[] = ["rider", "judge", "organizer", "admin"];

export function registerIdentityRoutes(app: Express): void {
  const auth = Router();
  const admin = Router();

  // ── GitHub OAuth (simplified for dev) ──
  auth.post("/github", (req: Request, res: Response) => {
    const { githubAccount, displayName } = req.body;

    if (!githubAccount || typeof githubAccount !== "string") {
      res.status(400).json({ error: "githubAccount is required" });
      return;
    }

    // Find existing user or create
    let user = findBy<User>("users", "githubAccount", githubAccount);

    if (!user) {
      user = {
        id: uuid(),
        githubAccount,
        displayName: displayName || githubAccount,
        profileCompleted: !!displayName,
        roles: [],
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      } as User;
      insert("users", user);
    }

    // Set session
    req.session.userId = user.id;
    req.session.save((err) => {
      if (err) {
        res.status(500).json({ error: "Session save failed" });
        return;
      }
      res.json(toUserResponse(user));
    });
  });

  // ── Current user ──
  auth.get("/me", requireLogin, (req: Request, res: Response) => {
    const user = getCurrentUser(req);
    if (!user) { res.status(401).json({ error: "Not authenticated" }); return; }

    const row = findById<User>("users", user.userId);
    if (!row) { res.status(404).json({ error: "User not found" }); return; }

    res.json(toUserResponse(row));
  });

  // ── Update profile ──
  auth.patch("/me", requireLogin, (req: Request, res: Response) => {
    const user = getCurrentUser(req);
    if (!user) { res.status(401).json({ error: "Not authenticated" }); return; }

    const result = authorize(user, "User", "update_profile", { ownerUserId: user.userId });
    if (!result.allowed) { res.status(403).json({ error: result.reason }); return; }

    const { displayName } = req.body;
    if (!displayName || typeof displayName !== "string") {
      res.status(400).json({ error: "displayName is required" });
      return;
    }

    const updated = update<User>("users", user.userId, {
      displayName,
      profileCompleted: true,
      updatedAt: new Date().toISOString(),
    });
    if (!updated) { res.status(404).json({ error: "User not found" }); return; }

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
  admin.get("/users", requireLogin, (req: Request, res: Response) => {
    const user = getCurrentUser(req);
    if (!user) { res.status(401).json({ error: "Not authenticated" }); return; }

    const result = authorize(user, "User", "update_roles", {});
    if (!result.allowed) { res.status(403).json({ error: result.reason }); return; }

    const rows = findAll<User>("users");
    res.json(rows.map(toUserResponse));
  });

  // ── Admin: Update user roles ──
  admin.put("/users/:id/roles", requireLogin, (req: Request, res: Response) => {
    const adminUser = getCurrentUser(req);
    if (!adminUser) { res.status(401).json({ error: "Not authenticated" }); return; }

    const result = authorize(adminUser, "User", "update_roles", {});
    if (!result.allowed) { res.status(403).json({ error: result.reason }); return; }

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
    });

    res.json({ ok: true, userId: req.params.id, roles });
  });

  app.use("/auth", auth);
  app.use("/admin", admin);
  console.log("[identity] Routes registered: /auth/*, /admin/*");
}

function toUserResponse(u: User) {
  return {
    userId: u.id,
    githubAccount: u.githubAccount,
    displayName: u.displayName,
    profileCompleted: u.profileCompleted,
    roles: u.roles,
  };
}

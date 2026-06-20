import type { Express, Request, Response } from "express";
import { Router } from "express";
import { v4 as uuid } from "uuid";
import { findAll, findById, filterBy, insert, update, remove } from "../../db.js";
import { getCurrentUser, requireLogin, authorize } from "../../shared/auth.js";

interface Announcement {
  id: string;
  race_id: string;
  title: string;
  body: string;
  visibility: string;
  published_at: string | null;
  created_at: string;
}

export function registerCommunicationRoutes(app: Express): void {
  const router = Router();

  // ── Public: List published announcements ──
  router.get("/announcements", (_req: Request, res: Response) => {
    const all = findAll<Announcement>("announcements");
    const published = all
      .filter(a => a.visibility === "public" && a.published_at)
      .sort((a, b) => (b.published_at || "").localeCompare(a.published_at || ""));
    res.json(published);
  });

  // ── Organizer: Create ──
  router.post("/announcements", requireLogin, (req: Request, res: Response) => {
    const user = getCurrentUser(req);
    const result = authorize(user!, "Announcement", "create", {});
    if (!result.allowed) { res.status(403).json({ error: result.reason }); return; }

    const { raceId, title, body } = req.body;
    if (!raceId || !title || !body) {
      res.status(400).json({ error: "raceId, title, and body are required" }); return;
    }

    const announcement: Announcement = {
      id: uuid(),
      race_id: raceId,
      title,
      body,
      visibility: "private",
      published_at: null,
      created_at: new Date().toISOString(),
    };
    insert("announcements", announcement);
    res.status(201).json(announcement);
  });

  // ── Organizer: Edit ──
  router.patch("/announcements/:id", requireLogin, (req: Request, res: Response) => {
    const user = getCurrentUser(req);
    const result = authorize(user!, "Announcement", "edit", {});
    if (!result.allowed) { res.status(403).json({ error: result.reason }); return; }

    const { title, body } = req.body;
    const updated = update<Announcement>("announcements", req.params.id, {
      ...(title ? { title } : {}),
      ...(body ? { body } : {}),
    } as any);
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    res.json(updated);
  });

  // ── Organizer: Publish ──
  router.post("/announcements/:id/publish", requireLogin, (req: Request, res: Response) => {
    const user = getCurrentUser(req);
    const result = authorize(user!, "Announcement", "publish", {});
    if (!result.allowed) { res.status(403).json({ error: result.reason }); return; }

    const updated = update<Announcement>("announcements", req.params.id, {
      visibility: "public",
      published_at: new Date().toISOString(),
    } as any);
    if (!updated) { res.status(404).json({ error: "Not found" }); return; }
    res.json(updated);
  });

  // ── Organizer: Hide ──
  router.delete("/announcements/:id", requireLogin, (req: Request, res: Response) => {
    const user = getCurrentUser(req);
    const result = authorize(user!, "Announcement", "hide", {});
    if (!result.allowed) { res.status(403).json({ error: result.reason }); return; }

    update<Announcement>("announcements", req.params.id, {
      visibility: "private",
      published_at: null,
    } as any);
    res.json({ ok: true });
  });

  // ── Public: Rider profile ──
  router.get("/riders/:slug", (req: Request, res: Response) => {
    const rider = findById("users", req.params.slug);
    if (!rider) { res.status(404).json({ error: "Rider not found" }); return; }

    // Cross-module aggregations — available once dependent tables exist
    const registrations = filterBy("registrations", "user_id", req.params.slug);
    const works = filterBy("works", "registration_id", "__any__"); // placeholder

    res.json({
      userId: (rider as any).id,
      displayName: (rider as any).displayName,
      registrations: registrations.length,
      roles: (rider as any).roles || [],
    });
  });

  app.use("/communication", router);
  console.log("[communication] Routes registered: /communication/*");
}

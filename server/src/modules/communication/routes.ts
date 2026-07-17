import type { Express, Request, Response } from "express";
import { Router } from "express";
import { v4 as uuid } from "uuid";
import { findAll, findById, filterBy, insert, update, remove } from "../../db.js";
import { reqUser, requireLogin, authorize } from "../../shared/auth.js";

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
    const user = reqUser(req);
    const result = authorize(user, "Announcement", "create", {});
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
    const user = reqUser(req);
    const result = authorize(user, "Announcement", "edit", {});
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
    const user = reqUser(req);
    const result = authorize(user, "Announcement", "publish", {});
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
    const user = reqUser(req);
    const result = authorize(user, "Announcement", "hide", {});
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

    // Cross-module aggregations — returns empty until dependent tables are created
    // When race-mgmt (B) creates the registrations table, this will start returning data
    const registrations = findAll("registrations").filter((r: any) => r.user_id === req.params.slug);
    const regIds = registrations.map((r: any) => r.id);
    const works = findAll("works").filter((w: any) => regIds.includes(w.registration_id) && w.visibility === "public");
    const awards = findAll("awards").filter((a: any) => regIds.includes(a.registration_id) && a.published_at);
    const raceIds = [...new Set(registrations.map((r: any) => r.race_id))];
    const races = findAll("races").filter((r: any) => raceIds.includes(r.id));

    res.json({
      userId: (rider as any).id,
      displayName: (rider as any).displayName,
      registrations: registrations.length,
      roles: (rider as any).roles || [],
      works: works.map((w: any) => ({ title: w.title, status: w.status })),
      awards: awards.map((a: any) => ({ name: a.award_name, rank: a.rank, race: a.race_id })),
      races: races.map((r: any) => ({ title: r.title, status: r.status })),
    });
  });

  app.use("/communication", router);
  console.log("[communication] Routes registered: /communication/*");
}

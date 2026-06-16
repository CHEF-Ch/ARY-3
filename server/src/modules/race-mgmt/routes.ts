import type { Express, Request, Response } from "express";
import { Router } from "express";
import { v4 as uuid } from "uuid";
import { findAll, findById, findBy, insert, update } from "../../db.js";
import { authorize, getCurrentUser, requireLogin } from "../../shared/auth.js";

const RACE_STATUSES = [
  "draft",
  "published",
  "registration",
  "running",
  "submitting",
  "judging",
  "completed",
  "archived",
] as const;

const REGISTRATION_STATUSES = [
  "submitted",
  "approved",
  "rejected",
  "withdrawn",
] as const;

const INGESTION_STATUSES = [
  "not_configured",
  "connected",
  "active",
  "failed",
] as const;

const CONNECTION_HEALTH = [
  "no_signal",
  "no_valid_signal",
  "healthy",
  "partial_failed",
] as const;

type RaceStatus = typeof RACE_STATUSES[number];

interface Race {
  id: string;
  slug: string;
  title: string;
  challenge: string;
  status: RaceStatus;
  visibility: "private" | "public";
  organizer_user_ids: string[];
  registration_opens_at: string | null;
  registration_closes_at: string | null;
  starts_at: string | null;
  ends_at: string | null;
  created_by_user_id: string;
  created_at: string;
  updated_at: string;
}

export function registerRaceMgmtRoutes(app: Express): void {
  const router = Router();

  router.get("/", (req: Request, res: Response) => {
    const races = findAll<Race>("races")
      .filter((race) => canReadRace(req, race))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));

    res.json(races.map(toRaceResponse));
  });

  router.get("/contract", (_req: Request, res: Response) => {
    res.json({
      module: "B",
      name: "race-mgmt",
      status: "stage-b0-contract",
      owns: [
        "races",
        "registrations",
        "race_projects",
        "ca_connections",
        "sessions",
      ],
      enums: {
        raceStatus: RACE_STATUSES,
        registrationStatus: REGISTRATION_STATUSES,
        ingestionStatus: INGESTION_STATUSES,
        connectionHealth: CONNECTION_HEALTH,
      },
      routes: {
        stageB0: [
          "GET /races/contract",
        ],
        planned: [
          "POST /races",
          "GET /races",
          "GET /races/:slug",
          "PATCH /races/:id",
          "POST /races/:id/publish",
          "POST /races/:id/archive",
          "POST /races/:id/registrations",
          "GET /races/:id/registrations",
          "POST /registrations/:id/approve",
          "POST /registrations/:id/reject",
          "POST /registrations/:id/withdraw",
          "GET /race-projects/:id",
          "GET /registrations/:id/race-project",
          "POST /race-projects/:id/ca-connections",
          "GET /race-projects/:id/ca-connections",
          "PATCH /ca-connections/:id",
          "POST /ca-connections/:id/handshake",
          "POST /ca-connections/:id/disable",
          "POST /ca-connections/:id/sessions/push",
          "GET /ca-connections/:id/sessions",
        ],
      },
      invariants: [
        "One user can have at most one registration per race.",
        "Approving a registration must idempotently create exactly one race project.",
        "A race project can have zero or more CA connections.",
        "Only registered, handshaken, correctly owned, enabled CA connections can produce valid sessions.",
        "CA ingestion failed or not_configured does not withdraw a registration.",
      ],
      outOfScope: [
        "works",
        "judge_assignments",
        "judging_records",
        "awards",
        "evidences",
        "projections",
        "reports",
      ],
      humanReview: {
        purpose: "Confirm B module boundary, route plan, status enums, invariants, and out-of-scope items before implementing race CRUD.",
        nextStage: "B1 Race CRUD and public Race Page",
      },
    });
  });

  router.get("/review", requireLogin, (req: Request, res: Response) => {
    const user = getCurrentUser(req);
    const races = findAll<Race>("races");

    const visible = races.filter((race) => {
      if (user?.roles.includes("admin")) return true;
      return race.organizer_user_ids.includes(user?.userId || "");
    });

    res.json({
      module: "B",
      stage: "B1",
      purpose: "Human review for Race CRUD, public visibility, status, organizer scope, and CTA derivation.",
      totalRaces: races.length,
      reviewableRaces: visible.map((race) => ({
        id: race.id,
        slug: race.slug,
        title: race.title,
        status: race.status,
        visibility: race.visibility,
        organizerUserIds: race.organizer_user_ids,
        publicReadable: isPublicRace(race),
        cta: deriveRaceCta(race),
      })),
    });
  });

  router.post("/", requireLogin, (req: Request, res: Response) => {
    const user = getCurrentUser(req);
    const result = authorize(user, "Race", "create", {});
    if (!result.allowed) { res.status(403).json({ error: result.reason }); return; }

    const { title, slug, challenge, registrationOpensAt, registrationClosesAt, startsAt, endsAt } = req.body;
    if (!title || typeof title !== "string") {
      res.status(400).json({ error: "title is required" });
      return;
    }

    const normalizedSlug = normalizeSlug(slug || title);
    if (!normalizedSlug) {
      res.status(400).json({ error: "slug or title must produce a valid slug" });
      return;
    }

    const existing = findBy<Race>("races", "slug", normalizedSlug);
    if (existing) {
      res.status(409).json({ error: "slug already exists" });
      return;
    }

    const now = new Date().toISOString();
    const race: Race = {
      id: uuid(),
      slug: normalizedSlug,
      title: title.trim(),
      challenge: typeof challenge === "string" ? challenge.trim() : "",
      status: "draft",
      visibility: "private",
      organizer_user_ids: [user!.userId],
      registration_opens_at: optionalString(registrationOpensAt),
      registration_closes_at: optionalString(registrationClosesAt),
      starts_at: optionalString(startsAt),
      ends_at: optionalString(endsAt),
      created_by_user_id: user!.userId,
      created_at: now,
      updated_at: now,
    };

    insert("races", race);
    res.status(201).json(toRaceResponse(race));
  });

  router.get("/:slug", (req: Request, res: Response) => {
    const race = findBy<Race>("races", "slug", req.params.slug);
    if (!race || !canReadRace(req, race)) {
      res.status(404).json({ error: "Race not found" });
      return;
    }

    res.json(toRaceResponse(race));
  });

  router.patch("/:id", requireLogin, (req: Request, res: Response) => {
    const race = findById<Race>("races", req.params.id);
    if (!race) { res.status(404).json({ error: "Race not found" }); return; }

    const auth = authorizeManagedRace(req, race, "edit");
    if (!auth.allowed) { res.status(403).json({ error: auth.reason }); return; }

    const updates: Partial<Race> = {};
    const { title, challenge, status, registrationOpensAt, registrationClosesAt, startsAt, endsAt } = req.body;

    if (title !== undefined) {
      if (!title || typeof title !== "string") { res.status(400).json({ error: "title must be a non-empty string" }); return; }
      updates.title = title.trim();
    }
    if (challenge !== undefined) {
      if (typeof challenge !== "string") { res.status(400).json({ error: "challenge must be a string" }); return; }
      updates.challenge = challenge.trim();
    }
    if (status !== undefined) {
      if (!isRaceStatus(status)) { res.status(400).json({ error: "Invalid race status" }); return; }
      updates.status = status;
    }
    if (registrationOpensAt !== undefined) updates.registration_opens_at = optionalString(registrationOpensAt);
    if (registrationClosesAt !== undefined) updates.registration_closes_at = optionalString(registrationClosesAt);
    if (startsAt !== undefined) updates.starts_at = optionalString(startsAt);
    if (endsAt !== undefined) updates.ends_at = optionalString(endsAt);

    updates.updated_at = new Date().toISOString();
    const updated = update<Race>("races", race.id, updates);
    res.json(toRaceResponse(updated!));
  });

  router.post("/:id/publish", requireLogin, (req: Request, res: Response) => {
    const race = findById<Race>("races", req.params.id);
    if (!race) { res.status(404).json({ error: "Race not found" }); return; }

    const auth = authorizeManagedRace(req, race, "publish");
    if (!auth.allowed) { res.status(403).json({ error: auth.reason }); return; }

    const updated = update<Race>("races", race.id, {
      status: "published",
      visibility: "public",
      updated_at: new Date().toISOString(),
    });
    res.json(toRaceResponse(updated!));
  });

  router.post("/:id/archive", requireLogin, (req: Request, res: Response) => {
    const race = findById<Race>("races", req.params.id);
    if (!race) { res.status(404).json({ error: "Race not found" }); return; }

    const auth = authorizeManagedRace(req, race, "archive");
    if (!auth.allowed) { res.status(403).json({ error: auth.reason }); return; }

    const updated = update<Race>("races", race.id, {
      status: "archived",
      visibility: "private",
      updated_at: new Date().toISOString(),
    });
    res.json(toRaceResponse(updated!));
  });

  app.use("/races", router);
  console.log("[race-mgmt] Routes registered: /races/*");
}

function toRaceResponse(race: Race) {
  return {
    id: race.id,
    slug: race.slug,
    title: race.title,
    challenge: race.challenge,
    status: race.status,
    visibility: race.visibility,
    organizerUserIds: race.organizer_user_ids,
    registrationOpensAt: race.registration_opens_at,
    registrationClosesAt: race.registration_closes_at,
    startsAt: race.starts_at,
    endsAt: race.ends_at,
    createdByUserId: race.created_by_user_id,
    createdAt: race.created_at,
    updatedAt: race.updated_at,
    cta: deriveRaceCta(race),
  };
}

function deriveRaceCta(race: Race) {
  if (race.status === "registration") return { label: "Register", target: `/races/${race.slug}` };
  if (race.status === "running" || race.status === "submitting") return { label: "Open Live Hall", target: `/races/${race.slug}/live` };
  if (race.status === "judging") return { label: "Review in progress", target: `/races/${race.slug}` };
  if (race.status === "completed") return { label: "View results", target: `/races/${race.slug}/results` };
  if (race.status === "archived") return { label: "Archived", target: `/races/${race.slug}` };
  return { label: "View race", target: `/races/${race.slug}` };
}

function canReadRace(req: Request, race: Race): boolean {
  if (isPublicRace(race)) return true;
  const user = getCurrentUser(req);
  if (!user) return false;
  if (user.roles.includes("admin")) return true;
  return race.organizer_user_ids.includes(user.userId);
}

function isPublicRace(race: Race): boolean {
  return race.visibility === "public" && race.status !== "draft" && race.status !== "archived";
}

function authorizeManagedRace(req: Request, race: Race, action: string) {
  const user = getCurrentUser(req);
  return authorize(user, "Race", action, { raceOrganizerIds: race.organizer_user_ids });
}

function normalizeSlug(value: unknown): string {
  if (typeof value !== "string") return "";
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function isRaceStatus(value: unknown): value is RaceStatus {
  return typeof value === "string" && (RACE_STATUSES as readonly string[]).includes(value);
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

import type { Express, Request, Response } from "express";
import { Router } from "express";
import { createHash, createHmac, randomBytes, timingSafeEqual } from "node:crypto";
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
type RegistrationStatus = typeof REGISTRATION_STATUSES[number];

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

interface Registration {
  id: string;
  race_id: string;
  user_id: string;
  status: RegistrationStatus;
  submitted_at: string;
  approved_at: string | null;
  rejected_at: string | null;
  withdrawn_at: string | null;
  created_at: string;
  updated_at: string;
}

interface RaceProject {
  id: string;
  registration_id: string;
  race_id: string;
  user_id: string;
  repo_url: string | null;
  aggregate_ingestion_status: typeof INGESTION_STATUSES[number];
  connection_health: typeof CONNECTION_HEALTH[number];
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

interface CAConnection {
  id: string;
  race_project_id: string;
  ca_type: string;
  ingestion_source: "ca_realtime";
  connector_id: string;
  connector_version: string | null;
  external_project_ref: string | null;
  connection_secret: string;
  handshake_challenge: string;
  handshake_status: "pending" | "verified" | "failed";
  handshake_verified_at: string | null;
  security_version: "dcr-hmac-v1";
  signature_algorithm: "HMAC-SHA256";
  last_nonce: string | null;
  last_sequence: number;
  ingestion_status: typeof INGESTION_STATUSES[number];
  registered_at: string;
  disabled_at: string | null;
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
}

interface Session {
  id: string;
  ca_connection_id: string;
  race_project_id: string;
  started_at: string | null;
  ended_at: string | null;
  message_count: number;
  tool_call_count: number;
  token_cost: number;
  payload_hash: string;
  payload: unknown;
  dcr_timestamp: string;
  nonce: string;
  sequence: number;
  accepted_at: string;
  created_at: string;
}

interface IngestionAudit {
  id: string;
  ca_connection_id: string;
  race_project_id: string | null;
  connector_id: string | null;
  accepted: boolean;
  reason: string;
  detail: string;
  nonce: string | null;
  sequence: number | null;
  payload_hash: string | null;
  received_at: string;
}

export function registerRaceMgmtRoutes(app: Express): void {
  const router = Router();
  const registrationsRouter = Router();
  const raceProjectsRouter = Router();
  const caConnectionsRouter = Router();

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
        implemented: [
          "GET /races/contract",
          "POST /races",
          "GET /races",
          "GET /races/:slug",
          "PATCH /races/:id",
          "POST /races/:id/publish",
          "POST /races/:id/archive",
          "POST /races/:id/registrations",
          "GET /races/:id/registrations",
          "GET /races/:id/registrations/review",
          "GET /registrations/me",
          "POST /registrations/:id/approve",
          "POST /registrations/:id/reject",
          "POST /registrations/:id/withdraw",
          "GET /race-projects/:id",
          "GET /registrations/:id/race-project",
          "GET /registrations/:id/project-review",
          "POST /race-projects/:id/ca-connections",
          "GET /race-projects/:id/ca-connections",
          "GET /race-projects/:id/ca-review",
          "GET /race-projects/:id/status-review",
          "PATCH /ca-connections/:id",
          "POST /ca-connections/:id/handshake",
          "POST /ca-connections/:id/disable",
          "POST /ca-connections/:id/sessions/push",
          "GET /ca-connections/:id/sessions",
          "GET /ca-connections/:id/ingestion-review",
        ],
        planned: [
        ],
      },
      invariants: [
        "One user can have at most one registration per race.",
        "Approving a registration must idempotently create exactly one race project.",
        "A race project can have zero or more CA connections.",
        "Only registered, DCR-handshaken, correctly owned, enabled CA connections can produce valid sessions.",
        "DCR Desktop App push messages must be authenticated, integrity checked, timestamp checked, sequence checked, and replay checked before becoming valid sessions.",
        "Handshake uses a server-generated challenge and HMAC-SHA256 with the per-connection secret; unsigned, downgraded, or mismatched handshakes are rejected.",
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
      securityControls: [
        "Per-connection DCR secret and server challenge.",
        "HMAC-SHA256 handshake before accepting effective data.",
        "Signed push envelope over canonical payload, timestamp, nonce, sequence, and payloadHash.",
        "Server recomputes payloadHash and rejects mismatches.",
        "Nonce uniqueness and strict sequence increase block replay and stale overwrite.",
        "Timestamp window rejects old or future messages.",
        "Payload raceProjectId / caConnectionId must match the URL-scoped connection.",
        "Rejected pushes are written to ingestion audit and never enter sessions.",
      ],
      humanReview: {
        purpose: "Confirm B module boundary, route plan, status enums, invariants, security requirements, and out-of-scope items.",
        nextStage: "B7 frontend and module smoke test consolidation",
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

  router.post("/:id/registrations", requireLogin, (req: Request, res: Response) => {
    const user = getCurrentUser(req);
    if (!user) { res.status(401).json({ error: "Not authenticated" }); return; }

    const race = findById<Race>("races", req.params.id);
    if (!race || !isPublicRace(race)) {
      res.status(404).json({ error: "Race not found" });
      return;
    }

    if (race.status !== "registration") {
      res.status(409).json({ error: "Race is not open for registration" });
      return;
    }

    const result = authorize(user, "Registration", "submit", { ownerUserId: user.userId });
    if (!result.allowed) { res.status(403).json({ error: result.reason }); return; }

    const duplicate = findAll<Registration>("registrations")
      .find((registration) => registration.race_id === race.id && registration.user_id === user.userId);
    if (duplicate) {
      res.status(409).json({ error: "User already has a registration for this race", registration: toRegistrationResponse(duplicate, race) });
      return;
    }

    const now = new Date().toISOString();
    const registration: Registration = {
      id: uuid(),
      race_id: race.id,
      user_id: user.userId,
      status: "submitted",
      submitted_at: now,
      approved_at: null,
      rejected_at: null,
      withdrawn_at: null,
      created_at: now,
      updated_at: now,
    };

    insert("registrations", registration);
    res.status(201).json(toRegistrationResponse(registration, race));
  });

  router.get("/:id/registrations", requireLogin, (req: Request, res: Response) => {
    const race = findById<Race>("races", req.params.id);
    if (!race) { res.status(404).json({ error: "Race not found" }); return; }

    const auth = authorizeManagedRace(req, race, "view_private");
    if (!auth.allowed) { res.status(403).json({ error: auth.reason }); return; }

    const registrations = filterRegistrationsByRace(race.id);
    res.json(registrations.map((registration) => toRegistrationResponse(registration, race)));
  });

  router.get("/:id/registrations/review", requireLogin, (req: Request, res: Response) => {
    const race = findById<Race>("races", req.params.id);
    if (!race) { res.status(404).json({ error: "Race not found" }); return; }

    const auth = authorizeManagedRace(req, race, "view_private");
    if (!auth.allowed) { res.status(403).json({ error: auth.reason }); return; }

    const registrations = filterRegistrationsByRace(race.id);
    const duplicateKeys = findDuplicateRegistrationKeys(registrations);

    res.json({
      module: "B",
      stage: "B2",
      purpose: "Human review for registration list, duplicate protection, approval actions, and non-CA-gated participation status.",
      race: {
        id: race.id,
        slug: race.slug,
        title: race.title,
        status: race.status,
        visibility: race.visibility,
      },
      summary: {
        total: registrations.length,
        submitted: registrations.filter((r) => r.status === "submitted").length,
        approved: registrations.filter((r) => r.status === "approved").length,
        rejected: registrations.filter((r) => r.status === "rejected").length,
        withdrawn: registrations.filter((r) => r.status === "withdrawn").length,
        duplicateRegistrationKeys: duplicateKeys,
      },
      registrations: registrations.map((registration) => ({
        ...toRegistrationResponse(registration, race),
        availableActions: deriveRegistrationActions(registration),
        raceProject: registration.status === "approved" ? toRaceProjectResponse(findRaceProjectByRegistrationId(registration.id)) : null,
      })),
    });
  });

  registrationsRouter.get("/me", requireLogin, (req: Request, res: Response) => {
    const user = getCurrentUser(req);
    if (!user) { res.status(401).json({ error: "Not authenticated" }); return; }

    const registrations = findAll<Registration>("registrations")
      .filter((registration) => registration.user_id === user.userId)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));

    res.json(registrations.map((registration) => {
      const race = findById<Race>("races", registration.race_id);
      return {
        ...toRegistrationResponse(registration, race || undefined),
        raceProject: registration.status === "approved" ? toRaceProjectResponse(findRaceProjectByRegistrationId(registration.id)) : null,
      };
    }));
  });

  registrationsRouter.get("/:id/race-project", requireLogin, (req: Request, res: Response) => {
    const registration = findById<Registration>("registrations", req.params.id);
    if (!registration) { res.status(404).json({ error: "Registration not found" }); return; }

    const race = findById<Race>("races", registration.race_id);
    if (!canReadRegistrationScopedResource(req, registration, race || undefined)) {
      res.status(403).json({ error: "Not allowed to view race project" });
      return;
    }

    const raceProject = findRaceProjectByRegistrationId(registration.id);
    if (!raceProject) { res.status(404).json({ error: "RaceProject not found" }); return; }

    res.json(toRaceProjectResponse(raceProject));
  });

  registrationsRouter.get("/:id/project-review", requireLogin, (req: Request, res: Response) => {
    const registration = findById<Registration>("registrations", req.params.id);
    if (!registration) { res.status(404).json({ error: "Registration not found" }); return; }

    const race = findById<Race>("races", registration.race_id);
    if (!canReadRegistrationScopedResource(req, registration, race || undefined)) {
      res.status(403).json({ error: "Not allowed to review race project" });
      return;
    }

    const projects = findAll<RaceProject>("race_projects")
      .filter((project) => project.registration_id === registration.id);
    const raceProject = projects[0] || null;

    res.json({
      module: "B",
      stage: "B3",
      purpose: "Human review for Registration approved -> RaceProject idempotent creation.",
      registration: toRegistrationResponse(registration, race || undefined),
      raceProject: toRaceProjectResponse(raceProject),
      checks: {
        approvedRegistrationHasProject: registration.status !== "approved" || !!raceProject,
        projectCountForRegistration: projects.length,
        idempotent: projects.length <= 1,
        initialAggregateIngestionStatus: raceProject?.aggregate_ingestion_status || null,
        initialConnectionHealth: raceProject?.connection_health || null,
      },
      nextStage: "B4 CAConnection registration and handshake metadata",
    });
  });

  registrationsRouter.post("/:id/approve", requireLogin, (req: Request, res: Response) => {
    updateRegistrationByManagedRace(req, res, "approve");
  });

  registrationsRouter.post("/:id/reject", requireLogin, (req: Request, res: Response) => {
    updateRegistrationByManagedRace(req, res, "reject");
  });

  registrationsRouter.post("/:id/withdraw", requireLogin, (req: Request, res: Response) => {
    const user = getCurrentUser(req);
    const registration = findById<Registration>("registrations", req.params.id);
    if (!registration) { res.status(404).json({ error: "Registration not found" }); return; }

    const race = findById<Race>("races", registration.race_id);
    const isManaged = !!race && authorizeManagedRace(req, race, "view_private").allowed;
    const result = authorize(user, "Registration", "withdraw", { ownerUserId: registration.user_id });
    if (!result.allowed && !isManaged) { res.status(403).json({ error: result.reason }); return; }

    const now = new Date().toISOString();
    const updated = update<Registration>("registrations", registration.id, {
      status: "withdrawn",
      withdrawn_at: now,
      updated_at: now,
    });

    res.json(toRegistrationResponse(updated!, race || undefined));
  });

  raceProjectsRouter.get("/:id", requireLogin, (req: Request, res: Response) => {
    const raceProject = findById<RaceProject>("race_projects", req.params.id);
    if (!raceProject) { res.status(404).json({ error: "RaceProject not found" }); return; }

    const registration = findById<Registration>("registrations", raceProject.registration_id);
    const race = registration ? findById<Race>("races", registration.race_id) : null;
    if (!registration || !canReadRegistrationScopedResource(req, registration, race || undefined)) {
      res.status(403).json({ error: "Not allowed to view race project" });
      return;
    }

    res.json(toRaceProjectResponse(raceProject));
  });

  raceProjectsRouter.post("/:id/ca-connections", requireLogin, (req: Request, res: Response) => {
    const raceProject = findById<RaceProject>("race_projects", req.params.id);
    if (!raceProject) { res.status(404).json({ error: "RaceProject not found" }); return; }

    const registration = findById<Registration>("registrations", raceProject.registration_id);
    const race = registration ? findById<Race>("races", registration.race_id) : null;
    if (!registration || !canManageRaceProject(req, registration, race || undefined)) {
      res.status(403).json({ error: "Not allowed to register CAConnection" });
      return;
    }

    const { caType, connectorVersion, externalProjectRef } = req.body;
    if (!caType || typeof caType !== "string") {
      res.status(400).json({ error: "caType is required" });
      return;
    }

    const now = new Date().toISOString();
    const caConnection: CAConnection = {
      id: uuid(),
      race_project_id: raceProject.id,
      ca_type: caType.trim(),
      ingestion_source: "ca_realtime",
      connector_id: `dcr_${randomToken(16)}`,
      connector_version: optionalString(connectorVersion),
      external_project_ref: optionalString(externalProjectRef),
      connection_secret: randomToken(32),
      handshake_challenge: randomToken(32),
      handshake_status: "pending",
      handshake_verified_at: null,
      security_version: "dcr-hmac-v1",
      signature_algorithm: "HMAC-SHA256",
      last_nonce: null,
      last_sequence: 0,
      ingestion_status: "not_configured",
      registered_at: now,
      disabled_at: null,
      last_synced_at: null,
      created_at: now,
      updated_at: now,
    };

    insert("ca_connections", caConnection);
    deriveRaceProjectIngestionStatus(raceProject.id);
    res.status(201).json(toCAConnectionResponse(caConnection, { includeSecret: true }));
  });

  raceProjectsRouter.get("/:id/ca-connections", requireLogin, (req: Request, res: Response) => {
    const raceProject = findById<RaceProject>("race_projects", req.params.id);
    if (!raceProject) { res.status(404).json({ error: "RaceProject not found" }); return; }

    const registration = findById<Registration>("registrations", raceProject.registration_id);
    const race = registration ? findById<Race>("races", registration.race_id) : null;
    if (!registration || !canReadRegistrationScopedResource(req, registration, race || undefined)) {
      res.status(403).json({ error: "Not allowed to view CAConnections" });
      return;
    }

    res.json(findCAConnectionsByProjectId(raceProject.id).map((connection) => toCAConnectionResponse(connection)));
  });

  raceProjectsRouter.get("/:id/ca-review", requireLogin, (req: Request, res: Response) => {
    const raceProject = findById<RaceProject>("race_projects", req.params.id);
    if (!raceProject) { res.status(404).json({ error: "RaceProject not found" }); return; }

    const registration = findById<Registration>("registrations", raceProject.registration_id);
    const race = registration ? findById<Race>("races", registration.race_id) : null;
    if (!registration || !canReadRegistrationScopedResource(req, registration, race || undefined)) {
      res.status(403).json({ error: "Not allowed to review CAConnections" });
      return;
    }

    const connections = findCAConnectionsByProjectId(raceProject.id);
    res.json({
      module: "B",
      stage: "B4",
      purpose: "Human review for CAConnection registration, DCR handshake metadata, and effective data acceptance readiness.",
      raceProject: toRaceProjectResponse(raceProject),
      summary: {
        total: connections.length,
        pendingHandshake: connections.filter((connection) => connection.handshake_status === "pending").length,
        verified: connections.filter((connection) => connection.handshake_status === "verified").length,
        failedHandshake: connections.filter((connection) => connection.handshake_status === "failed").length,
        disabled: connections.filter((connection) => !!connection.disabled_at).length,
      },
      securityPolicy: {
        securityVersion: "dcr-hmac-v1",
        signatureAlgorithm: "HMAC-SHA256",
        handshake: "HMAC-SHA256(connectionSecret, handshakeChallenge)",
        pushPreview: "B5 will require timestamp, nonce, sequence, payloadHash, and signature before accepting sessions.",
      },
      connections: connections.map((connection) => ({
        ...toCAConnectionResponse(connection),
        effectiveDataAllowed: isCAConnectionEffective(connection),
        rejectionReasonIfPushNow: getCAConnectionBlockingReason(connection),
      })),
      nextStage: "B5 signed Session push, integrity checks, anti-replay, and ingestion audit",
    });
  });

  raceProjectsRouter.get("/:id/status-review", requireLogin, (req: Request, res: Response) => {
    const raceProject = findById<RaceProject>("race_projects", req.params.id);
    if (!raceProject) { res.status(404).json({ error: "RaceProject not found" }); return; }

    const registration = findById<Registration>("registrations", raceProject.registration_id);
    const race = registration ? findById<Race>("races", registration.race_id) : null;
    if (!registration || !canReadRegistrationScopedResource(req, registration, race || undefined)) {
      res.status(403).json({ error: "Not allowed to review RaceProject status" });
      return;
    }

    const refreshed = deriveRaceProjectIngestionStatus(raceProject.id);
    const connections = findCAConnectionsByProjectId(raceProject.id);
    const sessions = findAll<Session>("sessions").filter((session) => session.race_project_id === raceProject.id);

    res.json({
      module: "B",
      stage: "B6",
      purpose: "Human review for RaceProject aggregate ingestion status derivation from CAConnections and accepted Sessions.",
      raceProject: toRaceProjectResponse(refreshed),
      summary: {
        connections: connections.length,
        verifiedConnections: connections.filter((connection) => connection.handshake_status === "verified" && !connection.disabled_at).length,
        failedOrDisabledConnections: connections.filter((connection) => !!getCAConnectionBlockingReason(connection)).length,
        acceptedSessions: sessions.length,
      },
      derivationRules: [
        "No CAConnection -> not_configured / no_signal.",
        "Any active valid connection -> active / healthy unless some connections are failed, then active / partial_failed.",
        "Verified but no accepted Session -> connected / no_valid_signal unless some connections are failed, then connected / partial_failed.",
        "Only failed or disabled connections -> failed / no_valid_signal.",
        "Pending handshake without accepted data -> connected / no_valid_signal.",
      ],
      connections: connections.map((connection) => ({
        ...toCAConnectionResponse(connection),
        effectiveDataAllowed: isCAConnectionEffective(connection),
        blockingReason: getCAConnectionBlockingReason(connection),
      })),
      nextStage: "B7 frontend and module smoke test consolidation",
    });
  });

  caConnectionsRouter.patch("/:id", requireLogin, (req: Request, res: Response) => {
    const connection = findById<CAConnection>("ca_connections", req.params.id);
    if (!connection) { res.status(404).json({ error: "CAConnection not found" }); return; }

    const scoped = getCAConnectionScope(connection);
    if (!scoped || !canManageRaceProject(req, scoped.registration, scoped.race || undefined)) {
      res.status(403).json({ error: "Not allowed to manage CAConnection" });
      return;
    }

    const { connectorVersion, externalProjectRef } = req.body;
    const updates: Partial<CAConnection> = { updated_at: new Date().toISOString() };
    if (connectorVersion !== undefined) updates.connector_version = optionalString(connectorVersion);
    if (externalProjectRef !== undefined) updates.external_project_ref = optionalString(externalProjectRef);

    const updated = update<CAConnection>("ca_connections", connection.id, updates);
    res.json(toCAConnectionResponse(updated!));
  });

  caConnectionsRouter.post("/:id/handshake", requireLogin, (req: Request, res: Response) => {
    const connection = findById<CAConnection>("ca_connections", req.params.id);
    if (!connection) { res.status(404).json({ error: "CAConnection not found" }); return; }

    const scoped = getCAConnectionScope(connection);
    if (!scoped || !canManageRaceProject(req, scoped.registration, scoped.race || undefined)) {
      res.status(403).json({ error: "Not allowed to handshake CAConnection" });
      return;
    }
    if (connection.disabled_at) {
      res.status(409).json({ error: "Disabled CAConnection cannot handshake" });
      return;
    }

    const { connectorId, challenge, signature, securityVersion, signatureAlgorithm } = req.body;
    const failures = validateHandshakeInput(connection, { connectorId, challenge, securityVersion, signatureAlgorithm });
    const expectedSignature = signHmac(connection.connection_secret, connection.handshake_challenge);
    const signatureMatches = typeof signature === "string" && secureEqual(signature, expectedSignature);

    const now = new Date().toISOString();
    if (failures.length || !signatureMatches) {
      const updated = update<CAConnection>("ca_connections", connection.id, {
        handshake_status: "failed",
        ingestion_status: "failed",
        updated_at: now,
      });
      deriveRaceProjectIngestionStatus(connection.race_project_id);
      res.status(403).json({
        error: "Handshake verification failed",
        failures: signatureMatches ? failures : [...failures, "signature_mismatch"],
        connection: toCAConnectionResponse(updated!),
      });
      return;
    }

    const updated = update<CAConnection>("ca_connections", connection.id, {
      handshake_status: "verified",
      handshake_verified_at: now,
      ingestion_status: "connected",
      updated_at: now,
    });
    deriveRaceProjectIngestionStatus(connection.race_project_id);

    res.json(toCAConnectionResponse(updated!));
  });

  caConnectionsRouter.post("/:id/disable", requireLogin, (req: Request, res: Response) => {
    const connection = findById<CAConnection>("ca_connections", req.params.id);
    if (!connection) { res.status(404).json({ error: "CAConnection not found" }); return; }

    const scoped = getCAConnectionScope(connection);
    if (!scoped || !canManageRaceProject(req, scoped.registration, scoped.race || undefined)) {
      res.status(403).json({ error: "Not allowed to disable CAConnection" });
      return;
    }

    const now = new Date().toISOString();
    const updated = update<CAConnection>("ca_connections", connection.id, {
      disabled_at: now,
      ingestion_status: "failed",
      updated_at: now,
    });
    deriveRaceProjectIngestionStatus(connection.race_project_id);
    res.json(toCAConnectionResponse(updated!));
  });

  caConnectionsRouter.post("/:id/sessions/push", (req: Request, res: Response) => {
    const connection = findById<CAConnection>("ca_connections", req.params.id);
    if (!connection) {
      recordIngestionAudit({
        caConnectionId: req.params.id,
        raceProjectId: null,
        connectorId: optionalString(req.body?.connectorId),
        accepted: false,
        reason: "connection_not_found",
        detail: "No CAConnection exists for URL id.",
        nonce: optionalString(req.body?.nonce),
        sequence: typeof req.body?.sequence === "number" ? req.body.sequence : null,
        payloadHash: optionalString(req.body?.payloadHash),
      });
      res.status(404).json({ error: "CAConnection not found" });
      return;
    }

    const validation = validateSessionPush(connection, req.body);
    if (!validation.ok) {
      recordIngestionAudit({
        caConnectionId: connection.id,
        raceProjectId: connection.race_project_id,
        connectorId: optionalString(req.body?.connectorId),
        accepted: false,
        reason: validation.reason,
        detail: validation.detail,
        nonce: optionalString(req.body?.nonce),
        sequence: typeof req.body?.sequence === "number" ? req.body.sequence : null,
        payloadHash: optionalString(req.body?.payloadHash),
      });
      res.status(403).json({ error: "Session push rejected", reason: validation.reason, detail: validation.detail });
      return;
    }

    const now = new Date().toISOString();
    const payload = req.body.payload as Record<string, unknown>;
    const session: Session = {
      id: uuid(),
      ca_connection_id: connection.id,
      race_project_id: connection.race_project_id,
      started_at: optionalString(payload.startedAt),
      ended_at: optionalString(payload.endedAt),
      message_count: safeNumber(payload.messageCount),
      tool_call_count: safeNumber(payload.toolCallCount),
      token_cost: safeNumber(payload.tokenCost),
      payload_hash: req.body.payloadHash,
      payload,
      dcr_timestamp: req.body.timestamp,
      nonce: req.body.nonce,
      sequence: req.body.sequence,
      accepted_at: now,
      created_at: now,
    };

    insert("sessions", session);
    update<CAConnection>("ca_connections", connection.id, {
      last_nonce: req.body.nonce,
      last_sequence: req.body.sequence,
      ingestion_status: "active",
      last_synced_at: now,
      updated_at: now,
    });
    deriveRaceProjectIngestionStatus(connection.race_project_id);
    recordIngestionAudit({
      caConnectionId: connection.id,
      raceProjectId: connection.race_project_id,
      connectorId: connection.connector_id,
      accepted: true,
      reason: "accepted",
      detail: "Signed DCR push accepted into sessions.",
      nonce: req.body.nonce,
      sequence: req.body.sequence,
      payloadHash: req.body.payloadHash,
    });

    res.status(201).json(toSessionResponse(session));
  });

  caConnectionsRouter.get("/:id/sessions", requireLogin, (req: Request, res: Response) => {
    const connection = findById<CAConnection>("ca_connections", req.params.id);
    if (!connection) { res.status(404).json({ error: "CAConnection not found" }); return; }

    const scoped = getCAConnectionScope(connection);
    if (!scoped || !canReadRegistrationScopedResource(req, scoped.registration, scoped.race || undefined)) {
      res.status(403).json({ error: "Not allowed to view sessions" });
      return;
    }

    const sessions = findAll<Session>("sessions")
      .filter((session) => session.ca_connection_id === connection.id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    res.json(sessions.map(toSessionResponse));
  });

  caConnectionsRouter.get("/:id/ingestion-review", requireLogin, (req: Request, res: Response) => {
    const connection = findById<CAConnection>("ca_connections", req.params.id);
    if (!connection) { res.status(404).json({ error: "CAConnection not found" }); return; }

    const scoped = getCAConnectionScope(connection);
    if (!scoped || !canReadRegistrationScopedResource(req, scoped.registration, scoped.race || undefined)) {
      res.status(403).json({ error: "Not allowed to review ingestion" });
      return;
    }

    const audits = findAll<IngestionAudit>("ingestion_audits")
      .filter((audit) => audit.ca_connection_id === connection.id)
      .sort((a, b) => b.received_at.localeCompare(a.received_at));
    const sessions = findAll<Session>("sessions")
      .filter((session) => session.ca_connection_id === connection.id)
      .sort((a, b) => b.created_at.localeCompare(a.created_at));

    res.json({
      module: "B",
      stage: "B5",
      purpose: "Human review for signed Session push, tamper detection, replay prevention, and ingestion audit.",
      connection: toCAConnectionResponse(connection),
      summary: {
        acceptedSessions: sessions.length,
        rejectedPushes: audits.filter((audit) => !audit.accepted).length,
        lastSequence: connection.last_sequence,
        lastNonce: connection.last_nonce,
      },
      securityPolicy: {
        timestampWindowSeconds: 300,
        canonicalSignature: "HMAC-SHA256(secret, canonicalJson({caConnectionId, connectorId, timestamp, nonce, sequence, payloadHash, payload}))",
        payloadHash: "sha256(canonicalJson(payload))",
      },
      sessions: sessions.map(toSessionResponse),
      audits,
      nextStage: "B6 RaceProject aggregate ingestion status derivation",
    });
  });

  app.use("/races", router);
  app.use("/registrations", registrationsRouter);
  app.use("/race-projects", raceProjectsRouter);
  app.use("/ca-connections", caConnectionsRouter);
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

function toRegistrationResponse(registration: Registration, race?: Race) {
  return {
    id: registration.id,
    raceId: registration.race_id,
    raceSlug: race?.slug || null,
    raceTitle: race?.title || null,
    userId: registration.user_id,
    status: registration.status,
    submittedAt: registration.submitted_at,
    approvedAt: registration.approved_at,
    rejectedAt: registration.rejected_at,
    withdrawnAt: registration.withdrawn_at,
    createdAt: registration.created_at,
    updatedAt: registration.updated_at,
  };
}

function toRaceProjectResponse(raceProject: RaceProject | null | undefined) {
  if (!raceProject) return null;
  return {
    id: raceProject.id,
    registrationId: raceProject.registration_id,
    raceId: raceProject.race_id,
    userId: raceProject.user_id,
    repoUrl: raceProject.repo_url,
    aggregateIngestionStatus: raceProject.aggregate_ingestion_status,
    connectionHealth: raceProject.connection_health,
    lastSyncedAt: raceProject.last_synced_at,
    createdAt: raceProject.created_at,
    updatedAt: raceProject.updated_at,
  };
}

function toCAConnectionResponse(caConnection: CAConnection, opts: { includeSecret?: boolean } = {}) {
  return {
    id: caConnection.id,
    raceProjectId: caConnection.race_project_id,
    caType: caConnection.ca_type,
    ingestionSource: caConnection.ingestion_source,
    connectorId: caConnection.connector_id,
    connectorVersion: caConnection.connector_version,
    externalProjectRef: caConnection.external_project_ref,
    handshakeChallenge: caConnection.handshake_challenge,
    connectionSecret: opts.includeSecret ? caConnection.connection_secret : undefined,
    handshakeStatus: caConnection.handshake_status,
    handshakeVerifiedAt: caConnection.handshake_verified_at,
    securityVersion: caConnection.security_version,
    signatureAlgorithm: caConnection.signature_algorithm,
    lastSequence: caConnection.last_sequence,
    ingestionStatus: caConnection.ingestion_status,
    registeredAt: caConnection.registered_at,
    disabledAt: caConnection.disabled_at,
    lastSyncedAt: caConnection.last_synced_at,
    createdAt: caConnection.created_at,
    updatedAt: caConnection.updated_at,
  };
}

function toSessionResponse(session: Session) {
  return {
    id: session.id,
    caConnectionId: session.ca_connection_id,
    raceProjectId: session.race_project_id,
    startedAt: session.started_at,
    endedAt: session.ended_at,
    messageCount: session.message_count,
    toolCallCount: session.tool_call_count,
    tokenCost: session.token_cost,
    payloadHash: session.payload_hash,
    dcrTimestamp: session.dcr_timestamp,
    nonce: session.nonce,
    sequence: session.sequence,
    acceptedAt: session.accepted_at,
    createdAt: session.created_at,
  };
}

function deriveRegistrationActions(registration: Registration): string[] {
  if (registration.status === "submitted") return ["approve", "reject", "withdraw"];
  if (registration.status === "approved") return ["withdraw"];
  return [];
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

function filterRegistrationsByRace(raceId: string): Registration[] {
  return findAll<Registration>("registrations")
    .filter((registration) => registration.race_id === raceId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

function findDuplicateRegistrationKeys(registrations: Registration[]): string[] {
  const seen = new Set<string>();
  const duplicates = new Set<string>();
  for (const registration of registrations) {
    const key = `${registration.race_id}:${registration.user_id}`;
    if (seen.has(key)) duplicates.add(key);
    seen.add(key);
  }
  return [...duplicates];
}

function updateRegistrationByManagedRace(req: Request, res: Response, action: "approve" | "reject"): void {
  const registration = findById<Registration>("registrations", req.params.id);
  if (!registration) { res.status(404).json({ error: "Registration not found" }); return; }

  const race = findById<Race>("races", registration.race_id);
  if (!race) { res.status(404).json({ error: "Race not found" }); return; }

  const authAction = action === "approve" ? "approve" : "reject";
  const auth = authorize(getCurrentUser(req), "Registration", authAction, { raceOrganizerIds: race.organizer_user_ids });
  if (!auth.allowed) { res.status(403).json({ error: auth.reason }); return; }

  if (registration.status === "withdrawn") {
    res.status(409).json({ error: "Withdrawn registration cannot be approved or rejected" });
    return;
  }

  const now = new Date().toISOString();
  const updated = update<Registration>("registrations", registration.id, {
    status: action === "approve" ? "approved" : "rejected",
    approved_at: action === "approve" ? (registration.approved_at || now) : registration.approved_at,
    rejected_at: action === "reject" ? (registration.rejected_at || now) : registration.rejected_at,
    updated_at: now,
  });

  const raceProject = action === "approve" ? ensureRaceProjectForRegistration(updated!, now) : null;

  res.json({
    ...toRegistrationResponse(updated!, race),
    raceProject: toRaceProjectResponse(raceProject),
  });
}

function ensureRaceProjectForRegistration(registration: Registration, now = new Date().toISOString()): RaceProject {
  const existing = findRaceProjectByRegistrationId(registration.id);
  if (existing) return existing;

  const raceProject: RaceProject = {
    id: uuid(),
    registration_id: registration.id,
    race_id: registration.race_id,
    user_id: registration.user_id,
    repo_url: null,
    aggregate_ingestion_status: "not_configured",
    connection_health: "no_signal",
    last_synced_at: null,
    created_at: now,
    updated_at: now,
  };
  insert("race_projects", raceProject);
  return raceProject;
}

function findRaceProjectByRegistrationId(registrationId: string): RaceProject | null {
  return findAll<RaceProject>("race_projects")
    .find((project) => project.registration_id === registrationId) || null;
}

function deriveRaceProjectIngestionStatus(raceProjectId: string): RaceProject | null {
  const raceProject = findById<RaceProject>("race_projects", raceProjectId);
  if (!raceProject) return null;

  const connections = findCAConnectionsByProjectId(raceProject.id);
  const sessions = findAll<Session>("sessions").filter((session) => session.race_project_id === raceProject.id);

  let aggregateIngestionStatus: RaceProject["aggregate_ingestion_status"] = "not_configured";
  let connectionHealth: RaceProject["connection_health"] = "no_signal";

  if (connections.length > 0) {
    const activeConnections = connections.filter((connection) => connection.ingestion_status === "active" && !connection.disabled_at);
    const verifiedConnections = connections.filter((connection) => connection.handshake_status === "verified" && !connection.disabled_at);
    const blockedConnections = connections.filter((connection) => !!getCAConnectionBlockingReason(connection));
    const allBlocked = blockedConnections.length === connections.length;

    if (activeConnections.length > 0 && sessions.length > 0) {
      aggregateIngestionStatus = "active";
      connectionHealth = blockedConnections.length > 0 ? "partial_failed" : "healthy";
    } else if (verifiedConnections.length > 0) {
      aggregateIngestionStatus = "connected";
      connectionHealth = blockedConnections.length > 0 ? "partial_failed" : "no_valid_signal";
    } else if (allBlocked) {
      aggregateIngestionStatus = "failed";
      connectionHealth = "no_valid_signal";
    } else {
      aggregateIngestionStatus = "connected";
      connectionHealth = "no_valid_signal";
    }
  }

  const updated = update<RaceProject>("race_projects", raceProject.id, {
    aggregate_ingestion_status: aggregateIngestionStatus,
    connection_health: connectionHealth,
    last_synced_at: sessions[0]?.accepted_at || raceProject.last_synced_at,
    updated_at: new Date().toISOString(),
  });
  return updated;
}

function canReadRegistrationScopedResource(req: Request, registration: Registration, race?: Race): boolean {
  const user = getCurrentUser(req);
  if (!user) return false;
  if (user.roles.includes("admin")) return true;
  if (registration.user_id === user.userId) return true;
  return !!race && authorizeManagedRace(req, race, "view_private").allowed;
}

function canManageRaceProject(req: Request, registration: Registration, race?: Race): boolean {
  const user = getCurrentUser(req);
  if (!user) return false;
  if (user.roles.includes("admin")) return true;
  if (registration.user_id === user.userId) return true;
  return !!race && authorizeManagedRace(req, race, "view_private").allowed;
}

function findCAConnectionsByProjectId(raceProjectId: string): CAConnection[] {
  return findAll<CAConnection>("ca_connections")
    .filter((connection) => connection.race_project_id === raceProjectId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

function getCAConnectionScope(connection: CAConnection): { raceProject: RaceProject; registration: Registration; race: Race | null } | null {
  const raceProject = findById<RaceProject>("race_projects", connection.race_project_id);
  if (!raceProject) return null;
  const registration = findById<Registration>("registrations", raceProject.registration_id);
  if (!registration) return null;
  return {
    raceProject,
    registration,
    race: findById<Race>("races", registration.race_id),
  };
}

function isCAConnectionEffective(connection: CAConnection): boolean {
  return !connection.disabled_at && connection.handshake_status === "verified" && connection.ingestion_status !== "failed";
}

function getCAConnectionBlockingReason(connection: CAConnection): string | null {
  if (connection.disabled_at) return "connection_disabled";
  if (connection.handshake_status !== "verified") return "handshake_not_verified";
  if (connection.ingestion_status === "failed") return "connection_failed";
  return null;
}

type PushValidation =
  | { ok: true }
  | { ok: false; reason: string; detail: string };

function validateSessionPush(connection: CAConnection, body: any): PushValidation {
  const blockingReason = getCAConnectionBlockingReason(connection);
  if (blockingReason) return { ok: false, reason: blockingReason, detail: "CAConnection is not currently allowed to produce effective data." };

  const required = ["caConnectionId", "connectorId", "timestamp", "nonce", "sequence", "payloadHash", "signature", "payload"];
  for (const field of required) {
    if (body?.[field] === undefined || body?.[field] === null || body?.[field] === "") {
      return { ok: false, reason: "missing_field", detail: `${field} is required` };
    }
  }

  if (body.caConnectionId !== connection.id) return { ok: false, reason: "connection_id_mismatch", detail: "Envelope caConnectionId does not match URL." };
  if (body.connectorId !== connection.connector_id) return { ok: false, reason: "connector_id_mismatch", detail: "Envelope connectorId does not match registered DCR connector." };
  if (typeof body.nonce !== "string" || body.nonce.length < 12) return { ok: false, reason: "invalid_nonce", detail: "nonce must be a sufficiently long string." };
  if (isNonceUsed(connection.id, body.nonce)) return { ok: false, reason: "nonce_replay", detail: "nonce has already been seen for this CAConnection." };
  if (typeof body.sequence !== "number" || !Number.isInteger(body.sequence) || body.sequence <= connection.last_sequence) {
    return { ok: false, reason: "sequence_replay_or_stale", detail: "sequence must be an integer greater than the last accepted sequence." };
  }

  const timestamp = Date.parse(body.timestamp);
  if (Number.isNaN(timestamp)) return { ok: false, reason: "invalid_timestamp", detail: "timestamp must be an ISO time string." };
  const skewMs = Math.abs(Date.now() - timestamp);
  if (skewMs > 5 * 60 * 1000) return { ok: false, reason: "timestamp_out_of_window", detail: "timestamp is outside the 5 minute acceptance window." };

  if (!body.payload || typeof body.payload !== "object" || Array.isArray(body.payload)) {
    return { ok: false, reason: "invalid_payload", detail: "payload must be an object." };
  }
  if (body.payload.caConnectionId !== connection.id) return { ok: false, reason: "payload_connection_mismatch", detail: "payload.caConnectionId does not match CAConnection." };
  if (body.payload.raceProjectId !== connection.race_project_id) return { ok: false, reason: "payload_project_mismatch", detail: "payload.raceProjectId does not match RaceProject." };

  const computedHash = sha256Hex(canonicalJson(body.payload));
  if (body.payloadHash !== computedHash) return { ok: false, reason: "payload_hash_mismatch", detail: "payloadHash does not match server-computed payload hash." };

  const signedEnvelope = {
    caConnectionId: body.caConnectionId,
    connectorId: body.connectorId,
    timestamp: body.timestamp,
    nonce: body.nonce,
    sequence: body.sequence,
    payloadHash: body.payloadHash,
    payload: body.payload,
  };
  const expectedSignature = signHmac(connection.connection_secret, canonicalJson(signedEnvelope));
  if (typeof body.signature !== "string" || !secureEqual(body.signature, expectedSignature)) {
    return { ok: false, reason: "signature_mismatch", detail: "signature does not match signed canonical envelope." };
  }

  return { ok: true };
}

function isNonceUsed(caConnectionId: string, nonce: string): boolean {
  const inSessions = findAll<Session>("sessions")
    .some((session) => session.ca_connection_id === caConnectionId && session.nonce === nonce);
  if (inSessions) return true;
  return findAll<IngestionAudit>("ingestion_audits")
    .some((audit) => audit.ca_connection_id === caConnectionId && audit.nonce === nonce);
}

function recordIngestionAudit(input: {
  caConnectionId: string;
  raceProjectId: string | null;
  connectorId: string | null;
  accepted: boolean;
  reason: string;
  detail: string;
  nonce: string | null;
  sequence: number | null;
  payloadHash: string | null;
}): IngestionAudit {
  return insert("ingestion_audits", {
    id: uuid(),
    ca_connection_id: input.caConnectionId,
    race_project_id: input.raceProjectId,
    connector_id: input.connectorId,
    accepted: input.accepted,
    reason: input.reason,
    detail: input.detail,
    nonce: input.nonce,
    sequence: input.sequence,
    payload_hash: input.payloadHash,
    received_at: new Date().toISOString(),
  });
}

function validateHandshakeInput(connection: CAConnection, input: Record<string, unknown>): string[] {
  const failures: string[] = [];
  if (input.connectorId !== connection.connector_id) failures.push("connector_id_mismatch");
  if (input.challenge !== connection.handshake_challenge) failures.push("challenge_mismatch");
  if (input.securityVersion !== connection.security_version) failures.push("security_version_mismatch");
  if (input.signatureAlgorithm !== connection.signature_algorithm) failures.push("signature_algorithm_mismatch");
  return failures;
}

function signHmac(secret: string, value: string): string {
  return createHmac("sha256", secret).update(value, "utf8").digest("hex");
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function secureEqual(a: string, b: string): boolean {
  const left = Buffer.from(a, "hex");
  const right = Buffer.from(b, "hex");
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

function randomToken(bytes: number): string {
  return randomBytes(bytes).toString("hex");
}

function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(",")}]`;
  const obj = value as Record<string, unknown>;
  return `{${Object.keys(obj).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(obj[key])}`).join(",")}}`;
}

function safeNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
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

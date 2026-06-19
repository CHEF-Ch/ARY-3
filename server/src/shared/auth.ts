import type { Request, Response, NextFunction } from "express";
import type { AuthUser, RoleType, AuthResult } from "./types.js";
import { findById } from "../db.js";

// ── Session helpers ──

export function getCurrentUser(req: Request): AuthUser | null {
  const userId = req.session?.userId;
  if (!userId) return null;
  const row = findById<{ displayName: string; roles: string | string[] }>("users", userId);
  if (!row) return null;
  return {
    userId,
    displayName: row.displayName,
    roles: parseRoles(row.roles),
  };
}

function parseRoles(raw: string | string[]): RoleType[] {
  if (Array.isArray(raw)) return raw.filter(r => ["rider","judge","organizer","admin"].includes(r)) as RoleType[];
  try { return JSON.parse(raw); } catch { return []; }
}

export function requireLogin(req: Request, res: Response, next: NextFunction): void {
  if (!req.session?.userId) { res.status(401).json({ error: "Login required" }); return; }
  next();
}

export interface ResourceContext {
  ownerUserId?: string;
  assignedJudgeUserId?: string;
  raceOrganizerIds?: string[];
  allowGlobalOrganizer?: boolean;
  visibility?: string;
  isPublished?: boolean;
}

export function authorize(user: AuthUser | null, resourceType: string, action: string, ctx: ResourceContext = {}): AuthResult {
  if (user?.roles.includes("admin")) return { allowed: true };

  const scope = getRequiredScope(resourceType, action);
  const scopes = Array.isArray(scope) ? scope : [scope];

  let denied: AuthResult = { allowed: false, reason: "Insufficient permissions" };
  for (const item of scopes) {
    const result = authorizeScope(user, item, ctx);
    if (result.allowed) return result;
    denied = result;
  }

  return denied;
}

function authorizeScope(user: AuthUser | null, scope: ScopeReq, ctx: ResourceContext): AuthResult {
  if (scope === "PUBLIC") {
    if (ctx.visibility === "public" && ctx.isPublished !== false) return { allowed: true };
    return { allowed: false, reason: "Resource is not publicly visible" };
  }

  if (!user) return { allowed: false, reason: "Login required" };

  if (scope === "OWN") {
    if (ctx.ownerUserId === user.userId) return { allowed: true };
    return { allowed: false, reason: "Not the owner" };
  }

  if (scope === "ASSIGNED") {
    if (ctx.assignedJudgeUserId === user.userId) return { allowed: true };
    return { allowed: false, reason: "Not assigned" };
  }

  if (scope === "MANAGED_RACE") {
    if (!user.roles.includes("organizer")) return { allowed: false, reason: "Not an organizer" };
    if (ctx.raceOrganizerIds?.includes(user.userId)) return { allowed: true };
    if (ctx.allowGlobalOrganizer) return { allowed: true };
    return { allowed: false, reason: "Not an organizer of this race" };
  }

  return { allowed: false, reason: "Insufficient permissions" };
}

// ── Permission matrix ──
type ScopeReq = "PUBLIC" | "OWN" | "ASSIGNED" | "MANAGED_RACE" | "SYSTEM";
type ScopeReqSpec = ScopeReq | ScopeReq[];
const MATRIX: Record<string, Record<string, ScopeReqSpec>> = {
  Race: { view_public:"PUBLIC", view_private:"MANAGED_RACE", create:"MANAGED_RACE", edit:"MANAGED_RACE", publish:"MANAGED_RACE", archive:"MANAGED_RACE" },
  Registration: { submit:"OWN", view:"OWN", approve:"MANAGED_RACE", reject:"MANAGED_RACE", withdraw:"OWN" },
  RaceProject: { view_status:"OWN", register_ca_connection:"OWN", manage_ca_connection:"OWN", view_session_summary:"OWN", view_raw_session:"MANAGED_RACE" },
  Work: { view_public:"PUBLIC", view_private:["OWN", "ASSIGNED", "MANAGED_RACE"], create:"OWN", submit:"OWN", lock:"MANAGED_RACE", publish:"MANAGED_RACE", hide:"OWN", review:"ASSIGNED" },
  Evidence: { view_public:"PUBLIC", view_private_summary:"OWN", set_visibility:"OWN", cite_in_report:"MANAGED_RACE" },
  JudgeAssignment: { view:"ASSIGNED", create:"MANAGED_RACE", update:"MANAGED_RACE", remove:"MANAGED_RACE" },
  JudgingRecord: { view_published_summary:"PUBLIC", view_private:"OWN", create:"ASSIGNED", submit:"ASSIGNED", update_before_submit:"ASSIGNED" },
  Award: { view_published:"PUBLIC", view_draft:"MANAGED_RACE", create_draft:"MANAGED_RACE", edit_draft:"MANAGED_RACE", publish:"MANAGED_RACE", withdraw_publication:"MANAGED_RACE" },
  Projection: { view_public:"PUBLIC", view_internal:"MANAGED_RACE", rebuild:"MANAGED_RACE", inspect_status:"MANAGED_RACE" },
  Report: { view_public_published:"PUBLIC", view_private:"OWN", generate:"MANAGED_RACE", edit:"MANAGED_RACE", publish:"MANAGED_RACE", regenerate:"MANAGED_RACE" },
  User: { sign_in_github:"PUBLIC", update_profile:"OWN", view_public_profile:"PUBLIC", view_private_profile:"OWN", update_roles:"SYSTEM" },
  Announcement: { view_public:"PUBLIC", view_private:"MANAGED_RACE", create:"MANAGED_RACE", edit:"MANAGED_RACE", publish:"MANAGED_RACE", hide:"MANAGED_RACE" },
  ScreenDisplay: { view_public_display:"PUBLIC", configure:"MANAGED_RACE", switch_mode:"MANAGED_RACE", fallback:"MANAGED_RACE" },
};

function getRequiredScope(resourceType: string, action: string): ScopeReqSpec {
  return MATRIX[resourceType]?.[action] ?? "SYSTEM";
}

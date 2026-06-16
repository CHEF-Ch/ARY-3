// Shared types for the ARY server

export type RoleType = "rider" | "judge" | "organizer" | "admin";

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  displayName: string;
  profileCompleted: boolean;
  roles: RoleType[];
  createdAt: string;
  updatedAt: string;
}

export interface AuthUser {
  userId: string;
  displayName: string;
  roles: RoleType[];
}

export type AuthScope = "OWN" | "ASSIGNED" | "MANAGED_RACE" | "PUBLIC" | "SYSTEM";
export type AuthResult = { allowed: true } | { allowed: false; reason: string };

// Extend Express session types
declare module "express-session" {
  interface SessionData {
    userId?: string;
    passport?: { user?: { id: string } };
  }
}

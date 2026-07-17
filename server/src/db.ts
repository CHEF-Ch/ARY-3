import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "..", "..", "database", "data");
const MIGRATIONS_DIR = join(__dirname, "..", "..", "database", "migrations");

// ── JSON file store ──
// Each "table" is a JSON file containing an array of rows.
// For MVP this is sufficient; swap to PostgreSQL/SQLite later.

function tablePath(name: string): string {
  return join(DATA_DIR, `${name}.json`);
}

export function readTable<T = Record<string, unknown>>(name: string): T[] {
  const path = tablePath(name);
  if (!existsSync(path)) return [];
  try {
    return JSON.parse(readFileSync(path, "utf-8")) as T[];
  } catch {
    return [];
  }
}

function writeTable(name: string, rows: unknown[]): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(tablePath(name), JSON.stringify(rows, null, 2), "utf-8");
}

export function findAll<T = Record<string, unknown>>(name: string): T[] {
  return readTable<T>(name);
}

export function findById<T = Record<string, unknown>>(name: string, id: string, idField = "id"): T | null {
  const rows = readTable<T>(name);
  return (rows.find((r: any) => r[idField] === id) as T) ?? null;
}

export function findBy<T = Record<string, unknown>>(name: string, field: string, value: unknown): T | null {
  const rows = readTable<T>(name);
  return (rows.find((r: any) => r[field] === value) as T) ?? null;
}

export function filterBy<T = Record<string, unknown>>(name: string, field: string, value: unknown): T[] {
  const rows = readTable<T>(name);
  return rows.filter((r: any) => r[field] === value) as T[];
}

export function insert<T = Record<string, unknown>>(name: string, row: T): T {
  const rows = readTable<T>(name);
  rows.push(row);
  writeTable(name, rows);
  return row;
}

export function update<T = Record<string, unknown>>(name: string, id: string, updates: Partial<T>, idField = "id"): T | null {
  const rows = readTable<T>(name);
  const idx = rows.findIndex((r: any) => r[idField] === id);
  if (idx === -1) return null;
  rows[idx] = { ...rows[idx], ...updates } as T;
  writeTable(name, rows);
  return rows[idx];
}

export function remove<T = Record<string, unknown>>(name: string, id: string, idField = "id"): boolean {
  const rows = readTable<T>(name);
  const idx = rows.findIndex((r: any) => r[idField] === id);
  if (idx === -1) return false;
  rows.splice(idx, 1);
  writeTable(name, rows);
  return true;
}

// ── Migrations ──
export function runMigrations(): void {
  if (!existsSync(MIGRATIONS_DIR)) {
    console.log("[db] No migrations directory — skipping");
    return;
  }

  // Track which migrations have been run
  const migrated: string[] = readTable<{ name: string }>("_migrations").map(r => r.name);

  const entries = readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith(".sql"))
    .sort();

  for (const file of entries) {
    if (migrated.includes(file)) continue;
    console.log(`[db] Migration: ${file}`);
    insert("_migrations", { name: file });
  }
}

// ── CLI ──
const arg = process.argv[2];
if (arg === "--migrate") {
  runMigrations();
  console.log("[db] Migrations complete.");
  process.exit(0);
}

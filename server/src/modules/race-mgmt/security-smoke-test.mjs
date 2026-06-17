import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.cwd(), "..");
const dataDir = path.join(root, "database", "data");
const port = process.env.PORT || "3120";
const base = `http://localhost:${port}`;
const tmpDir = process.env.TEMP || process.env.TMP || ".";
const orgCookie = path.join(tmpDir, "ary-race-mgmt-smoke-org.txt");
const riderCookie = path.join(tmpDir, "ary-race-mgmt-smoke-rider.txt");

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function canonical(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(",")}}`;
}

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function hmac(secret, value) {
  return crypto.createHmac("sha256", secret).update(value).digest("hex");
}

function writeJson(name, value) {
  const file = path.join(tmpDir, `${name}-${Date.now()}-${Math.random()}.json`);
  fs.writeFileSync(file, JSON.stringify(value), "utf8");
  return file;
}

function curl(args) {
  return new Promise((resolve) => {
    const child = spawn("curl.exe", ["--max-time", "5", "-s", ...args]);
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("close", (code) => resolve({ code, stdout, stderr }));
  });
}

async function postJson(url, value, cookie) {
  const args = [];
  if (cookie) args.push("-b", cookie);
  args.push("-H", "Content-Type: application/json", "--data-binary", `@${writeJson("ary-smoke", value)}`, url);
  return parseJson(await curl(args));
}

async function getJson(url, cookie) {
  const args = [];
  if (cookie) args.push("-b", cookie);
  args.push(url);
  return parseJson(await curl(args));
}

function parseJson(result) {
  try {
    return JSON.parse(result.stdout || "{}");
  } catch {
    return { raw: result.stdout, stderr: result.stderr, code: result.code };
  }
}

function setOrganizerRole(userId) {
  const usersPath = path.join(dataDir, "users.json");
  const users = JSON.parse(fs.readFileSync(usersPath, "utf8"));
  const user = users.find((row) => row.id === userId);
  user.roles = ["organizer"];
  fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
}

function makeEnvelope(secret, connection, raceProjectId, nonce, sequence, overrides = {}) {
  const payload = {
    caConnectionId: connection.id,
    raceProjectId,
    startedAt: new Date().toISOString(),
    messageCount: 3,
    toolCallCount: 1,
    tokenCost: 42,
    ...(overrides.payload || {}),
  };
  const envelope = {
    caConnectionId: connection.id,
    connectorId: connection.connectorId,
    timestamp: new Date().toISOString(),
    nonce,
    sequence,
    payloadHash: sha256(canonical(payload)),
    payload,
    ...(overrides.envelope || {}),
  };
  const signed = {
    caConnectionId: envelope.caConnectionId,
    connectorId: envelope.connectorId,
    timestamp: envelope.timestamp,
    nonce: envelope.nonce,
    sequence: envelope.sequence,
    payloadHash: envelope.payloadHash,
    payload: envelope.payload,
  };
  envelope.signature = overrides.signature ?? hmac(secret, canonical(signed));
  return envelope;
}

async function cleanup() {
  for (const name of ["users.json", "races.json", "registrations.json", "race_projects.json", "ca_connections.json", "sessions.json", "ingestion_audits.json"]) {
    try { fs.unlinkSync(path.join(dataDir, name)); } catch {}
  }
  for (const file of [orgCookie, riderCookie]) {
    try { fs.unlinkSync(file); } catch {}
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  await cleanup();
  const server = spawn(process.execPath, ["dist/app.js"], {
    cwd: path.join(root, "server"),
    env: { ...process.env, PORT: port },
    stdio: "ignore",
  });

  try {
    await wait(2000);
    const org = parseJson(await curl(["-c", orgCookie, "-H", "Content-Type: application/json", "--data-binary", `@${writeJson("org", { githubAccount: "smoke-org", displayName: "Smoke Organizer" })}`, `${base}/auth/github`]));
    await curl(["-c", riderCookie, "-H", "Content-Type: application/json", "--data-binary", `@${writeJson("rider", { githubAccount: "smoke-rider", displayName: "Smoke Rider" })}`, `${base}/auth/github`]);
    setOrganizerRole(org.userId);

    const race = await postJson(`${base}/races`, { title: "Smoke Race", slug: "smoke-race", challenge: "Race management smoke test." }, orgCookie);
    await curl(["-b", orgCookie, "-X", "POST", `${base}/races/${race.id}/publish`]);
    await curl(["-b", orgCookie, "-X", "PATCH", "-H", "Content-Type: application/json", "--data-binary", `@${writeJson("race-status", { status: "registration" })}`, `${base}/races/${race.id}`]);

    const registration = parseJson(await curl(["-b", riderCookie, "-X", "POST", `${base}/races/${race.id}/registrations`]));
    const approved = parseJson(await curl(["-b", orgCookie, "-X", "POST", `${base}/registrations/${registration.id}/approve`]));
    const projectId = approved.raceProject.id;

    const connection = await postJson(`${base}/race-projects/${projectId}/ca-connections`, { caType: "codex", connectorVersion: "dcr-smoke" }, riderCookie);
    const handshake = {
      connectorId: connection.connectorId,
      challenge: connection.handshakeChallenge,
      securityVersion: "dcr-hmac-v1",
      signatureAlgorithm: "HMAC-SHA256",
      signature: hmac(connection.connectionSecret, connection.handshakeChallenge),
    };
    await postJson(`${base}/ca-connections/${connection.id}/handshake`, handshake, riderCookie);

    const legal = makeEnvelope(connection.connectionSecret, connection, projectId, "smoke-nonce-001", 1);
    await postJson(`${base}/ca-connections/${connection.id}/sessions/push`, legal);
    await postJson(`${base}/ca-connections/${connection.id}/sessions/push`, legal);

    const tampered = JSON.parse(JSON.stringify(legal));
    tampered.nonce = "smoke-nonce-002";
    tampered.sequence = 2;
    tampered.payload.tokenCost = 1;
    await postJson(`${base}/ca-connections/${connection.id}/sessions/push`, tampered);

    const review = await getJson(`${base}/ca-connections/${connection.id}/ingestion-review`, orgCookie);
    const status = await getJson(`${base}/race-projects/${projectId}/status-review`, orgCookie);

    assert(review.summary.acceptedSessions === 1, "Expected exactly one accepted session");
    assert(review.summary.rejectedPushes >= 2, "Expected rejected attack pushes");
    assert(status.raceProject.aggregateIngestionStatus === "active", "Expected RaceProject active status");

    console.log(JSON.stringify({
      ok: true,
      acceptedSessions: review.summary.acceptedSessions,
      rejectedPushes: review.summary.rejectedPushes,
      aggregateIngestionStatus: status.raceProject.aggregateIngestionStatus,
      connectionHealth: status.raceProject.connectionHealth,
    }, null, 2));
  } finally {
    server.kill();
    await wait(300);
    await cleanup();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

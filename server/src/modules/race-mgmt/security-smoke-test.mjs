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

async function postJsonWithStatus(url, value, cookie) {
  const args = [];
  if (cookie) args.push("-b", cookie);
  args.push("-H", "Content-Type: application/json", "--data-binary", `@${writeJson("ary-smoke", value)}`, "-w", "\n%{http_code}", url);
  return parseJsonWithStatus(await curl(args));
}

async function patchJsonWithStatus(url, value, cookie) {
  const args = ["-X", "PATCH"];
  if (cookie) args.push("-b", cookie);
  args.push("-H", "Content-Type: application/json", "--data-binary", `@${writeJson("ary-smoke", value)}`, "-w", "\n%{http_code}", url);
  return parseJsonWithStatus(await curl(args));
}

async function postEmptyWithStatus(url, cookie) {
  const args = [];
  if (cookie) args.push("-b", cookie);
  args.push("-X", "POST", "-w", "\n%{http_code}", url);
  return parseJsonWithStatus(await curl(args));
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

function parseJsonWithStatus(result) {
  const output = result.stdout || "";
  const index = output.lastIndexOf("\n");
  const body = index >= 0 ? output.slice(0, index) : output;
  const status = Number(index >= 0 ? output.slice(index + 1) : 0);
  let json;
  try {
    json = JSON.parse(body || "{}");
  } catch {
    json = { raw: body };
  }
  return { status, body: json, stderr: result.stderr, code: result.code };
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
    const invalidStatus = await patchJsonWithStatus(`${base}/races/${race.id}`, { status: "completed" }, orgCookie);
    assert(invalidStatus.status === 409, "Expected invalid race status jump to be rejected");
    await curl(["-b", orgCookie, "-X", "POST", `${base}/races/${race.id}/publish`]);
    await curl(["-b", orgCookie, "-X", "PATCH", "-H", "Content-Type: application/json", "--data-binary", `@${writeJson("race-status", { status: "registration" })}`, `${base}/races/${race.id}`]);

    const registration = parseJson(await curl(["-b", riderCookie, "-X", "POST", `${base}/races/${race.id}/registrations`]));
    const duplicateRegistration = await postEmptyWithStatus(`${base}/races/${race.id}/registrations`, riderCookie);
    assert(duplicateRegistration.status === 409, "Expected duplicate registration to be rejected");
    const approved = parseJson(await curl(["-b", orgCookie, "-X", "POST", `${base}/registrations/${registration.id}/approve`]));
    const approvedAgain = parseJson(await curl(["-b", orgCookie, "-X", "POST", `${base}/registrations/${registration.id}/approve`]));
    const projectId = approved.raceProject.id;
    assert(approvedAgain.raceProject.id === projectId, "Expected repeated approval to reuse the same RaceProject");

    const connection = await postJson(`${base}/race-projects/${projectId}/ca-connections`, { caType: "codex", connectorVersion: "dcr-smoke" }, riderCookie);
    const unverified = makeEnvelope(connection.connectionSecret, connection, projectId, "smoke-nonce-unverified", 1);
    const unverifiedPush = await postJsonWithStatus(`${base}/ca-connections/${connection.id}/sessions/push`, unverified);
    assert(unverifiedPush.status === 403 && unverifiedPush.body.reason === "handshake_not_verified", "Expected unverified connection push to be rejected");
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

    const poisonedNonce = makeEnvelope(connection.connectionSecret, connection, projectId, "smoke-nonce-poison", 2, {
      signature: "00",
    });
    const poisonedNonceRejected = await postJsonWithStatus(`${base}/ca-connections/${connection.id}/sessions/push`, poisonedNonce);
    assert(poisonedNonceRejected.status === 403 && poisonedNonceRejected.body.reason === "signature_mismatch", "Expected invalid signature to be rejected without consuming nonce");
    const legalAfterPoison = makeEnvelope(connection.connectionSecret, connection, projectId, "smoke-nonce-poison", 2);
    const legalAfterPoisonAccepted = await postJsonWithStatus(`${base}/ca-connections/${connection.id}/sessions/push`, legalAfterPoison);
    assert(legalAfterPoisonAccepted.status === 201, "Expected valid push to be accepted after prior invalid signature used same nonce");

    const tampered = JSON.parse(JSON.stringify(legal));
    tampered.nonce = "smoke-nonce-002";
    tampered.sequence = 3;
    tampered.payload.tokenCost = 1;
    await postJson(`${base}/ca-connections/${connection.id}/sessions/push`, tampered);

    const wrongProject = makeEnvelope(connection.connectionSecret, connection, projectId, "smoke-nonce-003", 4, {
      payload: { raceProjectId: "wrong-project-id" },
    });
    await postJson(`${base}/ca-connections/${connection.id}/sessions/push`, wrongProject);

    const oversizedPayload = makeEnvelope(connection.connectionSecret, connection, projectId, "smoke-nonce-large", 5, {
      payload: { oversized: "x".repeat(70 * 1024) },
    });
    const oversizedRejected = await postJsonWithStatus(`${base}/ca-connections/${connection.id}/sessions/push`, oversizedPayload);
    assert(oversizedRejected.status === 403 && oversizedRejected.body.reason === "payload_too_large", "Expected oversized payload to be rejected");

    const disabledConnection = await postJson(`${base}/race-projects/${projectId}/ca-connections`, { caType: "codex", connectorVersion: "dcr-smoke-disabled" }, riderCookie);
    await postJson(`${base}/ca-connections/${disabledConnection.id}/handshake`, {
      connectorId: disabledConnection.connectorId,
      challenge: disabledConnection.handshakeChallenge,
      securityVersion: "dcr-hmac-v1",
      signatureAlgorithm: "HMAC-SHA256",
      signature: hmac(disabledConnection.connectionSecret, disabledConnection.handshakeChallenge),
    }, riderCookie);
    await curl(["-b", riderCookie, "-X", "POST", `${base}/ca-connections/${disabledConnection.id}/disable`]);
    const disabledPush = await postJsonWithStatus(
      `${base}/ca-connections/${disabledConnection.id}/sessions/push`,
      makeEnvelope(disabledConnection.connectionSecret, disabledConnection, projectId, "smoke-nonce-disabled", 1),
    );
    assert(disabledPush.status === 403 && disabledPush.body.reason === "connection_disabled", "Expected disabled connection push to be rejected");

    const review = await getJson(`${base}/ca-connections/${connection.id}/ingestion-review`, orgCookie);
    const status = await getJson(`${base}/race-projects/${projectId}/status-review`, orgCookie);

    assert(review.summary.acceptedSessions === 2, "Expected accepted sessions to include valid push after nonce poisoning attempt");
    assert(review.summary.rejectedPushes >= 4, "Expected rejected attack pushes");
    assert(review.audits.every((audit) => audit.nonce === undefined && audit.payload_hash === undefined && audit.payloadHash === undefined), "Expected ingestion review to redact nonce and payload hash");
    assert(status.raceProject.aggregateIngestionStatus === "active", "Expected RaceProject active status");

    console.log(JSON.stringify({
      ok: true,
      acceptedSessions: review.summary.acceptedSessions,
      rejectedPushes: review.summary.rejectedPushes,
      aggregateIngestionStatus: status.raceProject.aggregateIngestionStatus,
      connectionHealth: status.raceProject.connectionHealth,
      duplicateRegistrationRejected: duplicateRegistration.status === 409,
      repeatedApprovalIdempotent: approvedAgain.raceProject.id === projectId,
      invalidStatusTransitionRejected: invalidStatus.status === 409,
      rejectedNonceDoesNotBurn: legalAfterPoisonAccepted.status === 201,
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

#!/bin/bash
set -e

BASE="http://localhost:3000"
COOKIE="/tmp/ary-report-gen-cookie.txt"
REPO_ROOT="$(cd "$(dirname "$0")/../../../.." && pwd)"

cleanup() {
  REPO_ROOT="$REPO_ROOT" node <<'NODE'
const fs = require("fs");
const path = require("path");
const dataDir = path.join(process.env.REPO_ROOT, "database", "data");
function read(name) {
  const file = path.join(dataDir, `${name}.json`);
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
function write(name, rows) {
  if (!fs.existsSync(dataDir)) return;
  fs.writeFileSync(path.join(dataDir, `${name}.json`), JSON.stringify(rows, null, 2));
}
function removeByIds(name, ids) {
  write(name, read(name).filter((row) => !ids.includes(row.id)));
}
removeByIds("users", ["report-rider-1"]);
write("users", read("users").filter((row) => row.githubAccount !== "report-organizer"));
removeByIds("races", ["report-race-1"]);
removeByIds("registrations", ["report-registration-1"]);
removeByIds("works", ["report-work-1"]);
removeByIds("judging_records", ["report-judging-1"]);
removeByIds("awards", ["report-award-1"]);
removeByIds("evidences", ["report-evidence-1"]);
write("reports", read("reports").filter((row) => row.race_id !== "report-race-1"));
NODE
  rm -f "$COOKIE"
}

trap cleanup EXIT

echo "--- E report-gen: login organizer ---"
LOGIN=$(curl -s -X POST "$BASE/auth/github" \
  -H "Content-Type: application/json" \
  -d '{"githubAccount":"report-organizer","displayName":"Report Organizer"}' \
  -c "$COOKIE")
USER_ID=$(node -e "const data=JSON.parse(process.argv[1]); console.log(data.userId)" "$LOGIN")

echo "--- E report-gen: seed dependent mock data ---"
REPO_ROOT="$REPO_ROOT" node - "$USER_ID" <<'NODE'
const fs = require("fs");
const path = require("path");
const userId = process.argv[2];
const dataDir = path.join(process.env.REPO_ROOT, "database", "data");
fs.mkdirSync(dataDir, { recursive: true });

function read(name) {
  const file = path.join(dataDir, `${name}.json`);
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, "utf8"));
}
function write(name, rows) {
  fs.writeFileSync(path.join(dataDir, `${name}.json`), JSON.stringify(rows, null, 2));
}
function upsert(name, row) {
  const rows = read(name).filter((item) => item.id !== row.id);
  rows.push(row);
  write(name, rows);
}

const users = read("users").map((u) => u.id === userId ? { ...u, roles: ["organizer"] } : u);
write("users", users);

upsert("users", { id: "report-rider-1", githubAccount: "report-rider", displayName: "Report Rider", profileCompleted: true, roles: ["rider"], createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() });
upsert("races", { id: "report-race-1", slug: "report-race", title: "Report Gen Test Race", organizer_user_ids: [userId], status: "completed" });
upsert("registrations", { id: "report-registration-1", race_id: "report-race-1", user_id: "report-rider-1", status: "approved" });
upsert("works", { id: "report-work-1", registration_id: "report-registration-1", title: "Report Work", status: "published" });
upsert("judging_records", { id: "report-judging-1", registration_id: "report-registration-1", scoreResult: 88, scoreRiding: 91, comment: "Solid riding." });
upsert("awards", { id: "report-award-1", race_id: "report-race-1", registration_id: "report-registration-1", award_name: "Best Rider", rank: 1, status: "published" });
upsert("evidences", { id: "report-evidence-1", registration_id: "report-registration-1", visibility: "public", summary: "Risk handling evidence." });
NODE

echo "--- generate review_summary ---"
REVIEW=$(curl -s -X POST "$BASE/reports/generate" \
  -H "Content-Type: application/json" \
  -b "$COOKIE" \
  -d '{"raceId":"report-race-1","type":"review_summary"}')
REVIEW_ID=$(node -e "const data=JSON.parse(process.argv[1]); if(!data.id) throw new Error(JSON.stringify(data)); console.log(data.id)" "$REVIEW")

echo "--- publish review_summary ---"
curl -s -X POST "$BASE/reports/$REVIEW_ID/publish" -b "$COOKIE" | node -e "let s=''; process.stdin.on('data',d=>s+=d); process.stdin.on('end',()=>{const data=JSON.parse(s); if(data.status!=='published'||data.visibility!=='public') throw new Error(s); console.log('published', data.id);});"

echo "--- public can read published review_summary ---"
curl -s "$BASE/reports/$REVIEW_ID" | node -e "let s=''; process.stdin.on('data',d=>s+=d); process.stdin.on('end',()=>{const data=JSON.parse(s); if(data.type!=='review_summary') throw new Error(s); console.log('public ok');});"

echo "--- generate rider_report ---"
RIDER=$(curl -s -X POST "$BASE/reports/generate" \
  -H "Content-Type: application/json" \
  -b "$COOKIE" \
  -d '{"raceId":"report-race-1","type":"rider_report","subjectRegistrationId":"report-registration-1"}')
RIDER_ID=$(node -e "const data=JSON.parse(process.argv[1]); if(!data.id) throw new Error(JSON.stringify(data)); console.log(data.id)" "$RIDER")

echo "--- publish rider_report stays private ---"
curl -s -X POST "$BASE/reports/$RIDER_ID/publish" -b "$COOKIE" | node -e "let s=''; process.stdin.on('data',d=>s+=d); process.stdin.on('end',()=>{const data=JSON.parse(s); if(data.visibility!=='private') throw new Error(s); console.log('rider private ok');});"

echo "--- invalid race_report subject rejected ---"
STATUS=$(curl -s -o /tmp/ary-report-invalid.json -w "%{http_code}" -X POST "$BASE/reports/generate" \
  -H "Content-Type: application/json" \
  -b "$COOKIE" \
  -d '{"raceId":"report-race-1","type":"race_report","subjectRegistrationId":"report-registration-1"}')
test "$STATUS" = "400"

echo "E report-gen tests passed"

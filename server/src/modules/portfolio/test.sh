#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SERVER_DIR="$(cd "$SCRIPT_DIR/../../.." && pwd)"
BASE_URL="${BASE_URL:-http://localhost:3000}"
PORT="${PORT:-3000}"
TMP_DIR="$(mktemp -d)"
SERVER_PID=""

cd "$SERVER_DIR"

cleanup_data() {
  ./node_modules/.bin/tsx --eval '
    import { findAll, remove } from "./src/db.ts";
    const testIds = new Set(["test-c-rider","test-c-organizer","test-c-judge","test-c-judge-2","test-c-outsider","test-c-race","test-c-registration","test-c-race-project"]);
    const testWorkIds = new Set(findAll("works").filter((r) => testIds.has(r.registration_id) || testIds.has(r.race_id) || testIds.has(r.user_id) || String(r.slug || "").startsWith("test-c-")).map((r) => r.id));
    const testAssignmentIds = new Set(findAll("judge_assignments").filter((r) => testWorkIds.has(r.work_id) || testIds.has(r.judge_user_id) || testIds.has(r.assigned_by_user_id)).map((r) => r.id));
    const testRecordIds = new Set(findAll("judging_records").filter((r) => testAssignmentIds.has(r.judge_assignment_id)).map((r) => r.id));
    for (const table of ["evidences","awards"]) {
      for (const row of findAll(table)) {
        if (testIds.has(row.registration_id) || testIds.has(row.race_id) || testWorkIds.has(row.work_id) || testIds.has(row.created_by_user_id)) remove(table, row.id);
      }
    }
    for (const table of ["judging_records"]) for (const row of findAll(table)) if (testRecordIds.has(row.id)) remove(table, row.id);
    for (const table of ["judge_assignments"]) for (const row of findAll(table)) if (testAssignmentIds.has(row.id)) remove(table, row.id);
    for (const table of ["works"]) for (const row of findAll(table)) if (testWorkIds.has(row.id)) remove(table, row.id);
    for (const table of ["race_projects","registrations","races","users"]) for (const row of findAll(table)) if (testIds.has(row.id)) remove(table, row.id);
  '
}

cleanup() {
  set +e
  cleanup_data >/dev/null 2>&1
  if [[ -n "$SERVER_PID" ]]; then kill "$SERVER_PID" >/dev/null 2>&1; fi
  rm -rf "$TMP_DIR"
}
trap cleanup EXIT

setup_data() {
  cleanup_data
  ./node_modules/.bin/tsx --eval '
    import { insert } from "./src/db.ts";
    const now = new Date().toISOString();
    const user = (id, githubAccount, displayName, roles) => ({
      id, githubAccount, github_account: githubAccount, displayName, display_name: displayName,
      profileCompleted: true, profile_completed: 1, roles, createdAt: now, updatedAt: now,
      created_at: now, updated_at: now,
    });
    insert("users", user("test-c-rider", "test-c-rider", "Test C Rider", ["rider"]));
    insert("users", user("test-c-organizer", "test-c-organizer", "Test C Organizer", ["organizer"]));
    insert("users", user("test-c-judge", "test-c-judge", "Test C Judge", ["judge"]));
    insert("users", user("test-c-judge-2", "test-c-judge-2", "Test C Judge 2", ["judge"]));
    insert("users", user("test-c-outsider", "test-c-outsider", "Test C Outsider", ["rider"]));
    insert("races", {
      id: "test-c-race", slug: "test-c-race", title: "Test C Race", challenge: "",
      status: "judging", visibility: "public", organizer_user_ids: ["test-c-organizer"],
      registration_opens_at: null, registration_closes_at: null, starts_at: null, ends_at: null,
      created_by_user_id: "test-c-organizer", created_at: now, updated_at: now,
    });
    insert("registrations", {
      id: "test-c-registration", race_id: "test-c-race", user_id: "test-c-rider", status: "approved",
      submitted_at: now, approved_at: now, rejected_at: null, withdrawn_at: null, created_at: now, updated_at: now,
    });
    insert("race_projects", {
      id: "test-c-race-project", registration_id: "test-c-registration", race_id: "test-c-race",
      user_id: "test-c-rider", repo_url: null, aggregate_ingestion_status: "failed",
      connection_health: "partial_failed", last_synced_at: null, created_at: now, updated_at: now,
    });
  '
}

start_server() {
  if curl -fsS "$BASE_URL/health" >/dev/null 2>&1; then
    return
  fi
  PORT="$PORT" ./node_modules/.bin/tsx src/app.ts >"$TMP_DIR/server.log" 2>&1 &
  SERVER_PID="$!"
  for _ in {1..40}; do
    if curl -fsS "$BASE_URL/health" >/dev/null 2>&1; then return; fi
    sleep 0.25
  done
  cat "$TMP_DIR/server.log" >&2 || true
  echo "server did not start" >&2
  exit 1
}

login() {
  local account="$1"
  local jar="$2"
  curl -fsS -c "$jar" -H "Content-Type: application/json" \
    -d "{\"githubAccount\":\"$account\",\"displayName\":\"$account\"}" \
    "$BASE_URL/auth/github" >/dev/null
}

request() {
  local method="$1"
  local path="$2"
  local jar="$3"
  local body="${4:-}"
  local out="$5"
  local args=(-sS -o "$out" -w "%{http_code}" -X "$method" -H "Content-Type: application/json")
  if [[ -n "$jar" ]]; then args+=(-b "$jar" -c "$jar"); fi
  if [[ -n "$body" ]]; then args+=(-d "$body"); fi
  curl "${args[@]}" "$BASE_URL$path"
}

expect_status() {
  local actual="$1"
  local expected="$2"
  local label="$3"
  local out="$4"
  if [[ "$actual" != "$expected" ]]; then
    echo "FAIL $label: expected $expected, got $actual" >&2
    cat "$out" >&2
    exit 1
  fi
  echo "ok - $label"
}

json_get() {
  local file="$1"
  local expr="$2"
  node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync(process.argv[1],'utf8')); const value=($expr); if (value === undefined || value === null) process.exit(2); console.log(value);" "$file"
}

json_assert() {
  local file="$1"
  local expr="$2"
  local label="$3"
  node -e "const fs=require('fs'); const data=JSON.parse(fs.readFileSync(process.argv[1],'utf8')); if (!($expr)) { console.error('FAIL $label'); console.error(JSON.stringify(data,null,2)); process.exit(1); }" "$file"
  echo "ok - $label"
}

setup_data
start_server

RIDER_COOKIE="$TMP_DIR/rider.cookie"
ORGANIZER_COOKIE="$TMP_DIR/organizer.cookie"
JUDGE_COOKIE="$TMP_DIR/judge.cookie"
OUTSIDER_COOKIE="$TMP_DIR/outsider.cookie"
login test-c-rider "$RIDER_COOKIE"
login test-c-organizer "$ORGANIZER_COOKIE"
login test-c-judge "$JUDGE_COOKIE"
login test-c-outsider "$OUTSIDER_COOKIE"

OUT="$TMP_DIR/work-create.json"
STATUS="$(request POST /works "$RIDER_COOKIE" '{"registrationId":"test-c-registration","title":"Test C Work","summary":"summary"}' "$OUT")"
expect_status "$STATUS" 201 "work create owner" "$OUT"
WORK_ID="$(json_get "$OUT" "data.id")"
json_assert "$OUT" "data.reviewWarnings.some((w) => w.code === 'ca_ingestion_failed')" "work response includes review warning"

STATUS="$(request POST /works "$RIDER_COOKIE" '{"registrationId":"test-c-registration","title":"Duplicate"}' "$TMP_DIR/dup-work.json")"
expect_status "$STATUS" 409 "work duplicate registration rejected" "$TMP_DIR/dup-work.json"
STATUS="$(request POST /works "$OUTSIDER_COOKIE" '{"registrationId":"test-c-registration","title":"Outsider"}' "$TMP_DIR/outside-work.json")"
expect_status "$STATUS" 403 "work create outsider rejected" "$TMP_DIR/outside-work.json"
STATUS="$(request POST "/works/$WORK_ID/submit" "$RIDER_COOKIE" '{"title":"Test C Work"}' "$TMP_DIR/submit-missing.json")"
expect_status "$STATUS" 400 "work submit requires repo or demo" "$TMP_DIR/submit-missing.json"
STATUS="$(request POST "/works/$WORK_ID/submit" "$RIDER_COOKIE" '{"repoUrl":"https://example.test/repo"}' "$TMP_DIR/submit.json")"
expect_status "$STATUS" 200 "work submit owner" "$TMP_DIR/submit.json"
STATUS="$(request POST "/works/$WORK_ID/lock" "$ORGANIZER_COOKIE" '' "$TMP_DIR/lock.json")"
expect_status "$STATUS" 200 "work lock organizer" "$TMP_DIR/lock.json"
STATUS="$(request PATCH "/works/$WORK_ID" "$RIDER_COOKIE" '{"summary":"after lock"}' "$TMP_DIR/patch-locked.json")"
expect_status "$STATUS" 409 "locked work cannot patch" "$TMP_DIR/patch-locked.json"
STATUS="$(request POST "/works/$WORK_ID/publish" "$ORGANIZER_COOKIE" '' "$TMP_DIR/publish-work.json")"
expect_status "$STATUS" 200 "work publish organizer" "$TMP_DIR/publish-work.json"
STATUS="$(request GET "/works?raceId=test-c-race" "" '' "$TMP_DIR/public-works.json")"
expect_status "$STATUS" 200 "public works list" "$TMP_DIR/public-works.json"
json_assert "$TMP_DIR/public-works.json" "data.some((w) => w.id === '$WORK_ID' && w.reviewWarnings.length === 0)" "public work omits review warnings"

STATUS="$(request POST "/works/$WORK_ID/judge-assignments" "$ORGANIZER_COOKIE" '{"judgeUserId":"test-c-judge"}' "$TMP_DIR/assignment.json")"
expect_status "$STATUS" 201 "judge assignment create" "$TMP_DIR/assignment.json"
ASSIGNMENT_ID="$(json_get "$TMP_DIR/assignment.json" "data.id")"
STATUS="$(request POST "/works/$WORK_ID/judge-assignments" "$ORGANIZER_COOKIE" '{"judgeUserId":"test-c-judge"}' "$TMP_DIR/assignment-dup.json")"
expect_status "$STATUS" 409 "duplicate judge assignment rejected" "$TMP_DIR/assignment-dup.json"
STATUS="$(request POST "/works/$WORK_ID/judge-assignments" "$ORGANIZER_COOKIE" '{"judgeUserId":"test-c-outsider"}' "$TMP_DIR/assignment-nonjudge.json")"
expect_status "$STATUS" 400 "non-judge target rejected" "$TMP_DIR/assignment-nonjudge.json"
STATUS="$(request GET /judge-assignments/mine "$JUDGE_COOKIE" '' "$TMP_DIR/mine.json")"
expect_status "$STATUS" 200 "judge assignment mine" "$TMP_DIR/mine.json"
json_assert "$TMP_DIR/mine.json" "data.some((a) => a.id === '$ASSIGNMENT_ID' && a.work.reviewWarnings.some((w) => w.code === 'ca_ingestion_failed'))" "judge assignment includes work warning"
STATUS="$(request POST "/judge-assignments/$ASSIGNMENT_ID/judging-records" "$OUTSIDER_COOKIE" '{"comments":"bad"}' "$TMP_DIR/record-outside.json")"
expect_status "$STATUS" 403 "non-assigned judge rejected" "$TMP_DIR/record-outside.json"
STATUS="$(request POST "/judge-assignments/$ASSIGNMENT_ID/judging-records" "$JUDGE_COOKIE" '{"comments":"draft"}' "$TMP_DIR/record.json")"
expect_status "$STATUS" 201 "judging record draft create" "$TMP_DIR/record.json"
RECORD_ID="$(json_get "$TMP_DIR/record.json" "data.id")"
STATUS="$(request POST "/judging-records/$RECORD_ID/submit" "$JUDGE_COOKIE" '{"scoreResult":90}' "$TMP_DIR/record-submit-missing.json")"
expect_status "$STATUS" 400 "judging submit requires both scores" "$TMP_DIR/record-submit-missing.json"
STATUS="$(request POST "/judging-records/$RECORD_ID/submit" "$JUDGE_COOKIE" '{"scoreResult":90,"scoreRiding":88,"comments":"done"}' "$TMP_DIR/record-submit.json")"
expect_status "$STATUS" 200 "judging record submit" "$TMP_DIR/record-submit.json"
STATUS="$(request PATCH "/judging-records/$RECORD_ID" "$JUDGE_COOKIE" '{"comments":"late"}' "$TMP_DIR/record-patch-submitted.json")"
expect_status "$STATUS" 409 "submitted judging record immutable" "$TMP_DIR/record-patch-submitted.json"
STATUS="$(request DELETE "/judge-assignments/$ASSIGNMENT_ID" "$ORGANIZER_COOKIE" '' "$TMP_DIR/assignment-remove-submitted.json")"
expect_status "$STATUS" 409 "assignment with submitted record cannot remove" "$TMP_DIR/assignment-remove-submitted.json"
STATUS="$(request POST "/works/$WORK_ID/judge-assignments" "$ORGANIZER_COOKIE" '{"judgeUserId":"test-c-judge-2"}' "$TMP_DIR/assignment-2.json")"
expect_status "$STATUS" 201 "second judge assignment create" "$TMP_DIR/assignment-2.json"
ASSIGNMENT_2_ID="$(json_get "$TMP_DIR/assignment-2.json" "data.id")"
STATUS="$(request DELETE "/judge-assignments/$ASSIGNMENT_2_ID" "$ORGANIZER_COOKIE" '' "$TMP_DIR/assignment-remove.json")"
expect_status "$STATUS" 200 "assignment without submitted record removed" "$TMP_DIR/assignment-remove.json"

STATUS="$(request GET "/awards?raceId=test-c-race" "" '' "$TMP_DIR/awards-before.json")"
expect_status "$STATUS" 200 "public awards before publish" "$TMP_DIR/awards-before.json"
json_assert "$TMP_DIR/awards-before.json" "Array.isArray(data) && data.length === 0" "draft award not public"
STATUS="$(request POST /awards "$ORGANIZER_COOKIE" "{\"registrationId\":\"test-c-registration\",\"workId\":\"$WORK_ID\",\"awardName\":\"Champion\",\"rank\":1,\"decisionReason\":\"best\",\"judgingRecordIds\":[\"$RECORD_ID\"]}" "$TMP_DIR/award.json")"
expect_status "$STATUS" 201 "award draft create" "$TMP_DIR/award.json"
AWARD_ID="$(json_get "$TMP_DIR/award.json" "data.id")"
STATUS="$(request POST /awards "$ORGANIZER_COOKIE" "{\"registrationId\":\"test-c-registration\",\"workId\":\"$WORK_ID\",\"awardName\":\"Champion\",\"rank\":1}" "$TMP_DIR/award-dup-rank.json")"
expect_status "$STATUS" 409 "award duplicate rank rejected" "$TMP_DIR/award-dup-rank.json"
STATUS="$(request POST /awards "$ORGANIZER_COOKIE" "{\"registrationId\":\"test-c-registration\",\"workId\":\"$WORK_ID\",\"awardName\":\"Champion\",\"rank\":2}" "$TMP_DIR/award-dup-reg.json")"
expect_status "$STATUS" 409 "award duplicate registration rejected" "$TMP_DIR/award-dup-reg.json"
STATUS="$(request POST "/awards/$AWARD_ID/publish" "$ORGANIZER_COOKIE" '' "$TMP_DIR/award-publish.json")"
expect_status "$STATUS" 200 "award publish" "$TMP_DIR/award-publish.json"
STATUS="$(request GET "/awards?raceId=test-c-race" "" '' "$TMP_DIR/awards-after.json")"
expect_status "$STATUS" 200 "public awards after publish" "$TMP_DIR/awards-after.json"
json_assert "$TMP_DIR/awards-after.json" "data.some((a) => a.id === '$AWARD_ID' && a.visibility === 'public')" "published award public"

STATUS="$(request POST /evidences "$RIDER_COOKIE" "{\"registrationId\":\"test-c-registration\",\"workId\":\"$WORK_ID\",\"type\":\"commit_pr\",\"title\":\"PR evidence\",\"sourceRef\":{\"url\":\"https://example.test/pr/1\"}}" "$TMP_DIR/evidence.json")"
expect_status "$STATUS" 201 "evidence create owner" "$TMP_DIR/evidence.json"
EVIDENCE_ID="$(json_get "$TMP_DIR/evidence.json" "data.id")"
STATUS="$(request PATCH "/evidences/$EVIDENCE_ID/visibility" "$OUTSIDER_COOKIE" '{"visibility":"public"}' "$TMP_DIR/evidence-outside.json")"
expect_status "$STATUS" 403 "evidence visibility outsider rejected" "$TMP_DIR/evidence-outside.json"
STATUS="$(request GET "/evidences?registrationId=test-c-registration" "" '' "$TMP_DIR/evidence-public-before.json")"
expect_status "$STATUS" 200 "public evidence before visibility" "$TMP_DIR/evidence-public-before.json"
json_assert "$TMP_DIR/evidence-public-before.json" "Array.isArray(data) && data.length === 0" "private evidence not public"
STATUS="$(request PATCH "/evidences/$EVIDENCE_ID/visibility" "$RIDER_COOKIE" '{"visibility":"public"}' "$TMP_DIR/evidence-public.json")"
expect_status "$STATUS" 200 "evidence set public owner" "$TMP_DIR/evidence-public.json"
STATUS="$(request GET "/evidences?registrationId=test-c-registration" "" '' "$TMP_DIR/evidence-public-after.json")"
expect_status "$STATUS" 200 "public evidence after visibility" "$TMP_DIR/evidence-public-after.json"
json_assert "$TMP_DIR/evidence-public-after.json" "data.some((e) => e.id === '$EVIDENCE_ID' && e.visibility === 'public' && e.sourceRef === undefined)" "public evidence omits sourceRef"

echo "portfolio tests passed"

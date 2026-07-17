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
    const ids = new Set([
      "test-d-organizer","test-d-rider-1","test-d-rider-2","test-d-rider-3","test-d-outsider","test-d-judge",
      "test-d-race-public","test-d-race-private",
      "test-d-registration-1","test-d-registration-2","test-d-registration-3",
      "test-d-project-1","test-d-project-2","test-d-project-3",
      "test-d-connection-1","test-d-connection-2","test-d-connection-3",
      "test-d-session-1","test-d-session-2",
      "test-d-work-1","test-d-work-3",
      "test-d-assignment-1","test-d-assignment-2",
      "test-d-record-1","test-d-record-2",
      "test-d-award-1","test-d-award-2",
      "test-d-announcement-1","test-d-announcement-2"
    ]);
    for (const table of ["projections","announcements","awards","judging_records","judge_assignments","works","sessions","ca_connections","race_projects","registrations","races","users"]) {
      for (const row of findAll(table)) {
        if (ids.has(row.id) || ids.has(row.race_id) || ids.has(row.registration_id) || ids.has(row.race_project_id) || ids.has(row.ca_connection_id) || ids.has(row.user_id) || ids.has(row.work_id) || ids.has(row.judge_assignment_id)) {
          remove(table, row.id);
        }
      }
    }
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
    const now = new Date("2026-06-20T10:00:00.000Z");
    const iso = (minutes) => new Date(now.getTime() + minutes * 60_000).toISOString();
    const user = (id, githubAccount, displayName, roles) => ({
      id, githubAccount, github_account: githubAccount, displayName, display_name: displayName,
      profileCompleted: true, profile_completed: 1, roles, createdAt: iso(0), updatedAt: iso(0), created_at: iso(0), updated_at: iso(0),
    });
    insert("users", user("test-d-organizer", "test-d-organizer", "Test D Organizer", ["organizer"]));
    insert("users", user("test-d-rider-1", "test-d-rider-1", "Test D Rider 1", ["rider"]));
    insert("users", user("test-d-rider-2", "test-d-rider-2", "Test D Rider 2", ["rider"]));
    insert("users", user("test-d-rider-3", "test-d-rider-3", "Test D Rider 3", ["rider"]));
    insert("users", user("test-d-outsider", "test-d-outsider", "Test D Outsider", ["rider"]));
    insert("users", user("test-d-judge", "test-d-judge", "Test D Judge", ["judge"]));

    insert("races", {
      id: "test-d-race-public", slug: "test-d-race-public", title: "Test D Public Race", challenge: "Projection test race",
      status: "judging", visibility: "public", organizer_user_ids: ["test-d-organizer"],
      registration_opens_at: iso(-120), registration_closes_at: iso(-90), starts_at: iso(-60), ends_at: iso(120),
      created_by_user_id: "test-d-organizer", created_at: iso(-180), updated_at: iso(30),
    });
    insert("races", {
      id: "test-d-race-private", slug: "test-d-race-private", title: "Test D Private Race", challenge: "Private projection",
      status: "running", visibility: "private", organizer_user_ids: ["test-d-organizer"],
      registration_opens_at: iso(-120), registration_closes_at: iso(-90), starts_at: iso(-60), ends_at: iso(120),
      created_by_user_id: "test-d-organizer", created_at: iso(-180), updated_at: iso(30),
    });

    insert("registrations", {
      id: "test-d-registration-1", race_id: "test-d-race-public", user_id: "test-d-rider-1", status: "approved",
      submitted_at: iso(-80), approved_at: iso(-70), rejected_at: null, withdrawn_at: null, created_at: iso(-80), updated_at: iso(20),
    });
    insert("registrations", {
      id: "test-d-registration-2", race_id: "test-d-race-public", user_id: "test-d-rider-2", status: "approved",
      submitted_at: iso(-78), approved_at: iso(-68), rejected_at: null, withdrawn_at: null, created_at: iso(-78), updated_at: iso(21),
    });
    insert("registrations", {
      id: "test-d-registration-3", race_id: "test-d-race-public", user_id: "test-d-rider-3", status: "approved",
      submitted_at: iso(-76), approved_at: iso(-66), rejected_at: null, withdrawn_at: null, created_at: iso(-76), updated_at: iso(22),
    });

    insert("race_projects", {
      id: "test-d-project-1", registration_id: "test-d-registration-1", race_id: "test-d-race-public", user_id: "test-d-rider-1",
      repo_url: null, aggregate_ingestion_status: "active", connection_health: "healthy", last_synced_at: iso(40), created_at: iso(-70), updated_at: iso(40),
    });
    insert("race_projects", {
      id: "test-d-project-2", registration_id: "test-d-registration-2", race_id: "test-d-race-public", user_id: "test-d-rider-2",
      repo_url: null, aggregate_ingestion_status: "failed", connection_health: "partial_failed", last_synced_at: iso(35), created_at: iso(-68), updated_at: iso(35),
    });
    insert("race_projects", {
      id: "test-d-project-3", registration_id: "test-d-registration-3", race_id: "test-d-race-public", user_id: "test-d-rider-3",
      repo_url: null, aggregate_ingestion_status: "not_configured", connection_health: "no_signal", last_synced_at: null, created_at: iso(-66), updated_at: iso(34),
    });

    insert("ca_connections", {
      id: "test-d-connection-1", race_project_id: "test-d-project-1", connector_id: "connector-1",
      handshake_status: "verified", ingestion_status: "active", disabled_at: null, last_synced_at: iso(40), created_at: iso(-60), updated_at: iso(40),
    });
    insert("ca_connections", {
      id: "test-d-connection-2", race_project_id: "test-d-project-2", connector_id: "connector-2",
      handshake_status: "verified", ingestion_status: "failed", disabled_at: null, last_synced_at: iso(35), created_at: iso(-58), updated_at: iso(35),
    });
    insert("ca_connections", {
      id: "test-d-connection-3", race_project_id: "test-d-project-3", connector_id: "connector-3",
      handshake_status: "pending", ingestion_status: "not_configured", disabled_at: null, last_synced_at: null, created_at: iso(-57), updated_at: iso(34),
    });

    insert("sessions", {
      id: "test-d-session-1", ca_connection_id: "test-d-connection-1", race_project_id: "test-d-project-1",
      message_count: 8, tool_call_count: 16, token_cost: 1200, accepted_at: iso(25), created_at: iso(25),
    });
    insert("sessions", {
      id: "test-d-session-2", ca_connection_id: "test-d-connection-1", race_project_id: "test-d-project-1",
      message_count: 6, tool_call_count: 10, token_cost: 800, accepted_at: iso(30), created_at: iso(30),
    });

    insert("works", {
      id: "test-d-work-1", registration_id: "test-d-registration-1", race_id: "test-d-race-public", user_id: "test-d-rider-1",
      slug: "test-d-work-1", title: "Projection Winner", summary: "Public winning work",
      status: "locked", visibility: "public", submitted_at: iso(28), published_at: iso(32), created_at: iso(10), updated_at: iso(32),
    });
    insert("works", {
      id: "test-d-work-3", registration_id: "test-d-registration-3", race_id: "test-d-race-public", user_id: "test-d-rider-3",
      slug: "test-d-work-3", title: "Draft Hidden Work", summary: "Still drafting",
      status: "draft", visibility: "private", submitted_at: null, published_at: null, created_at: iso(12), updated_at: iso(26),
    });

    insert("judge_assignments", {
      id: "test-d-assignment-1", work_id: "test-d-work-1", judge_user_id: "test-d-judge", assigned_by_user_id: "test-d-organizer",
      assigned_at: iso(33), created_at: iso(33), updated_at: iso(33),
    });
    insert("judge_assignments", {
      id: "test-d-assignment-2", work_id: "test-d-work-3", judge_user_id: "test-d-judge", assigned_by_user_id: "test-d-organizer",
      assigned_at: iso(34), created_at: iso(34), updated_at: iso(34),
    });

    insert("judging_records", {
      id: "test-d-record-1", judge_assignment_id: "test-d-assignment-1", score_result: 96, score_riding: 94,
      comments: "Excellent", status: "submitted", submitted_at: iso(42), created_at: iso(41), updated_at: iso(42),
    });
    insert("judging_records", {
      id: "test-d-record-2", judge_assignment_id: "test-d-assignment-2", score_result: 80, score_riding: null,
      comments: "Draft only", status: "draft", submitted_at: null, created_at: iso(41), updated_at: iso(41),
    });

    insert("awards", {
      id: "test-d-award-1", race_id: "test-d-race-public", registration_id: "test-d-registration-1", work_id: "test-d-work-1",
      award_name: "Champion", rank: 1, decision_reason: "Best overall", status: "published", visibility: "public",
      published_at: iso(50), created_at: iso(49), updated_at: iso(50),
    });
    insert("awards", {
      id: "test-d-award-2", race_id: "test-d-race-public", registration_id: "test-d-registration-3", work_id: "test-d-work-3",
      award_name: "Champion", rank: 2, decision_reason: "Draft result", status: "draft", visibility: "private",
      published_at: null, created_at: iso(49), updated_at: iso(49),
    });

    insert("announcements", {
      id: "test-d-announcement-1", race_id: "test-d-race-public", title: "Live Notice", body: "Public announcement",
      visibility: "public", published_at: iso(45), created_at: iso(45),
    });
    insert("announcements", {
      id: "test-d-announcement-2", race_id: "test-d-race-public", title: "Private Note", body: "Not for public",
      visibility: "private", published_at: null, created_at: iso(46),
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

ORGANIZER_COOKIE="$TMP_DIR/organizer.cookie"
OUTSIDER_COOKIE="$TMP_DIR/outsider.cookie"
login test-d-organizer "$ORGANIZER_COOKIE"
login test-d-outsider "$OUTSIDER_COOKIE"

STATUS="$(request GET "/projections/test-d-race-public/race_progress" "" '' "$TMP_DIR/race-progress.json")"
expect_status "$STATUS" 200 "public race_progress read" "$TMP_DIR/race-progress.json"
json_assert "$TMP_DIR/race-progress.json" "data.contractVersion === 'd.v1' && data.readKind === 'projection'" "race_progress exposes converged contract metadata"
json_assert "$TMP_DIR/race-progress.json" "Array.isArray(data.sourceOfTruth) && data.sourceOfTruth.includes('sessions') && data.fallback.code === 'none'" "race_progress exposes source-of-truth and fallback contract"
json_assert "$TMP_DIR/race-progress.json" "data.type === 'race_progress' && data.data.counts.approvedRegistrations === 3" "race_progress counts approved registrations"
json_assert "$TMP_DIR/race-progress.json" "data.data.counts.sessionCount === 2 && data.data.totals.tokenCost === 2000" "race_progress aggregates sessions"
json_assert "$TMP_DIR/race-progress.json" "data.data.note.includes('不代替最终赛果')" "race_progress note distinguishes process data"
json_assert "$TMP_DIR/race-progress.json" "data.data.eventStream.some((event) => event.type === 'risk')" "race_progress event stream includes risk"

STATUS="$(request GET "/projections/test-d-race-public/registration_status" "" '' "$TMP_DIR/registration-status.json")"
expect_status "$STATUS" 200 "public registration_status read" "$TMP_DIR/registration-status.json"
json_assert "$TMP_DIR/registration-status.json" "data.data.registrations.some((row) => row.registrationId === 'test-d-registration-2' && row.aggregateIngestionStatus === 'failed')" "registration_status includes failed project"
json_assert "$TMP_DIR/registration-status.json" "data.data.registrations.some((row) => row.registrationId === 'test-d-registration-1' && row.sessionCount === 2 && row.tokenCost === 2000)" "registration_status includes rider metrics"

STATUS="$(request GET "/projections/test-d-race-public/risk" "" '' "$TMP_DIR/risk.json")"
expect_status "$STATUS" 200 "public risk read" "$TMP_DIR/risk.json"
json_assert "$TMP_DIR/risk.json" "data.data.counts.caFailed === 1 && data.data.counts.caNotConfigured === 1" "risk projection counts CA issues"
json_assert "$TMP_DIR/risk.json" "data.data.items.some((item) => item.code === 'missing_work' && item.registrationId === 'test-d-registration-2')" "risk projection includes missing work for approved rider"

STATUS="$(request GET "/projections/test-d-race-public/current_leaderboard" "" '' "$TMP_DIR/current-leaderboard.json")"
expect_status "$STATUS" 200 "public current_leaderboard read" "$TMP_DIR/current-leaderboard.json"
json_assert "$TMP_DIR/current-leaderboard.json" "data.data.note.includes('过程榜单')" "current leaderboard marks process nature"
json_assert "$TMP_DIR/current-leaderboard.json" "data.data.items[0].registrationId === 'test-d-registration-1' && data.data.items[0].rank === 1" "current leaderboard ranks strongest process first"

STATUS="$(request GET "/projections/test-d-race-public/leaderboard_read_model" "" '' "$TMP_DIR/final-leaderboard.json")"
expect_status "$STATUS" 200 "public leaderboard read model read" "$TMP_DIR/final-leaderboard.json"
json_assert "$TMP_DIR/final-leaderboard.json" "data.data.groups.length === 1 && data.data.groups[0].awardName === 'Champion'" "leaderboard read model groups by award name"
json_assert "$TMP_DIR/final-leaderboard.json" "data.data.groups[0].items.length === 1 && data.data.groups[0].items[0].registrationId === 'test-d-registration-1'" "leaderboard read model only exposes published public awards"

STATUS="$(request GET "/projections/test-d-race-public/results_page_read_model" "" '' "$TMP_DIR/results-page-read-model.json")"
expect_status "$STATUS" 200 "public results page read model read" "$TMP_DIR/results-page-read-model.json"
json_assert "$TMP_DIR/results-page-read-model.json" "data.contractVersion === 'd.v1' && data.readKind === 'read_model' && data.fallback.code === 'none'" "results page read model exposes converged contract metadata"
json_assert "$TMP_DIR/results-page-read-model.json" "data.data.boundaries.finalResultsSource === 'Award + leaderboard_read_model' && data.data.boundaries.processLeaderboardExcluded === true" "results page read model declares final-result boundary"
json_assert "$TMP_DIR/results-page-read-model.json" "data.data.winningWorks.length === 1 && data.data.winningWorks[0].workId === 'test-d-work-1'" "results page read model includes public winning works only"
json_assert "$TMP_DIR/results-page-read-model.json" "data.data.review.available === false" "results page read model degrades cleanly before report module"

STATUS="$(request GET "/projections/test-d-race-public/review_summary_read_model" "" '' "$TMP_DIR/review-summary-read-model.json")"
expect_status "$STATUS" 200 "public review summary read model read" "$TMP_DIR/review-summary-read-model.json"
json_assert "$TMP_DIR/review-summary-read-model.json" "data.data.report.available === false && data.data.nextEntries.resultsPath === '/races/test-d-race-public/results'" "review summary read model exposes fallback navigation before report module"

STATUS="$(request GET "/projections/test-d-race-public/screen_feed" "" '' "$TMP_DIR/screen-feed.json")"
expect_status "$STATUS" 200 "public screen_feed read" "$TMP_DIR/screen-feed.json"
json_assert "$TMP_DIR/screen-feed.json" "data.data.protocol.defaultDisplayMode === 'live' && data.data.protocol.availableModes.includes('leaderboard')" "screen feed exposes protocol summary"
json_assert "$TMP_DIR/screen-feed.json" "data.data.items.every((item) => typeof item.order === 'number' && typeof item.durationMs === 'number' && typeof item.recommendedDisplayMode === 'string' && typeof item.fallbackPriority === 'number')" "screen feed items expose scheduling fields"
json_assert "$TMP_DIR/screen-feed.json" "data.data.items[0].order <= data.data.items[1].order" "screen feed items are sorted by protocol order"
json_assert "$TMP_DIR/screen-feed.json" "data.data.items.some((item) => item.feedItemType === 'process_leaderboard' && item.mode === 'leaderboard')" "screen feed includes process leaderboard item"
json_assert "$TMP_DIR/screen-feed.json" "data.data.items.some((item) => item.feedItemType === 'final_leaderboard' && item.mode === 'leaderboard')" "screen feed includes final leaderboard item"
json_assert "$TMP_DIR/screen-feed.json" "data.data.items.some((item) => item.feedItemType === 'work_highlight' && item.data.workId === 'test-d-work-1')" "screen feed includes public work highlight"
json_assert "$TMP_DIR/screen-feed.json" "data.data.items.some((item) => item.feedItemType === 'announcement' && item.title === 'Live Notice')" "screen feed includes public announcement"

STATUS="$(request GET "/projections/test-d-race-private/race_progress" "" '' "$TMP_DIR/private-anon.json")"
expect_status "$STATUS" 403 "anonymous cannot read private race projection" "$TMP_DIR/private-anon.json"

STATUS="$(request GET "/projections/test-d-race-private/race_progress" "$OUTSIDER_COOKIE" '' "$TMP_DIR/private-outsider.json")"
expect_status "$STATUS" 403 "outsider cannot read private race projection" "$TMP_DIR/private-outsider.json"

STATUS="$(request GET "/projections/test-d-race-private/race_progress" "$ORGANIZER_COOKIE" '' "$TMP_DIR/private-organizer.json")"
expect_status "$STATUS" 200 "organizer can read private race projection" "$TMP_DIR/private-organizer.json"

STATUS="$(request GET "/projections/test-d-race-public/status-summary" "" '' "$TMP_DIR/status-summary-anon.json")"
expect_status "$STATUS" 401 "status summary requires login" "$TMP_DIR/status-summary-anon.json"

STATUS="$(request GET "/projections/test-d-race-public/status-summary" "$OUTSIDER_COOKIE" '' "$TMP_DIR/status-summary-outsider.json")"
expect_status "$STATUS" 403 "outsider cannot inspect projection status summary" "$TMP_DIR/status-summary-outsider.json"

STATUS="$(request POST "/projections/test-d-race-public/rebuild" "" '' "$TMP_DIR/rebuild-anon.json")"
expect_status "$STATUS" 401 "rebuild requires login" "$TMP_DIR/rebuild-anon.json"

STATUS="$(request POST "/projections/test-d-race-public/rebuild" "$OUTSIDER_COOKIE" '' "$TMP_DIR/rebuild-outsider.json")"
expect_status "$STATUS" 403 "outsider cannot rebuild projections" "$TMP_DIR/rebuild-outsider.json"

STATUS="$(request POST "/projections/test-d-race-public/rebuild" "$ORGANIZER_COOKIE" '' "$TMP_DIR/rebuild-organizer.json")"
expect_status "$STATUS" 200 "organizer rebuild projections" "$TMP_DIR/rebuild-organizer.json"
json_assert "$TMP_DIR/rebuild-organizer.json" "data.projections.length === 8" "rebuild returns all eight projections"
json_assert "$TMP_DIR/rebuild-organizer.json" "data.projections.every((row) => row.status === 'ready')" "rebuild marks all projections ready"
json_assert "$TMP_DIR/rebuild-organizer.json" "data.summary.ready === 8 && data.summary.usingStableFallback === 0" "rebuild summary reports all ready"

STATUS="$(request GET "/projections/test-d-race-public/status-summary" "$ORGANIZER_COOKIE" '' "$TMP_DIR/status-summary-ready.json")"
expect_status "$STATUS" 200 "organizer can inspect projection status summary" "$TMP_DIR/status-summary-ready.json"
json_assert "$TMP_DIR/status-summary-ready.json" "data.summary.projectionCount === 8 && data.summary.liveCount === 8" "status summary reports all projections live after rebuild"
json_assert "$TMP_DIR/status-summary-ready.json" "data.summary.serveReadiness === 'live' && data.summary.publicReadable === true && data.summary.screenReady === true && data.summary.screenServeMode === 'live'" "status summary exposes top-level serve readiness"
json_assert "$TMP_DIR/status-summary-ready.json" "data.summary.modeCounts.live === 8 && data.summary.modeCounts.notBuilt === 0 && data.summary.readModelReadyCount >= 2" "status summary exposes compact readiness aggregates"
json_assert "$TMP_DIR/status-summary-ready.json" "data.summary.lastSuccessfulByType.screen_feed && data.summary.lastSuccessfulByType.results_page_read_model" "status summary exposes per-type latest success index"
json_assert "$TMP_DIR/status-summary-ready.json" "data.projections.every((item) => item.storageStatus === 'ready' && item.effectiveReadMode === 'live')" "status summary lists live projection entries"
json_assert "$TMP_DIR/status-summary-ready.json" "data.projections.every((item) => item.serveReady === true && item.publicReadable === true)" "status summary projection entries expose serve flags"
json_assert "$TMP_DIR/status-summary-ready.json" "data.readModels.some((item) => item.type === 'results_page_read_model' && item.available === true)" "status summary reports read model availability"
json_assert "$TMP_DIR/status-summary-ready.json" "data.readModels.every((item) => typeof item.serveReady === 'boolean' && item.publicReadable === true)" "status summary read model entries expose serve flags"

./node_modules/.bin/tsx --eval '
  import { findAll, update } from "./src/db.ts";
  const row = findAll("projections").find((item) => item.race_id === "test-d-race-public" && item.type === "screen_feed");
  if (!row) process.exit(2);
  update("projections", row.id, {
    status: "failed",
    last_error: "mock rebuild failure",
    last_attempted_at: "2026-06-20T11:00:00.000Z",
  });
'

STATUS="$(request GET "/projections/test-d-race-public/screen_feed" "" '' "$TMP_DIR/screen-feed-fallback.json")"
expect_status "$STATUS" 200 "screen feed stable fallback read" "$TMP_DIR/screen-feed-fallback.json"
json_assert "$TMP_DIR/screen-feed-fallback.json" "data.status === 'failed' && data.usingStableFallback === true && data.readMode === 'stable_fallback'" "screen feed response reports stable fallback mode"
json_assert "$TMP_DIR/screen-feed-fallback.json" "data.fallbackReason === 'mock rebuild failure'" "screen feed response exposes fallback reason"
json_assert "$TMP_DIR/screen-feed-fallback.json" "data.fallback.code === 'projection_failed_uses_stable' && data.fallback.active === true" "screen feed stable fallback uses converged fallback contract"

STATUS="$(request GET "/projections/test-d-race-public/status-summary" "$ORGANIZER_COOKIE" '' "$TMP_DIR/status-summary-stable-fallback.json")"
expect_status "$STATUS" 200 "status summary reflects stable fallback" "$TMP_DIR/status-summary-stable-fallback.json"
json_assert "$TMP_DIR/status-summary-stable-fallback.json" "data.projections.some((item) => item.type === 'screen_feed' && item.effectiveReadMode === 'stable_fallback' && item.fallbackCode === 'projection_failed_uses_stable')" "status summary exposes stable fallback projection state"
json_assert "$TMP_DIR/status-summary-stable-fallback.json" "data.summary.stableFallbackCount === 1" "status summary counts stable fallback projections"
json_assert "$TMP_DIR/status-summary-stable-fallback.json" "data.summary.serveReadiness === 'degraded' && data.summary.screenReady === true && data.summary.screenServeMode === 'stable_fallback'" "status summary marks degraded but serviceable fallback state"

./node_modules/.bin/tsx --eval '
  import { findAll, update } from "./src/db.ts";
  const row = findAll("projections").find((item) => item.race_id === "test-d-race-public" && item.type === "screen_feed");
  if (!row) process.exit(2);
  update("projections", row.id, {
    status: "failed",
    generated_at: null,
    data: {},
    last_error: "mock hard failure",
    last_attempted_at: "2026-06-20T11:05:00.000Z",
  });
'

STATUS="$(request GET "/projections/test-d-race-public/screen_feed" "" '' "$TMP_DIR/screen-feed-static-fallback.json")"
expect_status "$STATUS" 200 "screen feed static fallback read" "$TMP_DIR/screen-feed-static-fallback.json"
json_assert "$TMP_DIR/screen-feed-static-fallback.json" "data.status === 'failed' && data.usingStaticFallback === true && data.readMode === 'static_fallback'" "screen feed response reports static fallback mode"
json_assert "$TMP_DIR/screen-feed-static-fallback.json" "data.fallback.code === 'projection_failed_uses_static' && data.fallback.active === true" "screen feed static fallback uses converged fallback contract"
json_assert "$TMP_DIR/screen-feed-static-fallback.json" "data.data.items.some((item) => item.feedItemType === 'announcement')" "static fallback screen feed includes announcement item"
json_assert "$TMP_DIR/screen-feed-static-fallback.json" "data.data.items.some((item) => item.feedItemType === 'final_leaderboard')" "static fallback screen feed includes final leaderboard item"

STATUS="$(request GET "/projections/test-d-race-public/status-summary" "$ORGANIZER_COOKIE" '' "$TMP_DIR/status-summary-static-fallback.json")"
expect_status "$STATUS" 200 "status summary reflects static fallback" "$TMP_DIR/status-summary-static-fallback.json"
json_assert "$TMP_DIR/status-summary-static-fallback.json" "data.projections.some((item) => item.type === 'screen_feed' && item.effectiveReadMode === 'static_fallback' && item.fallbackCode === 'projection_failed_uses_static')" "status summary exposes static fallback projection state"
json_assert "$TMP_DIR/status-summary-static-fallback.json" "data.summary.staticFallbackCount === 1" "status summary counts static fallback projections"
json_assert "$TMP_DIR/status-summary-static-fallback.json" "data.summary.serveReadiness === 'degraded' && data.summary.screenReady === true && data.summary.screenServeMode === 'static_fallback'" "status summary distinguishes static fallback serve mode"

./node_modules/.bin/tsx --eval '
  import { findAll } from "./src/db.ts";
  const rows = findAll("projections").filter((row) => row.race_id === "test-d-race-public");
  if (rows.length !== 8) {
    console.error("FAIL projections persisted row count", rows.length);
    process.exit(1);
  }
  const types = new Set(rows.map((row) => row.type));
  const required = ["race_progress","registration_status","cost","risk","submission","judging","current_leaderboard","screen_feed"];
  for (const type of required) {
    if (!types.has(type)) {
      console.error("FAIL missing projection type", type);
      process.exit(1);
    }
  }
  console.log("ok - projections persisted");
'

echo "projection module test passed"

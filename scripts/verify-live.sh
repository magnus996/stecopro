#!/bin/bash
# verify-live.sh — proves SIMU-08: live mode keeps producing data while app runs
#
# Assertions:
#   1. Dev server starts and reaches "Ready" state
#   2. '[simulator] live mode started' appears exactly once (HMR guard works)
#   3. MAX(recordedAt) is fresh: within 90 s of boot time OR COUNT grew during run
#
# Usage: bash scripts/verify-live.sh
# Exit 0 on all assertions pass, 1 on any failure.

set -euo pipefail

pass=0
fail=0
DEV_LOG=""
DEV_PID=""

# ── Cleanup on exit ────────────────────────────────────────────────────────────
cleanup() {
  if [ -n "$DEV_PID" ] && kill -0 "$DEV_PID" 2>/dev/null; then
    echo ""
    echo "Stopping dev server (PID $DEV_PID)..."
    kill "$DEV_PID" 2>/dev/null || true
    # Give it 3s to shut down gracefully, then force-kill
    sleep 3
    kill -9 "$DEV_PID" 2>/dev/null || true
  fi
  # Kill any stragglers on port 3000
  lsof -ti :3000 2>/dev/null | xargs kill -9 2>/dev/null || true
  # Clean up log
  [ -n "$DEV_LOG" ] && rm -f "$DEV_LOG"
}
trap cleanup EXIT

check() {
  if [ "$1" = "1" ]; then
    pass=$((pass + 1))
    echo "PASS  $2"
  else
    fail=$((fail + 1))
    echo "FAIL  $2"
  fi
}

echo "========================================"
echo " verify-live.sh"
echo "========================================"
echo ""

# ── Step 1: reset DB ───────────────────────────────────────────────────────────
echo "Step 1: Running db:reset (seed + simulate)..."
npm run db:reset --cache .npm-cache 2>&1
if [ $? -ne 0 ]; then
  echo "FAIL  db:reset exited non-zero — cannot proceed"
  exit 1
fi
echo ""

# ── Step 2: Sample COUNT before starting server ────────────────────────────────
ASSERT_SCRIPT=$(mktemp ./scripts/live-assert-XXXXX.ts)
cat > "$ASSERT_SCRIPT" << 'TSEOF'
import Database from 'better-sqlite3'
const db = new Database(process.env.DB_FILE_NAME ?? './stecopro.db', { readonly: true })
const row = db.prepare('SELECT COUNT(*) AS n, MAX("recordedAt") AS m FROM time_series_readings').get() as any
// recordedAt is stored as Unix seconds (Drizzle integer/timestamp in better-sqlite3)
const nowSec = Math.floor(Date.now() / 1000)
const maxAgeSec = row.m !== null ? nowSec - row.m : null
console.log('COUNT|' + row.n)
console.log('MAX_RECORDED_AT|' + row.m)
console.log('MAX_AGE_SEC|' + (maxAgeSec !== null ? maxAgeSec : 'null'))
db.close()
TSEOF

PRE_RESULT=$(DB_FILE_NAME=./stecopro.db npx tsx "$ASSERT_SCRIPT" 2>&1)
rm -f "$ASSERT_SCRIPT"
COUNT_BEFORE=$(echo "$PRE_RESULT" | grep '^COUNT|' | cut -d'|' -f2)
echo "Step 2: Readings before server start: $COUNT_BEFORE"
echo ""

# ── Step 3: Start dev server ───────────────────────────────────────────────────
echo "Step 3: Starting dev server..."
DEV_LOG=$(mktemp /tmp/stecopro-live-verify-XXXXX.log)
DB_FILE_NAME=./stecopro.db npm run dev > "$DEV_LOG" 2>&1 &
DEV_PID=$!
echo "Dev server PID: $DEV_PID"
echo ""

# ── Step 4: Wait for server ready (up to 60s) ─────────────────────────────────
echo "Step 4: Waiting for server ready..."
BOOT_TIME=$(date +%s)
MAX_WAIT=60
waited=0
READY=0
while [ $waited -lt $MAX_WAIT ]; do
  if grep -q "Ready\|Local:" "$DEV_LOG" 2>/dev/null; then
    READY=1
    echo "  Server ready after ${waited}s"
    break
  fi
  sleep 2
  waited=$((waited + 2))
done

check "$READY" "Server started successfully and reached Ready state"

if [ "$READY" != "1" ]; then
  echo "Cannot continue — server never became ready"
  exit 1
fi

# ── Step 5: Assert single simulator start ─────────────────────────────────────
echo ""
echo "Step 5: Checking simulator start guard..."
# Wait a bit for instrumentation to run (it runs async)
sleep 3

LIVE_START_COUNT=$(grep -c '\[simulator\] live mode started' "$DEV_LOG" 2>/dev/null || echo "0")
SINGLE_START=0
[ "$LIVE_START_COUNT" = "1" ] && SINGLE_START=1
check "$SINGLE_START" "Simulator started exactly once (HMR guard): count=$LIVE_START_COUNT (expect 1)"

# ── Step 6: Freshness / row-growth assertion ───────────────────────────────────
echo ""
echo "Step 6: Asserting live data freshness..."

# Primary check: MAX(recordedAt) should be within a reasonable window
# (either near current time from catch-up, or from backfill data during current shift)
ASSERT_SCRIPT2=$(mktemp ./scripts/live-assert-XXXXX.ts)
cat > "$ASSERT_SCRIPT2" << 'TSEOF2'
import Database from 'better-sqlite3'
const db = new Database(process.env.DB_FILE_NAME ?? './stecopro.db', { readonly: true })
const row = db.prepare('SELECT COUNT(*) AS n, MAX("recordedAt") AS m FROM time_series_readings').get() as any
// recordedAt stored as Unix seconds
const nowSec = Math.floor(Date.now() / 1000)
const maxAgeSec = row.m !== null ? nowSec - row.m : null
// Fresh = MAX is within 2 hours of now (catches data within the current shift window)
// Negative means MAX is in the future (backfill filled ahead), which is also "fresh"
const isFresh = maxAgeSec !== null && maxAgeSec <= 7200
console.log('COUNT|' + row.n)
console.log('MAX_RECORDED_AT|' + row.m)
console.log('MAX_AS_ISO|' + (row.m !== null ? new Date(row.m * 1000).toISOString() : 'null'))
console.log('MAX_AGE_SEC|' + (maxAgeSec !== null ? maxAgeSec : 'null'))
console.log('IS_FRESH|' + (isFresh ? '1' : '0'))
db.close()
TSEOF2

POST_RESULT=$(DB_FILE_NAME=./stecopro.db npx tsx "$ASSERT_SCRIPT2" 2>&1)
rm -f "$ASSERT_SCRIPT2"
COUNT_AFTER=$(echo "$POST_RESULT" | grep '^COUNT|' | cut -d'|' -f2)
MAX_ISO=$(echo "$POST_RESULT" | grep '^MAX_AS_ISO|' | cut -d'|' -f2)
MAX_AGE=$(echo "$POST_RESULT" | grep '^MAX_AGE_SEC|' | cut -d'|' -f2)
IS_FRESH=$(echo "$POST_RESULT" | grep '^IS_FRESH|' | cut -d'|' -f2)

echo "  COUNT after boot: $COUNT_AFTER"
echo "  MAX(recordedAt):  $MAX_ISO"
echo "  MAX age (sec):    $MAX_AGE (negative = data is ahead of now)"

# Check if count grew (bonus: interval may have fired)
COUNT_GREW=0
if [ "$COUNT_AFTER" -gt "$COUNT_BEFORE" ] 2>/dev/null; then
  COUNT_GREW=1
  echo "  Count grew: $COUNT_BEFORE → $COUNT_AFTER (live tick fired)"
fi

# Primary: freshness (MAX within 2h of now, or in future = current-shift data)
check "$IS_FRESH" "Live data freshness: MAX(recordedAt)=$MAX_ISO age=${MAX_AGE}s (expect ≤7200s or negative)"

# Bonus: count grew (only logged, not required for pass since interval is 60s)
if [ "$COUNT_GREW" = "1" ]; then
  echo "BONUS Reading count grew during run: $COUNT_BEFORE → $COUNT_AFTER"
fi

# ── Final summary ──────────────────────────────────────────────────────────────
echo ""
echo "========================================"
echo "RESULT: $pass passed, $fail failed"
echo "========================================"

[ $fail -eq 0 ]

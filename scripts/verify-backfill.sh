#!/bin/bash
# verify-backfill.sh — asserts all Phase 2 must-haves after a fresh db:reset
# Run: bash scripts/verify-backfill.sh
# Exit 0 if all assertions pass, 1 if any fail.

pass=0
fail=0

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
echo " verify-backfill.sh"
echo "========================================"
echo ""

# ── Step 1: reset DB (seed + simulate) ──────────────────────────────────────
echo "Running db:reset (seed + simulate)..."
npm run db:reset --cache .npm-cache 2>&1
if [ $? -ne 0 ]; then
  echo "FAIL  db:reset exited non-zero — cannot proceed"
  exit 1
fi
echo ""

# ── Step 2: write assertion script to temp file inside project (needs node_modules) ──
ASSERT_SCRIPT=$(mktemp ./scripts/verify-assert-XXXXX.ts)
cat > "$ASSERT_SCRIPT" << 'TSEOF'
import Database from 'better-sqlite3'

const dbPath = process.env.DB_FILE_NAME ?? './stecopro.db'
const db = new Database(dbPath, { readonly: true })

// Actual column names verified via PRAGMA table_info:
//   time_series_readings: id, tenant_id, machine_id, recordedAt, current_a, runState
//   stop_events:          id, tenant_id, plant_id, startAt, endAt, reason, stop_type
//   shifts:               id, tenant_id, plant_id, shift_type, startAt, endAt
//   bale_events:          id, tenant_id, plant_id, fraction_id, machine_id, occurredAt, weight_kg

// ── 1. SHIFT COUNT ──────────────────────────────────────────────────────────
const shiftCount = (db.prepare('SELECT COUNT(*) AS n FROM shifts').get() as any).n
const shiftPass  = shiftCount >= 26 && shiftCount <= 28
console.log('ASSERT1|' + (shiftPass ? '1' : '0') + '|shifts=' + shiftCount + ' (expect 26-28)')

// ── 2. MACHINE COVERAGE ─────────────────────────────────────────────────────
const machineCount = (db.prepare('SELECT COUNT(DISTINCT machine_id) AS n FROM time_series_readings').get() as any).n
const machinePass  = machineCount === 3
console.log('ASSERT2|' + (machinePass ? '1' : '0') + '|distinct_machines=' + machineCount + ' (expect 3)')

// ── 3. FRACTION COVERAGE ────────────────────────────────────────────────────
const fractionRows = db.prepare(
  'SELECT fraction_id, COUNT(*) AS n FROM bale_events GROUP BY fraction_id'
).all() as any[]
const fractionCount = fractionRows.length
const allFractionsHaveBales = fractionRows.every((r: any) => r.n > 0)
const fractionPass = fractionCount === 4 && allFractionsHaveBales
const fractionDetail = fractionRows.map((r: any) => 'id=' + r.fraction_id + '(' + r.n + ')').join(' ')
console.log('ASSERT3|' + (fractionPass ? '1' : '0') + '|fractions_with_bales=' + fractionCount + ' [' + fractionDetail + '] (expect 4 non-zero groups)')

// ── 4. AVAILABILITY ─────────────────────────────────────────────────────────
// Column is 'runState' (Drizzle camelCase, confirmed via PRAGMA table_info)
const minMachineRow = db.prepare('SELECT MIN(machine_id) AS mid FROM time_series_readings').get() as any
const bunkerMachineId = minMachineRow.mid
const totalReadings   = (db.prepare('SELECT COUNT(*) AS n FROM time_series_readings WHERE machine_id = ?').get(bunkerMachineId) as any).n
const runReadings     = (db.prepare('SELECT COUNT(*) AS n FROM time_series_readings WHERE machine_id = ? AND "runState" = 1').get(bunkerMachineId) as any).n
const availability    = totalReadings > 0 ? runReadings / totalReadings : 0
const availPass       = availability >= 0.85 && availability <= 0.95
console.log('ASSERT4|' + (availPass ? '1' : '0') + '|availability=' + (availability * 100).toFixed(1) + '% (expect 85-95%)')

// ── 5. IDLE NOT FAULT ───────────────────────────────────────────────────────
// Column: stop_type (explicit snake_case alias in schema)
const bunkerFaults = (db.prepare(
  "SELECT COUNT(*) AS n FROM stop_events WHERE reason = 'Bunker tom' AND stop_type = 'fault'"
).get() as any).n
const idleCount = (db.prepare(
  "SELECT COUNT(*) AS n FROM stop_events WHERE stop_type = 'idle'"
).get() as any).n
const idleNotFaultPass = bunkerFaults === 0 && idleCount > 0
console.log('ASSERT5|' + (idleNotFaultPass ? '1' : '0') + '|bunker_faults=' + bunkerFaults + ' idle_stops=' + idleCount + ' (expect faults=0 idle>0)')

// ── 6. STOP SPREAD ──────────────────────────────────────────────────────────
// Columns: "endAt", "startAt" (Drizzle camelCase, confirmed via PRAGMA table_info)
// Stored as milliseconds since epoch (integer mode: 'timestamp' uses ms)
const shortStops = (db.prepare(
  'SELECT COUNT(*) AS n FROM stop_events WHERE "endAt" IS NOT NULL AND ("endAt" - "startAt") <= 600'
).get() as any).n
const longStops  = (db.prepare(
  'SELECT COUNT(*) AS n FROM stop_events WHERE "endAt" IS NOT NULL AND ("endAt" - "startAt") >= 1800'
).get() as any).n
const spreadPass = shortStops > longStops
console.log('ASSERT6|' + (spreadPass ? '1' : '0') + '|short_stops=' + shortStops + ' long_stops=' + longStops + ' (expect short > long)')

db.close()
TSEOF

# ── Step 3: run assertions ───────────────────────────────────────────────────
echo "Running assertions..."
echo ""

RESULT=$(npx tsx "$ASSERT_SCRIPT" 2>&1)
TSX_EXIT=$?
rm -f "$ASSERT_SCRIPT"

if [ $TSX_EXIT -ne 0 ]; then
  echo "ERROR: assertion script failed:"
  echo "$RESULT"
  exit 1
fi

# ── Step 4: parse pipe-delimited output ──────────────────────────────────────
while IFS= read -r line; do
  if [[ "$line" == ASSERT1\|* ]]; then
    val=$(echo "$line" | cut -d'|' -f2)
    detail=$(echo "$line" | cut -d'|' -f3-)
    check "$val" "1. Shift count: $detail"
  elif [[ "$line" == ASSERT2\|* ]]; then
    val=$(echo "$line" | cut -d'|' -f2)
    detail=$(echo "$line" | cut -d'|' -f3-)
    check "$val" "2. Machine coverage: $detail"
  elif [[ "$line" == ASSERT3\|* ]]; then
    val=$(echo "$line" | cut -d'|' -f2)
    detail=$(echo "$line" | cut -d'|' -f3-)
    check "$val" "3. Fraction coverage: $detail"
  elif [[ "$line" == ASSERT4\|* ]]; then
    val=$(echo "$line" | cut -d'|' -f2)
    detail=$(echo "$line" | cut -d'|' -f3-)
    check "$val" "4. Availability: $detail"
  elif [[ "$line" == ASSERT5\|* ]]; then
    val=$(echo "$line" | cut -d'|' -f2)
    detail=$(echo "$line" | cut -d'|' -f3-)
    check "$val" "5. Idle not fault: $detail"
  elif [[ "$line" == ASSERT6\|* ]]; then
    val=$(echo "$line" | cut -d'|' -f2)
    detail=$(echo "$line" | cut -d'|' -f3-)
    check "$val" "6. Stop spread: $detail"
  fi
done <<< "$RESULT"

echo ""
echo "========================================"
echo "RESULT: $pass passed, $fail failed"
echo "========================================"

[ $fail -eq 0 ]

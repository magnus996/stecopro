---
phase: 02-simulator-ingest
plan: "04"
subsystem: simulator
tags: [simulator, live-mode, instrumentation, next.js, better-sqlite3, sqlite, drizzle]

# Dependency graph
requires:
  - phase: 02-03
    provides: runBackfill, advanceLiveTick, SimContext, SqliteIngestAdapter — all reused by live.ts
  - phase: 02-01
    provides: SqliteIngestAdapter implementation used by live.ts

provides:
  - startLive(): opens own WAL connection, resolves ids, catch-up from MAX(recordedAt), 60s interval tick
  - src/instrumentation.ts: register() with NEXT_RUNTIME + globalThis guards, dynamic-imports startLive
  - scripts/verify-live.sh: repeatable SIMU-08 acceptance test

affects:
  - 03-dashboard (live data keeps the dashboard animating in real time)
  - 04-reports (OEE/availability computed over live + historical data)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "instrumentation.ts register() with NEXT_RUNTIME guard + globalThis.__SIMULATOR_STARTED__ once-guard"
    - "Dynamic import in instrumentation to keep simulator out of edge bundle"
    - "Live runner opens own WAL Database() (not @/db/index) — same pattern as seed.ts/simulate.ts"
    - "Catch-up: reads MAX(recordedAt)*1000 (stored as Unix seconds in better-sqlite3 integer/timestamp)"

key-files:
  created:
    - src/lib/simulator/live.ts
    - src/instrumentation.ts
    - scripts/verify-live.sh
  modified: []

key-decisions:
  - "instrumentationHook flag NOT added to next.config.ts — deprecated/auto-enabled in Next.js 16.2.9"
  - "recordedAt stored as Unix seconds in better-sqlite3 (not ms) — multiply by 1000 to get epoch ms"
  - "Catch-up uses capped gap (MAX_CATCHUP_MS=24h) to prevent re-generating full history on stale DB"
  - "verify-live.sh uses MAX(recordedAt) freshness (negative age = data ahead of now = current shift) as primary assertion"

patterns-established:
  - "Live mode reuses backfill runner (runBackfill + advanceLiveTick) — no duplicated simulation logic"
  - "Instrumentation guard pattern: NEXT_RUNTIME check + globalThis flag prevents HMR double-start"

# Metrics
duration: 22min
completed: 2026-06-11
---

# Phase 2 Plan 04: Live Simulator Mode Summary

**startLive() wired to Next.js instrumentation hook, keeping the plant data current in real time with WAL-safe own DB connection, catch-up, and 60s interval tick via shared runner/engine**

## Performance

- **Duration:** 22 min
- **Started:** 2026-06-11T06:46:28Z
- **Completed:** 2026-06-11T07:09:06Z
- **Tasks:** 3
- **Files modified:** 3 created + 1 bug-fixed (live.ts)

## Accomplishments

- `src/lib/simulator/live.ts`: opens own WAL Database() connection, resolves plant/machine/fraction ids defensively (warns and returns if DB not seeded), catches up any gap from MAX(recordedAt), then ticks every 60s via the shared `advanceLiveTick` engine
- `src/instrumentation.ts`: `register()` guarded on `NEXT_RUNTIME === 'nodejs'` + `globalThis.__SIMULATOR_STARTED__` to prevent edge-runtime execution and HMR double-starts; dynamic `import('./lib/simulator/live')` keeps the simulator out of the edge bundle
- `scripts/verify-live.sh`: three-assertion acceptance test — server starts, single live start, data freshness — all pass in ~20s without waiting for the 60s interval tick

## Task Commits

1. **Task 1: startLive() in live.ts** - `d2a6619` (feat)
2. **Task 2: instrumentation.ts guards + live.ts bug fix** - `1c46b8c` (feat)
3. **Task 3: verify-live.sh** - `23ed896` (feat)

## Files Created/Modified

- `src/lib/simulator/live.ts` - Own WAL connection, id resolution, catch-up, 60s setInterval via advanceLiveTick
- `src/instrumentation.ts` - Next.js register() with NEXT_RUNTIME + globalThis guards; dynamic import
- `scripts/verify-live.sh` - SIMU-08 acceptance test: server ready, single start, data freshness

## Decisions Made

- **instrumentationHook not added to next.config.ts**: Next.js 16.2.9 emits a deprecation warning if the flag is present; `instrumentation.ts` in `src/` is auto-detected by default.
- **recordedAt multiplied by 1000**: Drizzle's `integer({ mode: 'timestamp' })` in better-sqlite3 stores Unix **seconds** (not milliseconds). The catch-up query reads `MAX("recordedAt")` and must multiply by 1000 to compare with `Date.now()`.
- **Catch-up daysBack uses capped window**: After a stale DB, the actual gap could be weeks; we cap at 24h (`MAX_CATCHUP_MS`) and derive `daysBack` from the capped window to avoid regenerating full history on every server start.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed recordedAt epoch unit in catch-up logic**

- **Found during:** Task 2 (instrumention.ts + dev server test)
- **Issue:** `live.ts` read `MAX("recordedAt")` and treated the value as milliseconds; Drizzle `integer({ mode: 'timestamp' })` in better-sqlite3 stores Unix **seconds**, so the gap calculation was off by 1000x — producing a ~29 million minute "gap" that triggered an infinite-looking backfill
- **Fix:** Changed `lastMs = maxRow.maxAt` to `lastMs = maxRow.maxAt * 1000` in the catch-up block; also fixed `daysBack` to use capped gap window instead of actual gap
- **Files modified:** `src/lib/simulator/live.ts`
- **Verification:** Dev server boots in <5s and logs `[simulator] live mode started` with no catch-up triggered when data is current; `verify-live.sh` passes in ~20s
- **Committed in:** `1c46b8c` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential fix for correct operation. Without it, the catch-up would re-run the entire history on every server start.

## Issues Encountered

None beyond the epoch unit bug above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Full Phase 2 goal achieved: 14 days of believable history (27 shifts, 36540 readings, 90.5% availability) + live mode running while dev server is up
- SIMU-08 verified: `verify-live.sh` passes, single live start confirmed, data freshness confirmed
- No SQLITE_BUSY errors observed (WAL + busy_timeout working)
- `npx tsc --noEmit` passes
- Dashboard phase (Phase 3) can read from `time_series_readings` and expect current data while dev server runs

---
*Phase: 02-simulator-ingest*
*Completed: 2026-06-11*

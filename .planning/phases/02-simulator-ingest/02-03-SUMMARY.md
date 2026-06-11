---
phase: 02-simulator-ingest
plan: "03"
subsystem: simulator
tags: [simulator, backfill, ingest, sqlite, better-sqlite3, tsx]

requires:
  - phase: 02-01
    provides: IngestAdapter interface and SqliteIngestAdapter implementation
  - phase: 02-02
    provides: Pure simulateShift engine, SimEvent types, time helpers

provides:
  - runBackfill(adapter, ctx, opts): walks 14 days of Oslo shifts, calls engine, maps SimEvents to adapter calls
  - SimContext type: resolved plant/machine/fraction DB ids for index→id mapping
  - advanceLiveTick(adapter, ctx, now): thin live-tick stub for plan 04
  - scripts/simulate.ts: standalone backfill entrypoint with own DB connection
  - db:simulate and db:reset package.json scripts
  - scripts/verify-backfill.sh: repeatable assertion script for phase 2 quality gates

affects:
  - 02-04 (live-tick runner uses advanceLiveTick from runner.ts)
  - 03-dashboard (reads history populated by db:simulate)
  - 04-reports (availability/OEE math consumes backfilled data)

tech-stack:
  added: []
  patterns:
    - "Own Database() connection pattern in scripts/ (not @/db/index which is server-only)"
    - "Adapter injection — runner never opens its own DB connection"
    - "Pipe-delimited ASSERT lines from tsx, parsed in bash for robust shell comparison"
    - "Project-local temp .ts file for tsx assertions (temp in /tmp loses node_modules resolution)"

key-files:
  created:
    - src/lib/simulator/runner.ts
    - scripts/simulate.ts
    - scripts/verify-backfill.sh
  modified:
    - package.json

key-decisions:
  - "runner.ts is DB-connection-free — adapter always injected, so live mode (plan 04) reuses same code"
  - "Abstract engine fraction indices map in fixed order: 0=Deink, 1=OCC, 2=Tetra/emballasjepapp, 3=Miks"
  - "advanceLiveTick is a thin stub exported from runner.ts; plan 04 will flesh out shift-boundary management"
  - "verify-backfill.sh writes temp assertion .ts file inside scripts/ (not /tmp) so better-sqlite3 resolves"
  - "SQLite column names: runState and startAt/endAt are camelCase (Drizzle default, not snake_case) — raw queries must quote them"

patterns-established:
  - "Simulator scripts use own Database() connection following seed.ts pattern"
  - "Backfill is idempotent: clears event tables then rewrites from scratch"
  - "Availability metric: runState=1 readings / total readings for bunker machine"

duration: 8min
completed: 2026-06-11
---

# Phase 2 Plan 03: Simulator Runner + Backfill Summary

**runBackfill() runner wiring simulateShift engine to SqliteIngestAdapter, producing 14 days of 90.5% availability history via `npm run db:simulate`**

## Performance

- **Duration:** 8 min
- **Started:** 2026-06-11T06:34:03Z
- **Completed:** 2026-06-11T06:42:41Z
- **Tasks:** 3
- **Files modified:** 4

## Accomplishments

- `runBackfill` walks 14 Oslo calendar days × 2 shifts, seeds engine deterministically per shift, and maps every SimEvent type to the correct adapter call
- Standalone `scripts/simulate.ts` discovers real plant/machine/fraction ids from the DB, clears event tables idempotently, runs backfill, and prints counts + availability (27 shifts, 36540 readings, 90.5%)
- `scripts/verify-backfill.sh` asserts all 6 phase quality gates — all PASS (shifts 26-28, 3 machines, 4 fractions, 90.5% availability, bunker=idle not fault, more short stops than long)

## Task Commits

1. **Task 1: Implement runBackfill in runner.ts** - `81c8933` (feat)
2. **Task 2: Standalone simulate.ts script + package.json scripts** - `18ae17e` (feat)
3. **Task 3: verify-backfill.sh asserting hard numbers** - `10d2187` (feat)

## Files Created/Modified

- `src/lib/simulator/runner.ts` - runBackfill, SimContext type, advanceLiveTick stub; no DB dependency
- `scripts/simulate.ts` - standalone backfill entrypoint; own Database() connection; discovers ids; idempotent cleanup
- `scripts/verify-backfill.sh` - 6-assertion quality gate script; exits 0 when all pass
- `package.json` - added `db:simulate` and `db:reset` scripts

## Decisions Made

- runner.ts never calls `new Database()` — the adapter is always injected so the live runner (plan 04) can reuse `runBackfill` and `advanceLiveTick` without modification
- Abstract fraction index mapping fixed at 0=Deink, 1=OCC, 2=Tetra/emballasjepapp, 3=Miks (matches engine baleRates order)
- `advanceLiveTick` exported as a documented stub; plan 04 owns shift-boundary management
- verify script writes the assertion .ts file inside `scripts/` (not `/tmp`) so that `npx tsx` can resolve `better-sqlite3` from the project's `node_modules`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed SQLite column name mismatch in verify script**

- **Found during:** Task 3 (verify-backfill.sh)
- **Issue:** Drizzle did not rename `runState`, `startAt`, `endAt` to snake_case — raw SQL queries using `run_state`, `end_at`, `start_at` threw `SqliteError: no such column`
- **Fix:** Updated all raw queries to use the actual camelCase column names with double-quote quoting (`"runState"`, `"endAt"`, `"startAt"`); verified via `PRAGMA table_info`
- **Files modified:** scripts/verify-backfill.sh
- **Committed in:** `10d2187` (Task 3 commit)

**2. [Rule 3 - Blocking] Fixed tsx assertion script location**

- **Found during:** Task 3 (verify-backfill.sh)
- **Issue:** Temp file written to `/tmp` could not resolve `better-sqlite3` (outside project tree)
- **Fix:** Changed `mktemp` path from `/tmp/verify-assert-XXXXX.ts` to `./scripts/verify-assert-XXXXX.ts`
- **Files modified:** scripts/verify-backfill.sh
- **Committed in:** `10d2187` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (1 bug, 1 blocking)
**Impact on plan:** Both fixes necessary for correct operation. No scope creep.

## Issues Encountered

None beyond the auto-fixed column naming and temp file location issues above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- 14 days of history (27 shifts, 36540 readings, 2904 bale events, 133 stop events) ready for dashboard consumption
- Availability computable at 90.5% — within ±5pp of 90% target
- `advanceLiveTick` stub in runner.ts ready for plan 04 to build the live simulation loop around
- `db:reset` gives a clean reproducible demo database state in ~5 seconds

---
*Phase: 02-simulator-ingest*
*Completed: 2026-06-11*

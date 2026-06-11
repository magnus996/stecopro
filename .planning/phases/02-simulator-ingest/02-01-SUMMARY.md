---
phase: 02-simulator-ingest
plan: 01
subsystem: ingest
tags: [sqlite, drizzle-orm, better-sqlite3, wal, ingest-interface, typescript]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: schema.ts tables (timeSeriesReadings, stopEvents, baleEvents, shifts), src/db/index.ts pattern, seed.ts connection pattern
provides:
  - IngestAdapter TypeScript interface (write-only, 6 methods)
  - StopType and ShiftType exported types
  - SqliteIngestAdapter implementing IngestAdapter with batched readings
  - WAL-mode app DB connection safe for concurrent simulator writes
affects:
  - 02-02-simulator-engine (engine calls IngestAdapter methods)
  - 02-03-backfill-script (script instantiates SqliteIngestAdapter)
  - 02-04-live-mode (instrumentation.ts uses SqliteIngestAdapter via runner)
  - 03-dashboard (reads from same WAL-mode DB)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "IngestAdapter interface as write-only ingest contract (simulator + future OPC UA adapter)"
    - "Adapter receives Drizzle db in constructor — no @/db/index import; caller provides connection"
    - "reportReading buffers writes; flush() uses db.transaction() for batch insert"
    - "WAL + busy_timeout + synchronous=NORMAL on all SQLite connections"

key-files:
  created:
    - src/lib/ingest/interface.ts
    - src/lib/ingest/sqlite-adapter.ts
  modified:
    - src/db/index.ts

key-decisions:
  - "Adapter receives db instance in constructor — not imported from @/db/index (server-only throws outside Next.js)"
  - "reportReading buffers into pendingReadings array; flush() wraps in db.transaction() — batch pattern from research"
  - "WAL pragmas added to src/db/index.ts directly (two lines) rather than separate initialization module"

patterns-established:
  - "IngestAdapter: all plant data writes go through one interface (OPC UA adapter will implement same interface)"
  - "Batch flush: accumulate low-volume-per-tick reads in memory, commit all in one transaction"

# Metrics
duration: 4min
completed: 2026-06-11
---

# Phase 02 Plan 01: Ingest Interface & SQLite Adapter Summary

**Write-only IngestAdapter interface + SqliteIngestAdapter with batched readings and WAL-mode app DB connection**

## Performance

- **Duration:** 4 min
- **Started:** 2026-06-11T06:21:55Z
- **Completed:** 2026-06-11T06:26:10Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments
- Defined `IngestAdapter` TypeScript interface — the single write contract the simulator (and a future OPC UA adapter) implements, with 6 methods: reportReading, reportStop, reportStopEnded, reportBale, ensureShift, flush
- Implemented `SqliteIngestAdapter` with constructor-injected Drizzle db, reading buffer flushed in one transaction, and immediate writes for stops/bales/shifts (with returned IDs for engine use)
- Added WAL mode, busy_timeout=5000, and synchronous=NORMAL to `src/db/index.ts` so concurrent simulator writes won't lock out dashboard reads

## Task Commits

Each task was committed atomically:

1. **Task 1: Define IngestAdapter interface** - `6dd6120` (feat)
2. **Task 2: Implement SqliteIngestAdapter** - `152f414` (feat)
3. **Task 3: Add WAL pragmas to app DB connection** - `b48a753` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `src/lib/ingest/interface.ts` - IngestAdapter interface + StopType + ShiftType exports
- `src/lib/ingest/sqlite-adapter.ts` - SqliteIngestAdapter implementing IngestAdapter; batched reportReading, immediate stop/bale/shift writes
- `src/db/index.ts` - WAL pragmas added (journal_mode=WAL, busy_timeout=5000, synchronous=NORMAL); server-only and per-module Database() pattern preserved

## Decisions Made
- **Adapter receives db in constructor (not @/db/index):** `src/db/index.ts` has `import 'server-only'` which throws unconditionally outside the Next.js request context. The adapter follows the same pattern as `seed.ts` — caller creates own connection and passes it in.
- **flush() uses db.transaction(tx => {...}):** The Drizzle better-sqlite3 transaction API takes a callback (not an IIFE). Corrected during implementation.
- **WAL pragmas in src/db/index.ts directly:** Adding two lines is the minimal-diff approach; no new initialization module needed.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed incorrect transaction call pattern**
- **Found during:** Task 2 (implement SqliteIngestAdapter)
- **Issue:** Plan's research example showed `this.db.transaction(() => {...})()` (IIFE pattern). Drizzle's `BetterSQLite3Database.transaction()` takes a callback and returns the result directly — calling the return value throws `TypeError: void is not callable`.
- **Fix:** Changed to `this.db.transaction((tx) => { ... })` and used `tx` inside the callback
- **Files modified:** src/lib/ingest/sqlite-adapter.ts
- **Verification:** `npx tsc --noEmit` passes; no call-signature errors
- **Committed in:** 152f414 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug — incorrect transaction invocation pattern)
**Impact on plan:** Fix necessary for correct operation. No scope creep.

## Issues Encountered
None — TypeScript errors from the parallel agent's `src/lib/simulator/engine.test.ts` (modules not yet created in plan 02-02) appeared in `npx tsc --noEmit` output but are unrelated to this plan's files.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `src/lib/ingest/interface.ts` and `src/lib/ingest/sqlite-adapter.ts` ready for plan 02-02 (engine) to import and call
- `src/db/index.ts` WAL-enabled; safe for concurrent simulator writes during dev
- No blockers for plan 02-02 or 02-03

---
*Phase: 02-simulator-ingest*
*Completed: 2026-06-11*

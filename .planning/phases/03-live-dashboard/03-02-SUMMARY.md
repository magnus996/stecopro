---
phase: 03-live-dashboard
plan: 02
subsystem: business-logic
tags: [oee, vitest, tdd, typescript, pure-function, kpi]

# Dependency graph
requires:
  - phase: 02-simulator-ingest
    provides: stop events, bale events, shift model — the inputs calculateOee consumes
provides:
  - calculateOee(OeeInput): OeeResult — canonical OEE math used by Phase 3 dashboard and Phase 4 reports
  - QUALITY_FACTOR = 0.95 exported constant with override support
  - OeeInput/OeeResult/OeeStopInput TypeScript interfaces
affects:
  - 03-live-dashboard (plans 03 onward) — dashboard OEE widget imports calculateOee
  - 04-reports — report OEE calculations use identical function for consistent numbers

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Pure shared module pattern: no DB, no server-only, explicit nowMs parameter for testability"
    - "Stop window clamping: overlap(stop interval, shift window) prevents negative availability"
    - "Performance denominator: nominalAtRunTime = nominalBalesPerShift * (runSeconds / fullPlannedSeconds)"

key-files:
  created:
    - src/lib/oee.ts
    - src/lib/oee.test.ts
  modified: []

key-decisions:
  - "QUALITY_FACTOR = 0.95 hardcoded in oee.ts; Phase 5 adds per-plant config override"
  - "nowMs is an explicit parameter (default Date.now()) so tests are deterministic without mocking"
  - "stopType (fault/idle/planned) does NOT affect the math — all reduce availability identically per ISO 22400-2"
  - "performance denominator uses fullPlannedSeconds (full 8h), not plannedSeconds-so-far, so partial-shift OEE is comparable to full-shift"

patterns-established:
  - "OEE shared module pattern: import calculateOee from src/lib/oee — both dashboard and reports use this"
  - "Stop clamping helper overlapSeconds() returns 0 for no-overlap, positive seconds for partial/full overlap"

# Metrics
duration: 3min
completed: 2026-06-11
---

# Phase 3 Plan 02: Shared OEE Calculation Module Summary

**Pure `calculateOee` function with explicit `nowMs`, stop-window clamping, and 14 deterministic unit tests covering availability, performance, quality, clamping, and edge cases**

## Performance

- **Duration:** ~3 min
- **Started:** 2026-06-11T07:41:23Z
- **Completed:** 2026-06-11T07:43:50Z
- **Tasks:** TDD RED → GREEN (no refactor needed)
- **Files modified:** 2

## Accomplishments
- `src/lib/oee.ts` exports `calculateOee`, `QUALITY_FACTOR` (0.95), and `OeeInput`/`OeeResult`/`OeeStopInput` types
- Stop clamping correctly handles: ongoing stops (`endAt=null`), stops crossing shift boundaries, stops before shift start, stops after shift end
- `nowMs` explicit parameter makes all tests fully deterministic without `vi.setSystemTime`
- 14 unit tests cover all 9 behaviour rules including edge cases: no-stop shifts, zero bales, overcapacity capping, pre-shift stops, zero planned seconds (no NaN)
- All 31 tests pass (14 new + 17 existing simulator tests)

## Task Commits

TDD commits (RED → GREEN):

1. **RED: Failing tests** - `7415f93` (test(03-02): add failing OEE calculation tests)
2. **GREEN: Implementation** - `5a17d92` (feat(03-02): implement shared OEE calculation module)

No REFACTOR commit needed — `overlapSeconds` helper already extracted in the GREEN commit.

## Files Created/Modified
- `src/lib/oee.ts` — Pure OEE calculation module: `calculateOee`, `QUALITY_FACTOR`, all types
- `src/lib/oee.test.ts` — 14 deterministic unit tests covering all behaviour rules and edge cases

## Decisions Made
- **`nowMs` explicit parameter**: Accepts `nowMs?: number` defaulting to `Date.now()` — avoids test nondeterminism without requiring `vi.setSystemTime`. Tests pass fixed timestamps.
- **`QUALITY_FACTOR = 0.95` in `oee.ts`**: Research recommended hardcoding for Phase 3; Phase 5 admin UI adds per-plant config override. The constant is exported so the dashboard OEE widget can reference it in its definition text.
- **`stopType` doesn't affect math**: `idle`, `fault`, and `planned` stops all reduce availability identically per ISO 22400-2. `stopType` is carried in `OeeStopInput` solely for callers that want to label stops in the UI.
- **`fullPlannedSeconds` in performance denominator**: Performance computes `nominalAtRunTime = nominalBalesPerShift * (runSeconds / fullPlannedSeconds)` using the **full** 8h window, not just elapsed-so-far. This ensures mid-shift performance is comparable to end-of-shift performance.

## Deviations from Plan

None — plan executed exactly as written. `overlapSeconds` helper was described as an optional refactor step in the implementation guidance; it was included in the GREEN commit since it was already the cleanest implementation path, eliminating the need for a separate REFACTOR phase.

## Issues Encountered
None.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- `calculateOee` is ready for import in Phase 3 dashboard OEE widget: `import { calculateOee, QUALITY_FACTOR } from '@/lib/oee'`
- `calculateOee` is ready for Phase 4 reports — identical function produces identical numbers
- Input types `OeeInput`/`OeeStopInput` map directly to Drizzle query results from `stopEvents` table
- Timestamp note: Drizzle returns `Date` objects for `integer({ mode: 'timestamp' })` columns — pass directly to `startAt`/`endAt`

---
*Phase: 03-live-dashboard*
*Completed: 2026-06-11*

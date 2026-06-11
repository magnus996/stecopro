---
phase: 04-shift-reports-analysis
plan: 01
subsystem: api
tags: [drizzle-orm, sqlite, oee, vitest, dal, reports, shifts]

# Dependency graph
requires:
  - phase: 03-live-dashboard
    provides: calculateOee in src/lib/oee.ts, DashboardData types, getShiftStops/getBaleCountsByFraction accessors
  - phase: 01-foundation
    provides: verifySession, DAL pattern, tenant isolation rules
provides:
  - Six report DAL accessors in dal.ts (getShiftReportList, getShiftReportDetail, getParetoData, getBalesPerDayData, getDayVsEveningComparison, getShiftEnergyProxy)
  - Exported interfaces: ShiftReportRow, ShiftReportDetail, ParetoRow, BalesPerDayRow, ShiftComparisonRow, ShiftEnergyProxy
  - Vitest invariant suite proving cartesian avoidance and OEE determinism
affects:
  - 04-02-shift-reports-pages (consumes getShiftReportList, getShiftReportDetail, getShiftEnergyProxy)
  - 04-03-analysis-pages (consumes getParetoData, getBalesPerDayData, getDayVsEveningComparison)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Separate queries for stops/bales (never combined LEFT JOIN) to avoid cartesian product inflation"
    - "calculateOee with nowMs=shiftEnd for all historical shifts — identical numbers to dashboard"
    - "JS bucketing for Oslo calendar day grouping (avoids UTC/Oslo complexity in SQL)"
    - "getDayVsEveningComparison reuses getShiftReportList for OEE consistency (single path)"

key-files:
  created:
    - src/lib/dal.report.test.ts
  modified:
    - src/lib/dal.ts

key-decisions:
  - "Stops and bales fetched in SEPARATE queries for all report accessors (cartesian avoidance verified live DB: 267120s vs correct 2520s)"
  - "getDayVsEveningComparison reuses getShiftReportList internally — no duplicate OEE calculation path"
  - "Pareto returns raw totals only; cumulative % computed in JS by page (SQL window functions not needed for 12 reasons)"
  - "Oslo calendar day grouping done in JS via Intl.DateTimeFormat (avoids UTC-stored timestamp vs Oslo-day mismatch in SQL)"

patterns-established:
  - "Report accessors: verifySession first, tenantId from session only, separate stop/bale queries"
  - "Historical shift OEE: calculateOee(nowMs=shiftEnd.getTime()) — fully elapsed window, deterministic"

# Metrics
duration: 4min
completed: 2026-06-11
---

# Phase 4 Plan 01: Shift Reports DAL Summary

**Six tenant-scoped report accessors added to dal.ts with separate stop/bale queries (cartesian avoidance), calculateOee for every historical shift OEE (dashboard-identical), and vitest invariant suite proving both correctness guarantees.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-06-11T08:24:37Z
- **Completed:** 2026-06-11T08:29:23Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments

- `getShiftReportList` and `getShiftReportDetail` added: stops and bales fetched in separate queries to avoid cartesian product (live DB verified: combined JOIN gives 267120s vs correct 2520s for a shift with 5 stops and 106 bales)
- `getParetoData`, `getBalesPerDayData`, `getDayVsEveningComparison`, `getShiftEnergyProxy` added: all tenant-scoped, all OEE via `calculateOee`
- Vitest invariant suite (12 tests green) proves: (1) JS bucketing gives correct stopSeconds while cartesian multiply would give `correctSeconds * baleCount`; (2) `calculateOee` with `nowMs=shiftEnd` is deterministic — results identical for `nowMs=shiftEnd` and `nowMs=shiftEnd+10min`

## Task Commits

Each task was committed atomically:

1. **Task 1: Shift list + shift detail accessors** - `ecb0f15` (feat)
2. **Task 2: Pareto, bales-per-day, day-vs-evening, and energy-proxy accessors** - `00ccfa2` (feat)
3. **Task 3: Vitest invariants — cartesian avoidance + dashboard-identical OEE** - `7be632a` (test)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `src/lib/dal.ts` - Added six report accessors + exported interfaces; added `isNotNull` import from drizzle-orm
- `src/lib/dal.report.test.ts` - New vitest suite: 12 tests covering cartesian avoidance and OEE determinism invariants

## Decisions Made

- **Separate queries, JS bucketing**: fetching all stops in [fromMs, toMs] and bucketing by shift in JS, rather than per-shift sub-queries. One round trip for the whole range. Stops and bales remain in separate queries throughout (never combined).
- **getDayVsEveningComparison reuses getShiftReportList**: ensures exactly one OEE calculation path for reports. No risk of day/evening numbers diverging from the list page.
- **Oslo calendar day grouping in JS**: `Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Oslo' })` on raw `occurredAt` values avoids the UTC-vs-Oslo mismatch that SQL date functions would introduce.
- **Pareto raw totals only**: the 12-reason dataset is trivially small; computing cumulative % in SQL with window functions would add complexity for zero benefit.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added isNotNull import from drizzle-orm**

- **Found during:** Task 2 (getParetoData implementation)
- **Issue:** `isNotNull` used in Pareto WHERE clause but not in the existing import line
- **Fix:** Added `isNotNull` to the `drizzle-orm` import
- **Files modified:** `src/lib/dal.ts`
- **Verification:** tsc passed after fix
- **Committed in:** `00ccfa2` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 blocking import)
**Impact on plan:** Trivial missing import, no scope creep.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Six report accessors exported from `dal.ts`, all tenant-scoped, all OEE via `calculateOee`
- `ShiftReportRow`, `ShiftReportDetail`, `ParetoRow`, `BalesPerDayRow`, `ShiftComparisonRow`, `ShiftEnergyProxy` interfaces available for UI plans
- Plan 02 (shift-reports pages) can consume `getShiftReportList`, `getShiftReportDetail`, `getShiftEnergyProxy` directly
- Plan 03 (analysis page + CSV) can consume `getParetoData`, `getBalesPerDayData`, `getDayVsEveningComparison` directly
- No blockers.

---
*Phase: 04-shift-reports-analysis*
*Completed: 2026-06-11*

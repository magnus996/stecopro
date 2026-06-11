---
phase: 03-live-dashboard
plan: "03"
subsystem: database
tags: [drizzle-orm, sqlite, oee, dashboard, dal, tenant-isolation, typescript]

# Dependency graph
requires:
  - phase: 03-01
    provides: src/lib/time.ts with getShiftType and getShiftBoundsUtc
  - phase: 03-02
    provides: src/lib/oee.ts with calculateOee, OeeResult, QUALITY_FACTOR
provides:
  - Dashboard DAL accessors in src/lib/dal.ts (getCurrentShiftForPlant, getRecentStops, getLatestBunkerReadingState, getOpenStop, getShiftStops, getBaleCountsByFraction, getBunkerCurrentDraw, getDashboardData)
  - getDashboardData: single composing accessor returning full dashboard payload
  - PlantState type enum (running / running_empty / stopped / outside_shift / no_data)
  - DashboardData interface (serializable-friendly shape for plan 04 page)
affects:
  - 03-04 (dashboard page component calls getDashboardData once per render)
  - 04-xx (reports phase reuses same DAL patterns; calculateOee consistency guaranteed)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "All DAL accessors: cache(async (plantId) => { const session = await verifySession(); ... }) — tenantId never a parameter"
    - "React.cache deduplication of verifySession across sub-accessors within a single request"
    - "LEFT JOIN fractions→baleEvents for per-fraction bale counts (zero-bale fractions still appear)"
    - "PlantState derived via freshness→shift→openStop priority chain (RESEARCH Pattern 5)"
    - "getDashboardData composes sub-accessors with Promise.all where independent"

key-files:
  created: []
  modified:
    - src/lib/dal.ts

key-decisions:
  - "NOMINAL_BALES_PER_SHIFT = 120 defined locally in dal.ts (not imported from simulator params.ts which is simulator-side); references BALE_RATES_PER_SHIFT (45+35+25+15) in comment"
  - "PlantState and DashboardData types exported from dal.ts for plan 04 page to use directly"
  - "getDashboardData uses Promise.all for parallelism where sub-queries are independent"
  - "todayUptime computed via calculateOee (not inline) to guarantee math consistency with shift OEE"
  - "currentDraw window: current-shift bounds if inside shift, else last 120 min from now"
  - "osloDateStr derived via Intl.DateTimeFormat('en-CA') which yields YYYY-MM-DD format natively"

patterns-established:
  - "Pattern: composing accessor wraps verifySession + parallel Promise.all sub-queries for dashboard payload"
  - "Pattern: PlantState freshness check first (>3min stale => no_data), then shift check, then open-stop check"
  - "Pattern: getBaleCountsByFraction reused for different time windows (shift + today) via fromAt/toAt params"

# Metrics
duration: 2min
completed: 2026-06-11
---

# Phase 3 Plan 03: Dashboard DAL Accessors Summary

**Seven tenant-scoped DAL accessors plus a composing getDashboardData delivering live plant state, OEE, per-fraction bale counts, recent stops, and bunker current-draw for plan 04's dashboard page**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-06-11T07:46:22Z
- **Completed:** 2026-06-11T07:48:46Z
- **Tasks:** 2
- **Files modified:** 1

## Accomplishments
- Five core plant-state accessors: getCurrentShiftForPlant, getRecentStops, getLatestBunkerReadingState, getOpenStop, getShiftStops
- Two data-series accessors: getBaleCountsByFraction (LEFT JOIN for zero-bale fractions), getBunkerCurrentDraw
- getDashboardData: single composing accessor calling calculateOee for both current-shift and today-uptime, deriving PlantState via the 5-step freshness/shift/open-stop chain, returning the full DashboardData shape
- TypeScript clean (npx tsc --noEmit), tenant isolation structural guard verified (no function accepts tenantId as a parameter)

## Task Commits

Each task was committed atomically:

1. **Task 1+2: Plant state, shift, stops, uptime, bale counts, current draw, getDashboardData** - `f27912c` (feat)

**Plan metadata:** _(see final commit below)_

## Files Created/Modified
- `src/lib/dal.ts` - Added 436 lines: 7 new accessors + PlantState type + DashboardData interface

## Decisions Made
- `NOMINAL_BALES_PER_SHIFT = 120` defined locally in dal.ts with comment referencing `BALE_RATES_PER_SHIFT` from params.ts (not imported to avoid coupling simulator-side code into the DAL)
- `PlantState` and `DashboardData` types exported from dal.ts so the plan 04 page can import them directly without re-declaring
- `getDashboardData` uses `Promise.all` for independent sub-queries (openStop + latestBunker fetched in parallel; baleCountsByFraction + shiftStops in parallel per window)
- Today uptime computed via `calculateOee` (not inline math) to keep OEE numbers consistent across shift + today widgets
- `osloDateStr` derived via `Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Oslo' })` which returns YYYY-MM-DD natively

## Deviations from Plan

None - plan executed exactly as written. Both tasks merged into one commit since the implementation flowed naturally as a single coherent DAL extension; task boundaries are documented in the commit message.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `getDashboardData(plantId)` is ready to call from the plan 04 dashboard Server Component
- `DashboardData` and `PlantState` types exported for typed props
- All data shapes documented inline; Date objects in returned payload (page converts to ISO/string before passing to Client Components per RESEARCH anti-pattern guidance)
- calculateOee consistency guaranteed: both shift OEE and today uptime use the same function

---
*Phase: 03-live-dashboard*
*Completed: 2026-06-11*

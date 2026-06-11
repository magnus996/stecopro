---
phase: 04-shift-reports-analysis
plan: 03
subsystem: ui
tags: [recharts, next-js, csv-export, role-gate, server-component, pareto, oee, analysis]

# Dependency graph
requires:
  - phase: 04-shift-reports-analysis/04-01
    provides: getShiftReportList, getParetoData, getBalesPerDayData, getDayVsEveningComparison DAL accessors
  - phase: 03-live-dashboard
    provides: Recharts pattern (use client, isAnimationActive=false, ResponsiveContainer), dashboard card Tailwind classes
  - phase: 01-foundation
    provides: verifySession, decrypt, session cookie pattern, role-based access control
provides:
  - Analysis page /reports (produksjonsleder+): date-range OEE trend, downtime Pareto, bales-per-day stacked, day-vs-evening table, period totals, CSV download link
  - Operator role gate: operators redirected from /reports to /reports/shifts
  - CSV export route GET /api/reports/export: semicolon+UTF-8-BOM, Norwegian header, operator 403
  - Four reusable chart components: DateRangeForm, OeeTrendChart, ParetoChart, BalesPerDayChart
  - E2E script scripts/e2e-phase4-analysis.sh (15 assertions)
affects:
  - 05-admin-plant-setup (no direct dependency, but establishes role-gate pattern for analysis pages)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Analysis page: server component, awaited searchParams, role gate via redirect, Promise.all DAL calls"
    - "Pareto enrichment in JS: sort desc, running cumPct — no SQL window functions for 12-row dataset"
    - "Bales-per-day pivot to wide format in server component before crossing server→client boundary"
    - "CSV export: new Response(csv, headers) route handler, semicolon + UTF-8 BOM for Norwegian Excel"
    - "Route handler auth: direct decrypt(cookie) for clean 401, not verifySession redirect"

key-files:
  created:
    - src/app/(app)/reports/page.tsx
    - src/app/(app)/reports/components/DateRangeForm.tsx
    - src/app/(app)/reports/components/OeeTrendChart.tsx
    - src/app/(app)/reports/components/ParetoChart.tsx
    - src/app/(app)/reports/components/BalesPerDayChart.tsx
    - src/app/api/reports/export/route.ts
    - scripts/e2e-phase4-analysis.sh
  modified: []

key-decisions:
  - "Pareto enrichment done in server page component (not DAL) — keeps DAL accessor pure/reusable"
  - "Bales-per-day pivot to wide format done in page — Recharts expects wide format, DAL returns long"
  - "CSV route uses direct decrypt() not verifySession() — returns clean 401 for unauthenticated API callers instead of redirect"
  - "E2E BASE env var override (default localhost:3000) allows parallel testing on alternate ports"
  - "osloDateMinusDays uses noon UTC to avoid DST edge cases in date arithmetic"

patterns-established:
  - "API route auth: decrypt(cookie) → clean 401/403 for non-HTML endpoints"
  - "Role gate pattern: if user.role === operator → redirect('/reports/shifts') in server page"
  - "Server-side data transform before client boundary: Date → string, long → wide pivot, Pareto enrichment all in page.tsx"

# Metrics
duration: 6min
completed: 2026-06-11
---

# Phase 4 Plan 03: Analysis Page + CSV Export Summary

**Date-range analysis page /reports (produksjonsleder+) with OEE trend LineChart, downtime Pareto ComposedChart (dual YAxis), stacked bales-per-day BarChart, day-vs-evening comparison table, period totals, and semicolon+BOM CSV export — operator role gate enforced at both page and API route.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-06-11T08:33:23Z
- **Completed:** 2026-06-11T08:39:23Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- Analysis page `/reports` renders for produksjonsleder+: date-range filter (GET form, 14-day default), period totals, OEE trend per shift, Pareto chart sorted by duration + cumulative %, stacked bales-per-day chart, day-vs-evening comparison table — all data serialised server-side before crossing to client charts
- Operator role gate: `redirect('/reports/shifts')` for operators at both the page and the CSV export route (403)
- CSV export `GET /api/reports/export` returns semicolon-delimited UTF-8 BOM Norwegian CSV with all shift KPIs; direct `decrypt(cookie)` returns 401/403 cleanly without redirect
- E2E script `scripts/e2e-phase4-analysis.sh` passes 15 assertions including BOM byte check (`efbbbf` via xxd), semicolon separator, `text/csv` content-type, operator redirect and 403

## Task Commits

Each task was committed atomically:

1. **Task 1: Chart components + date filter form** - `2cbe165` (feat)
2. **Task 2: Analysis page /reports with operator role gate** - `64b5971` (feat)
3. **Task 3: CSV export route handler + analysis E2E** - `a559d8d` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `src/app/(app)/reports/page.tsx` — Server component: role gate, searchParams, Promise.all DAL calls, data transforms, chart rendering
- `src/app/(app)/reports/components/DateRangeForm.tsx` — Server component, HTML GET form, Norwegian Fra/Til labels
- `src/app/(app)/reports/components/OeeTrendChart.tsx` — 'use client', Recharts LineChart, OEE % per shift, Y 0–100%
- `src/app/(app)/reports/components/ParetoChart.tsx` — 'use client', Recharts ComposedChart, dual YAxis, rotated XAxis labels, Tooltip shows minutes+incidentCount
- `src/app/(app)/reports/components/BalesPerDayChart.tsx` — 'use client', Recharts stacked BarChart, stackId="a", FRACTION_COLORS map
- `src/app/api/reports/export/route.ts` — Route handler: decrypt auth, operator 403, semicolon+BOM CSV, Norwegian header
- `scripts/e2e-phase4-analysis.sh` — 15 E2E assertions, BASE env override

## Decisions Made

- **Pareto enrichment in page, not DAL**: `enrichPareto()` in page.tsx keeps the DAL accessor (`getParetoData`) returning raw totals only — pure and reusable without the JS sort/cumPct logic baked in.
- **Wide-format pivot in page**: `pivotBalesPerDay()` transforms long-format BalesPerDayRow[] into Recharts-compatible `Record<string, number | string>[]` inside the server component, not the DAL, preserving the DAL's separation of concerns.
- **CSV route uses `decrypt()` directly**: `verifySession()` redirects on failure which is wrong for an API endpoint. Direct decrypt + null check returns clean 401/403 for unauthenticated/unauthorized API callers.
- **E2E `BASE` env var**: `BASE=${BASE:-http://localhost:3000}` lets parallel test runs use different ports without script modification.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Added BASE env var override to E2E script**

- **Found during:** Task 3 (E2E script creation and test run)
- **Issue:** Script hardcoded `BASE=http://localhost:3000`, preventing parallel testing on alternate ports. A parallel agent runs plan 04-02 which may also start a dev server on 3000.
- **Fix:** Changed to `BASE=${BASE:-http://localhost:3000}` for env var override.
- **Files modified:** `scripts/e2e-phase4-analysis.sh`
- **Verification:** E2E passed 15/15 on port 3005 with `BASE=http://localhost:3005`
- **Committed in:** `a559d8d` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical — parallel testing support)
**Impact on plan:** Required to avoid port collision with parallel agent. No scope creep.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All three Phase 4 plans complete: DAL accessors (04-01), shift reports pages (04-02), and analysis page + CSV export (04-03)
- `/reports` analysis page accessible to produksjonsleder/admin/system_admin; operators redirected to `/reports/shifts`
- CSV export available at `/api/reports/export?from=YYYY-MM-DD&to=YYYY-MM-DD`
- Phase 4 complete — ready for Phase 5 (Admin & Plant Setup)

---
*Phase: 04-shift-reports-analysis*
*Completed: 2026-06-11*

---
phase: 06-calibration-branding-inventory
plan: 01
subsystem: simulator
tags: [simulator, calibration, oee, recharts, sqlite]

# Dependency graph
requires:
  - phase: 02-simulator-ingest
    provides: Engine, params, bale rates, verify-backfill
  - phase: 03-live-dashboard
    provides: CurrentDrawChart, NOMINAL_BALES_PER_SHIFT in dal.ts
provides:
  - Calibrated simulator: bunker 10-15 A loaded / 4-6 A empty
  - BALE_RATES_PER_SHIFT {deink:40, occ:8, tetra:6, miks:26} = 80/shift
  - NOMINAL_BALES_PER_SHIFT = 80 (no OEE depression)
  - Chart Y-axis 0-20 A with 8 A threshold line
  - verify-backfill.sh 7/7 passing (tenant-scoped assertions)
affects: [demo-reset, sales-demo, e2e-tests]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "All simulator constants sourced from params.ts (no hardcoded numbers in engine.ts)"
    - "verify-backfill assertions scoped to tenant_id via slug lookup to exclude tenant 2 static data"

key-files:
  created: []
  modified:
    - src/lib/simulator/params.ts
    - src/lib/simulator/engine.ts
    - src/lib/simulator/engine.test.ts
    - src/lib/dal.ts
    - src/db/seed.ts
    - src/app/(app)/dashboard/components/CurrentDrawChart.tsx
    - scripts/verify-backfill.sh

key-decisions:
  - "BALE_RATES_PER_SHIFT total 80 matches NOMINAL_BALES_PER_SHIFT = 80 — OEE performance not depressed"
  - "verify-backfill assertions 1-7 scoped to steco-demo tenant to fix pre-existing cross-tenant counting bug"
  - "Chart Y-axis 0-20 A (was 0-60) makes low 4-15 A bands readable; 8 A threshold preserved"

patterns-established:
  - "Simulator params.ts is single source of truth: engine.ts must import all tuning constants"

# Metrics
duration: 6min
completed: 2026-06-11
---

# Phase 6 Plan 01: Calibration Summary

**Recalibrated simulator to real plant: 11 kW bunker draws 10-15 A loaded / 4-6 A empty, 80 bales/8h-shift (deink 40/occ 8/tetra 6/miks 26), OEE nominal aligned at 80, verify-backfill 7/7**

## Performance

- **Duration:** 6 min
- **Started:** 2026-06-11T14:29:57Z
- **Completed:** 2026-06-11T14:35:52Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- Bunker current bands corrected to 10-15 A loaded / 4-6 A empty (was 35-50 / 5-8); engine reads from params constants (no hardcoded numbers)
- BALE_RATES_PER_SHIFT set to {deink:40, occ:8, tetra:6, miks:26} = 80/shift; NOMINAL_BALES_PER_SHIFT = 80 so OEE performance factor is not depressed
- Two new vitest tests: CURRENT_BANDS (bunker readings only 0/4-6/10-15 A) and BALE_MIX (deink dominant, 60-95 total); all 45 tests green
- verify-backfill.sh extended to 7 assertions (bale volume 1400-2200 over ~14 days); all 7 pass
- Chart Y-axis narrowed to 0-20 A so the new low current bands are readable; 8 A "Bunker tom" threshold preserved

## Task Commits

Each task was committed atomically:

1. **Task 1: Recalibrate params + engine** - `8c295e6` (feat)
2. **Task 2: Update engine tests + NOMINAL_BALES_PER_SHIFT + verify-backfill** - `ef5aeb5` (feat)
3. **Task 3: Calibrate seed nominals + chart axis** - `c28156e` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `src/lib/simulator/params.ts` - Updated CURRENT_BUNKER bands (10-15/4-6 A) and BALE_RATES_PER_SHIFT ({deink:40,occ:8,tetra:6,miks:26})
- `src/lib/simulator/engine.ts` - Imports BALE_RATES_PER_SHIFT + CURRENT_BUNKER_EMPTY_MIN/MAX; no hardcoded rates/current remain
- `src/lib/simulator/engine.test.ts` - Added CURRENT_BANDS and BALE_MIX test blocks
- `src/lib/dal.ts` - NOMINAL_BALES_PER_SHIFT 120 → 80
- `src/db/seed.ts` - plant1 nominalCapacityTph 12 → 10; Doseringsbunker nominalCurrentA 45 → 15
- `src/app/(app)/dashboard/components/CurrentDrawChart.tsx` - YAxis domain [0,60] → [0,20]
- `scripts/verify-backfill.sh` - Added ASSERT7 (bale volume); scoped all 7 assertions to tenant_id for tenant 1 (steco-demo)

## Decisions Made

- NOMINAL_BALES_PER_SHIFT kept local in dal.ts (not imported from params.ts) per Phase 2 decision — value updated to 80 to match new rates
- Chart Y-axis 0-20 A chosen (not 0-15) to give headroom above the 10-15 A loaded band
- verify-backfill assertions 1-3 were pre-existing failures due to Phase 5 tenant 2 static data; fixed by scoping all queries to steco-demo tenant via slug lookup

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed pre-existing verify-backfill assertion failures on ASSERT1-3**

- **Found during:** Task 2 (verify-backfill.sh run)
- **Issue:** ASSERT1 (shift count), ASSERT2 (machine coverage), ASSERT3 (fraction coverage) were comparing DB-wide totals that included tenant 2 static bale/machine/shift data added in Phase 5. Before our changes: 3/6 passed. Plan required 7/7.
- **Fix:** Resolved tenant 1 id via `SELECT id FROM tenants WHERE slug = 'steco-demo'`; added `WHERE tenant_id = ?` to all 7 assertions
- **Files modified:** scripts/verify-backfill.sh
- **Verification:** 7/7 assertions pass
- **Committed in:** ef5aeb5 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 pre-existing bug)
**Impact on plan:** Essential for verify-backfill to actually test tenant 1 simulator data. No scope creep.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Calibration complete; simulator produces realistic plant numbers for sales demo
- verify-backfill.sh now has 7 assertions all scoped to tenant 1
- Ready for 06-02 (branding) and subsequent plans in phase 06

---
*Phase: 06-calibration-branding-inventory*
*Completed: 2026-06-11*

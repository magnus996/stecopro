---
phase: 05-administration-demo-polish
plan: 01
subsystem: database
tags: [sqlite, drizzle-orm, seed, multi-tenant, better-sqlite3]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: tenant/user/plant/fraction/machine schema and seed structure
  - phase: 02-simulator-ingest
    provides: scripts/simulate.ts backfill runner used in demo:setup chain
provides:
  - Tenant 2 (Isolasjonstest) has plant + 2 fractions + 1 machine + 1 week static data
  - demo:setup npm script rebuilds full demo from scratch in one command
  - Tenant-scoped simulator cleanup (does not wipe other tenants' data)
affects:
  - 05-02-PLAN.md (admin DAL/pages use tenant 2 to prove isolation in UI)
  - 05-03-PLAN.md and later (walkthrough guide assumes both tenants populated)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Static seed pattern: historical tenant data seeded directly in seed.ts (not via simulator)"
    - "Tenant-scoped simulator cleanup: delete events WHERE tenant_id = X, not full table wipe"

key-files:
  created: []
  modified:
    - src/db/seed.ts
    - package.json
    - scripts/simulate.ts

key-decisions:
  - "Tenant 2 static data seeded in seed.ts, not via simulator — simulator uses plantRows[0] and only supports one plant"
  - "demo:setup is an alias for db:seed && db:simulate (keeps db:reset for backward compat)"
  - "Simulator cleanup scoped to tenantId to avoid wiping tenant 2 static rows on every db:simulate run"

patterns-established:
  - "Static seed data for secondary tenants: 7-day loop using getShiftBoundsUtc, deterministic offsets, no random state"
  - "When simulator's global-delete pattern would break multi-tenant seeds, scope deletes with WHERE tenantId = ?"

# Metrics
duration: 4min
completed: 2026-06-11
---

# Phase 5 Plan 01: Demo Seed Polish Summary

**Tenant 2 (Isolasjonstest) gets a real plant with 1 week of static data and demo:setup becomes the single-command demo reset**

## Performance

- **Duration:** 4 min
- **Started:** 2026-06-11T09:05:20Z
- **Completed:** 2026-06-11T09:08:56Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Tenant 2 now has Test Linje 1 (nominalCapacityTph 8), 2 fractions, 1 bunker machine, 14 shifts, 84 bales, 20 stops, 112 readings — dashboard shows real different data, isolation is visually provable
- demo:setup npm script added as the salesperson-facing one-command reset
- Fixed simulator to scope its event-table cleanup to the simulated tenant only, so tenant 2 static data survives db:simulate

## Task Commits

Each task was committed atomically:

1. **Task 1: Seed tenant 2 with plant, fractions, machine, and 1-week static history** - `408b227` (feat)
2. **Task 2: Add demo:setup script and fix simulator tenant-scoped deletes** - `9fb903e` (feat + Rule 1 bug fix)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `src/db/seed.ts` - Added tenant 2 plant/fractions/machine + 7-day static shift/bale/stop/reading loop using getShiftBoundsUtc; extended summary counts log
- `package.json` - Added demo:setup script (alias for db:seed && db:simulate)
- `scripts/simulate.ts` - Scoped 4 event-table DELETE statements to simulated tenantId (was deleting all tenants' rows)

## Decisions Made

- Tenant 2 data is seeded statically (not via simulator). The simulator targets `plantRows[0]` and would require structural changes to support multi-plant; static seeding in seed.ts is simpler and sufficient to prove isolation visually.
- `demo:setup` kept as a separate script from `db:reset` — both are equivalent, but `demo:setup` is the user-facing name documented in the demo walkthrough.
- Simulator cleanup scoped to `tenantId` (Rule 1 bug fix): the original global delete would silently wipe tenant 2's data every time `db:simulate` ran, making `demo:setup` non-idempotent for tenant 2.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Simulator wiped all tenants' event data on cleanup**

- **Found during:** Task 2 verify (`npm run demo:setup` followed by assertion)
- **Issue:** `scripts/simulate.ts` lines 128-132 executed `db.delete(schema.shifts).run()` etc. without a WHERE clause — deleting ALL rows from all tenants, not just the tenant being simulated. Tenant 2's 14 static shifts from the seed step were deleted immediately by the subsequent simulate step.
- **Fix:** Changed the 4 DELETE statements to use `.where(eq(schema.tableX.tenantId, tenantId))` — scoped to the discovered tenantId for the simulated plant.
- **Files modified:** `scripts/simulate.ts`
- **Verification:** `npm run demo:setup` now shows 41 total shifts (27 tenant 1 + 14 tenant 2); assertion `isolasjonstest.shifts >= 1` passes.
- **Committed in:** `9fb903e` (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - bug)
**Impact on plan:** Essential fix — without it, demo:setup would always end with tenant 2 having 0 shifts (isolation proof broken). No scope creep.

## Issues Encountered

The test DB approach in Task 1 verify failed on a fresh file (no schema tables). Resolved by copying the existing DB with its schema before running the seed test. The test DB was cleaned up as specified.

## User Setup Required

None - no external service configuration required. Run `npm run demo:setup` to rebuild the demo.

## Next Phase Readiness

- Tenant 2 (Isolasjonstest) has a fully populated dashboard — isolation is now visually provable
- `demo:setup` is the canonical one-command demo reset
- Tenant 1 (Steco Demo) data is unaffected (27 shifts from backfill, same as before)
- Ready for Phase 5 plans 02+ (admin CRUD pages, navigation, walkthrough guide)

---
*Phase: 05-administration-demo-polish*
*Completed: 2026-06-11*

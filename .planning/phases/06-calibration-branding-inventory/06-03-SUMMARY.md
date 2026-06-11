---
phase: 06-calibration-branding-inventory
plan: 03
subsystem: database
tags: [sqlite, drizzle, inventory, shipments, bale-tracking, server-actions, zod]

# Dependency graph
requires:
  - phase: 06-01
    provides: calibrated simulator with realistic bale production numbers (2120 bales/14d)
  - phase: 02
    provides: bale_events table, fractions table, ingest adapter pattern
provides:
  - bale_shipments schema table with tenant/plant/fraction FKs
  - getStockByFraction DAL accessor (produced - shipped per fraction, never negative)
  - getShipmentHistory DAL accessor (latest shipments with fraction name)
  - registerShipment server action with zod validation + stock cap
  - seed-shipments.ts idempotent post-simulate seeder (~5% stock remaining)
  - demo:setup/db:reset chains updated to seed → simulate → seed-shipments
affects: [06-04, inventory UI pages, any page showing bale stock]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "seed-shipments uses raw better-sqlite3 prepared statements (no @/db/index) — same standalone pattern as simulate.ts"
    - "column name discovery: Drizzle integer({ mode: 'timestamp' }) without explicit name → camelCase in SQLite"
    - "Stock computation: two separate queries (produced via LEFT JOIN, shipped via GROUP BY) then merged in JS"

key-files:
  created:
    - src/actions/inventory.ts
    - scripts/seed-shipments.ts
  modified:
    - src/db/schema.ts
    - src/lib/dal.ts
    - package.json

key-decisions:
  - "shippedAt column is camelCase in SQLite (no explicit column name in schema definition) — raw SQL must quote it"
  - "seed-shipments ships 95% of produced bales leaving ~5% stock (tens) — matches demo target"
  - "Stock query uses two separate queries merged in JS (same anti-cartesian-product pattern as report queries)"

patterns-established:
  - "Inventory pattern: stock = COUNT(bale_events) - SUM(baleShipments.baleCount) per fraction, never below 0"
  - "Demo seeder pattern: idempotent DELETE this-tenant first, then reinsert based on ACTUAL produced counts"

# Metrics
duration: 4min
completed: 2026-06-11
---

# Phase 6 Plan 03: Bale Inventory Backend Summary

**Tenant-scoped bale_shipments table, stock DAL accessors (produced - shipped), validated registerShipment action, and post-simulate seeder leaving ~5% stock (8-53 bales) after demo:setup**

## Performance

- **Duration:** 4 min
- **Started:** 2026-06-11T14:38:11Z
- **Completed:** 2026-06-11T14:42:xx Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments
- bale_shipments table deployed to SQLite with all required FKs and indexes
- getStockByFraction returns {produced, shipped, stock} per fraction with LEFT JOIN so zero-bale fractions still appear
- registerShipment rejects over-stock and non-positive counts, inserts tenant-scoped rows
- demo:setup now ends with realistic per-fraction stock: Deink=53, Tetra=8, OCC=11, Miks=32

## Task Commits

Each task was committed atomically:

1. **Task 1: bale_shipments schema + drizzle push** - `e874abd` (feat)
2. **Task 2: Stock + history DAL accessors and registerShipment action** - `d4c8253` (feat)
3. **Task 3: seed-shipments script + demo:setup wiring** - `900dc42` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `src/db/schema.ts` - baleShipments table definition with tenant/plant/fraction FKs
- `src/lib/dal.ts` - added baleShipments import; getStockByFraction + getShipmentHistory accessors
- `src/actions/inventory.ts` - registerShipment server action (zod + stock guard + tenant-scoped insert)
- `scripts/seed-shipments.ts` - idempotent post-simulate shipment seeder
- `package.json` - seed-shipments script; demo:setup and db:reset updated

## Decisions Made
- Drizzle `integer({ mode: 'timestamp' })` without an explicit column name results in camelCase column names in SQLite (`shippedAt`, `createdAt`) — raw better-sqlite3 queries in seed-shipments.ts must quote these (Rule 1 auto-fix applied during Task 3).
- Stock computation uses two separate SELECT queries merged in JS (avoids cartesian product from a single LEFT JOIN, consistent with the established report query pattern).
- 95% shipment rate chosen so the demo shows believable small positive counts (8-53 bales) rather than 0 or thousands.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed column name mismatch in seed-shipments INSERT**
- **Found during:** Task 3 (first demo:setup run)
- **Issue:** Schema definition uses `shippedAt: integer({ mode: 'timestamp' })` without an explicit column name argument, so Drizzle writes the column as `shippedAt` (camelCase) in SQLite. The INSERT used `shipped_at` (snake_case) which SQLite rejected.
- **Fix:** Updated INSERT column list to `"shippedAt"` and `"createdAt"` (quoted to handle camelCase)
- **Files modified:** scripts/seed-shipments.ts
- **Verification:** demo:setup ran cleanly, stock summary printed correctly
- **Committed in:** 900dc42 (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Minor column name correction. No scope creep.

## Issues Encountered
None beyond the column name deviation above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Schema, DAL, and action are complete; ready for Phase 6 plan 04 (inventory UI pages)
- getStockByFraction and getShipmentHistory provide the data shape the UI will consume
- registerShipment action is ready to wire to a form
- demo:setup produces realistic stock numbers for any salesperson demo

---
*Phase: 06-calibration-branding-inventory*
*Completed: 2026-06-11*

---
phase: 06-calibration-branding-inventory
plan: 04
subsystem: ui
tags: [nextjs, react, recharts, server-actions, useActionState, inventory, dashboard]

# Dependency graph
requires:
  - phase: 06-03
    provides: getStockByFraction, getShipmentHistory, registerShipment action, baleShipments schema
  - phase: 06-01
    provides: dashboard layout with existing widget grid and CurrentDrawChart
  - phase: 03
    provides: dashboard page structure, getBaleCountsByFraction, DashboardData

provides:
  - /inventory route: stock table, ShipmentForm client component, shipment history
  - ShipmentForm.tsx: useActionState(registerShipment), fraction select with on-hand hint, error/success rendering
  - LagerstatusCard.tsx: server card widget showing current stock per fraction
  - ProduksjonIDagChart.tsx: Recharts BarChart of today's bales per fraction
  - Lager nav item in nav.ts visible to all four roles
  - e2e-phase6.sh: 11 assertions covering inventory page, dashboard widgets, nav link, stock round-trip
  - Bug fix: seed.ts cleanup order now includes baleShipments before fractions/plants/tenants

affects:
  - future phases referencing inventory UI or dashboard layout

# Tech tracking
tech-stack:
  added: []
  patterns:
    - useActionState(serverAction, undefined) pattern for client forms posting to server actions
    - Recharts BarChart in ResponsiveContainer with isAnimationActive=false for polling-safe charts
    - Inline tsx E2E stock round-trip: insert test row, assert stock calculation, cleanup by id

key-files:
  created:
    - src/app/(app)/inventory/page.tsx
    - src/app/(app)/inventory/ShipmentForm.tsx
    - src/app/(app)/dashboard/components/LagerstatusCard.tsx
    - src/app/(app)/dashboard/components/ProduksjonIDagChart.tsx
    - scripts/e2e-phase6.sh
  modified:
    - src/lib/nav.ts
    - src/app/(app)/dashboard/page.tsx
    - src/db/seed.ts

key-decisions:
  - "Fraction select label shows on-hand stock: '{f.name} ({f.stock} på lager)' for UX clarity"
  - "shippedAt dates serialised to strings in server page before passing to markup (same pattern as dashboard)"
  - "ProduksjonIDagChart reuses todayBales already computed on dashboard page — no extra DAL query"
  - "LagerstatusCard added to 2-column grid; ProduksjonIDagChart in full-width section above current-draw chart"
  - "seed.ts baleShipments delete added before fractions/plants/tenants (bug fix — FK constraint failure)"

patterns-established:
  - "ShipmentForm mirrors LoginForm: useActionState, isPending disabled button, field error rendering, success banner"
  - "E2E stock round-trip: inline tsx computes produced-shipped, inserts 1-bale shipment, verifies stock drop, deletes by id"

# Metrics
duration: 6min
completed: 2026-06-11
---

# Phase 06 Plan 04: Inventory UI + Dashboard Widgets Summary

**Inventory Lager page (stock table, ShipmentForm, shipment history), plus LagerstatusCard and Recharts ProduksjonIDagChart on the dashboard; all roles see Lager nav item; e2e-phase6.sh passes 11/11**

## Performance

- **Duration:** ~6 min
- **Started:** 2026-06-11T14:44:29Z
- **Completed:** 2026-06-11T14:50:17Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments
- Built full /inventory route: stock-per-fraction table, ShipmentForm client component with useActionState wiring to registerShipment, and shipment history table with Oslo-formatted timestamps
- Added Lager nav item to nav.ts for all four roles and two dashboard widgets (LagerstatusCard server card + ProduksjonIDagChart Recharts BarChart)
- E2E script validates inventory page content, dashboard widgets, nav link, and stock arithmetic round-trip including over-stock guard verification

## Task Commits

1. **Task 1: /inventory page + ShipmentForm + nav item** - `505854f` (feat)
2. **Task 2: Dashboard Lagerstatus widget + Produksjon i dag bar chart** - `1511ae2` (feat)
3. **Task 3: E2E script + seed.ts bug fix** - `3922061` (feat)

## Files Created/Modified
- `src/lib/nav.ts` - Added Lager nav item for all roles
- `src/app/(app)/inventory/page.tsx` - Inventory page: stock table, form, shipment history
- `src/app/(app)/inventory/ShipmentForm.tsx` - Client form with useActionState(registerShipment)
- `src/app/(app)/dashboard/components/LagerstatusCard.tsx` - Stock-per-fraction server widget
- `src/app/(app)/dashboard/components/ProduksjonIDagChart.tsx` - Today's bales BarChart ('use client')
- `src/app/(app)/dashboard/page.tsx` - Added getStockByFraction fetch + both widgets to layout
- `scripts/e2e-phase6.sh` - 11 E2E assertions for phase 6 inventory + dashboard
- `src/db/seed.ts` - Bug fix: added baleShipments delete before fractions/plants/tenants

## Decisions Made
- Fraction select label shows `{f.name} ({f.stock} på lager)` for immediate operator clarity on available stock
- `shippedAt` dates serialised to strings in the server page before passing to markup — consistent with dashboard/page.tsx pattern
- ProduksjonIDagChart reuses `todayBales` already computed by dashboard page (no extra DAL query needed)
- LagerstatusCard inserted into the existing 2-column grid; ProduksjonIDagChart placed as full-width section between grid and current-draw chart

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] seed.ts FK constraint failure on demo:setup re-runs**
- **Found during:** Task 3 (running demo:setup for E2E test)
- **Issue:** seed.ts cleanup sequence deleted `fractions`/`plants`/`tenants` without first deleting `baleShipments` (added in plan 03), causing `SQLITE_CONSTRAINT_FOREIGNKEY` failure
- **Fix:** Added `db.delete(schema.baleShipments).run()` before `db.delete(schema.fractions).run()` in the idempotent cleanup block
- **Files modified:** `src/db/seed.ts`
- **Verification:** `npm run demo:setup` runs cleanly and produces correct stock summary
- **Committed in:** `3922061` (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Essential fix for demo:setup idempotency. No scope creep.

## Issues Encountered
- demo:setup failed on first run due to missing baleShipments in seed cleanup — resolved as Rule 1 bug fix above.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Phase 6 is fully complete: calibration (01), branding (02), inventory backend (03), and inventory UI (04) all done
- All milestone deliverables are in place: OEE dashboard, shift reports, analysis, admin, and inventory
- Technology demo is ready for salesperson use via `npm run demo:setup && npm run dev`

---
*Phase: 06-calibration-branding-inventory*
*Completed: 2026-06-11*

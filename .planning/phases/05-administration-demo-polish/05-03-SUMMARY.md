---
phase: 05-administration-demo-polish
plan: 03
subsystem: ui
tags: [nextjs, server-actions, useActionState, zod, drizzle-orm, tailwind, admin, plant-config]

# Dependency graph
requires:
  - phase: 05-02
    provides: getPlantConfig DAL accessor and PlantConfig type already built in dal.ts
  - phase: 01-foundation
    provides: verifySession, getCurrentUser, session-based auth pattern
provides:
  - src/actions/plant.ts — updatePlantConfig server action (role-gated, tenant-scoped)
  - src/app/(app)/admin/plant/page.tsx — plant config server component page
  - src/app/(app)/admin/plant/PlantConfigForm.tsx — pre-populated useActionState client form
affects:
  - 05-06 (E2E/acceptance tests will exercise /admin/plant)
  - Demo walkthrough: produksjonsleder now has a functioning /admin/plant route

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server action with zod validation + parallel-array form pattern for multi-row edits (fractions/machines)"
    - "useActionState client form with defaultValue pre-population from server config"
    - "Read-only display for system-controlled fields (machine.type, shift times) alongside editable fields"

key-files:
  created:
    - src/actions/plant.ts
    - src/app/(app)/admin/plant/page.tsx
    - src/app/(app)/admin/plant/PlantConfigForm.tsx
  modified: []

key-decisions:
  - "Parallel-array form pattern for fractions/machines (formData.getAll) rather than JSON — consistent with FormData server action approach"
  - "Machine type shown read-only in form table (not an input) to prevent breaking dashboard bunker-type query"
  - "Shift times in separate read-only card below the form with explicit 'fastsatt i systemkonfigurasjon' note"
  - "nominalCapacityTph accepts empty string → null (optional field) via zod preprocess"

patterns-established:
  - "Multi-row form edit: hidden id input + named array inputs (getAll) for each editable column per row"
  - "UpdateState type union: { success: true } | { errors: Record<string, string[]> } | undefined"

# Metrics
duration: 4min
completed: 2026-06-11
---

# Phase 5 Plan 03: Plant Configuration Page Summary

**produksjonsleder-gated /admin/plant page with useActionState form editing nominal capacity, fraction names/order, and machine names/current — all scoped to session.tenantId**

## Performance

- **Duration:** 4 min
- **Started:** 2026-06-11T09:12:02Z
- **Completed:** 2026-06-11T09:16:17Z
- **Tasks:** 2
- **Files modified:** 3 (created)

## Accomplishments

- `updatePlantConfig` server action blocks operators, scopes all UPDATEs to `session.tenantId`, never touches `machine.type` or shift times, revalidates `/admin/plant`
- `/admin/plant` server page gates operators (redirect → /dashboard), fetches `getPlantConfig`, renders pre-populated form and read-only shift times card
- `PlantConfigForm` client form uses `useActionState`, parallel-array pattern for fractions/machines, shows green "Lagret" on success and field errors on failure

## Task Commits

Each task was committed atomically:

1. **Task 1: updatePlantConfig server action** - `85a6ae7` (feat)
2. **Task 2: Plant config page + pre-populated client form** - `045771f` (feat)

**Plan metadata:** (docs commit to follow)

## Files Created/Modified

- `src/actions/plant.ts` — `updatePlantConfig` server action: role gate, zod validation, tenant-scoped plant/fraction/machine UPDATEs, revalidatePath
- `src/app/(app)/admin/plant/page.tsx` — Server Component: role gate, getPlants + getPlantConfig, renders PlantConfigForm + read-only shift times card
- `src/app/(app)/admin/plant/PlantConfigForm.tsx` — `'use client'` form: useActionState(updatePlantConfig), defaultValue pre-population, machine type read-only display

## Decisions Made

- **Parallel-array form pattern for fractions/machines:** `formData.getAll('fractionId')`, `getAll('fractionName')`, `getAll('fractionSortOrder')` as parallel arrays. This is the standard FormData approach for multi-row edits with server actions (no JSON serialization needed).
- **Machine type read-only:** The `type` field is displayed as a `<span>` badge, not an `<input>`. Changing it via UI would break the dashboard's `type === 'bunker'` query for current-draw readings.
- **Shift times separate read-only card:** Shift times (07/15/22) are hardcoded in `src/lib/time.ts`. A dedicated card below the form makes the restriction explicit with the explanation note "fastsatt i systemkonfigurasjon".
- **`nominalCapacityTph` nullable via zod preprocess:** Empty string input → `null` (clears the field). Positive number validation only fires when a value is provided.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- ADMN-01 satisfied: plant configuration (fractions, nominal capacity, machine list) editable in UI, scoped to tenant, gated to produksjonsleder+ in both page and action
- Shift times intentionally read-only with UI explanation
- /admin/plant route is live; nav item (already existed in nav.ts) now resolves to a working page
- Ready for 05-04 (user management) and 05-05 (tenant management) which are executing in parallel

---
*Phase: 05-administration-demo-polish*
*Completed: 2026-06-11*

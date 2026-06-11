---
phase: 05-administration-demo-polish
plan: 05
subsystem: ui
tags: [admin, server-actions, useActionState, multi-tenant, system_admin, zod, drizzle-orm, next-app-router]

# Dependency graph
requires:
  - phase: 05-02
    provides: getTenantList, getTenantById (system_admin DAL accessors with cross-tenant role guards)
  - phase: 01-foundation
    provides: verifySession, SessionPayload, UserRole, tenants/plants schema tables
provides:
  - src/actions/tenants.ts — createTenant + createPlantForTenant server actions (system_admin only)
  - /admin/tenants — tenant list page showing all tenants with user/plant counts
  - /admin/tenants/new — create-tenant form page
  - /admin/tenants/[tenantId] — tenant detail page with plants table + create-plant form
affects:
  - 05-06 (E2E/integration tests for tenant management)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "system_admin gate pattern in server actions: session.role !== 'system_admin' check BEFORE any form data is trusted"
    - "Sole permitted cross-tenant INSERT: createPlantForTenant uses form-supplied tenantId only after role gate"
    - "All admin pages gate with getCurrentUser() + role check + redirect — not relying on proxy sub-role enforcement"

key-files:
  created:
    - src/actions/tenants.ts
    - src/app/(app)/admin/tenants/page.tsx
    - src/app/(app)/admin/tenants/TenantForm.tsx
    - src/app/(app)/admin/tenants/new/page.tsx
    - src/app/(app)/admin/tenants/[tenantId]/page.tsx
    - src/app/(app)/admin/tenants/[tenantId]/PlantForm.tsx
  modified: []

key-decisions:
  - "createPlantForTenant is the only action in the codebase that accepts a form-supplied tenantId for a write — guarded by system_admin role check immediately before the INSERT"
  - "Slug uniqueness handled with a user-friendly pre-check query before INSERT (avoids leaking unique-index error to UI)"
  - "PlantForm embeds tenantId as a hidden input; safe because the server action validates session.role === 'system_admin' before using it"

patterns-established:
  - "Role gate in server action: const session = await verifySession(); if (session.role !== 'system_admin') return { errors: { _: ['Ikke tilgang'] } }"
  - "Admin page gate: const user = await getCurrentUser(); if (!user) return null; if (user.role !== 'system_admin') redirect('/dashboard')"

# Metrics
duration: 5min
completed: 2026-06-11
---

# Phase 5 Plan 05: Tenant Management Summary

**System-admin tenant and plant management UI: createTenant/createPlantForTenant server actions with role-first security, tenant list showing all tenants, create-tenant form, and per-tenant detail page with create-plant form — the sole place in the codebase where a form-supplied tenantId drives a DB write, guarded by a system_admin check.**

## Performance

- **Duration:** 5 min
- **Started:** 2026-06-11T09:12:37Z
- **Completed:** 2026-06-11T09:17:23Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments

- `createTenant` server action: system_admin gate → zod validation → slug uniqueness pre-check → INSERT tenants
- `createPlantForTenant` server action: system_admin gate first → validate form data → verify target tenant exists → INSERT plants with form-supplied tenantId (the only such place in the codebase)
- `/admin/tenants` page: lists both seeded tenants (Steco Demo and Isolasjonstest) with user and plant counts via `getTenantList`; non-system_admin redirected to /dashboard
- `/admin/tenants/new` and `/admin/tenants/[tenantId]` pages: create-tenant and create-plant forms via `useActionState` matching the established LoginForm pattern; all pages enforce system_admin gate server-side

## Task Commits

Each task was committed atomically:

1. **Task 1: tenants server actions (createTenant, createPlantForTenant)** - `c9d776c` (feat)
2. **Task 2: tenant list + new tenant + tenant detail pages** - `094c07d` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `src/actions/tenants.ts` — Two server actions; both gate on `session.role !== 'system_admin'` before any form data is trusted; `createPlantForTenant` is the sole permitted cross-tenant INSERT
- `src/app/(app)/admin/tenants/page.tsx` — Tenant list (all tenants, system_admin only) with name/slug/userCount/plantCount and "Åpne" link per row
- `src/app/(app)/admin/tenants/TenantForm.tsx` — Client form component using `useActionState(createTenant)` with name + slug fields and Norwegian error messages
- `src/app/(app)/admin/tenants/new/page.tsx` — New tenant page wrapping TenantForm; system_admin gate
- `src/app/(app)/admin/tenants/[tenantId]/page.tsx` — Tenant detail page: plants table + PlantForm; system_admin gate; renders not-found card on missing tenant
- `src/app/(app)/admin/tenants/[tenantId]/PlantForm.tsx` — Client form using `useActionState(createPlantForTenant)` with hidden tenantId + name/description/nominalCapacityTph fields

## Decisions Made

- `createPlantForTenant` uses form-supplied `tenantId` for the INSERT — this is explicitly permitted and the only such exception in the codebase. The system_admin role gate executes before the tenantId is read, making it the security boundary (RESEARCH Pattern 2 / Pitfall 1).
- Slug uniqueness is checked with a pre-query SELECT rather than relying on the SQLite unique index exception — avoids surfacing a raw DB error in the UI.
- All three page routes gate with `getCurrentUser()` + explicit `user.role !== 'system_admin'` check rather than relying on the middleware/proxy, which only enforces `/admin` prefix access (RESEARCH Pitfall 3).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- TENA-05 + ADMN-03 fully satisfied: system admin can list all tenants, create new tenants, view tenant details with plant list, and create plants for any tenant
- The only form-supplied tenantId is gated by `session.role !== 'system_admin'` in the action — security invariant maintained
- Lower roles (admin/produksjonsleder/operator) are blocked at both the page level (getCurrentUser role check) and the action level (verifySession role check)
- `npx tsc --noEmit` passes for the full project
- Ready for 05-06 (E2E verification / demo walkthrough)

---
*Phase: 05-administration-demo-polish*
*Completed: 2026-06-11*

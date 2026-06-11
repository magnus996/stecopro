---
phase: 05-administration-demo-polish
plan: 02
subsystem: api
tags: [dal, drizzle-orm, multi-tenant, system_admin, rbac, typescript]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: verifySession, SessionPayload, UserRole, db schema (users/tenants/plants/fractions/machines)
  - phase: 03-live-dashboard
    provides: existing DAL accessor patterns (cache, verifySession, tenant scoping)
provides:
  - getUsersForTenant — tenant-scoped user list for /admin/users
  - getUserById — single-user fetch scoped to session.tenantId for /admin/users/[id]
  - getPlantConfig — plant + fractions + machines config for /admin/plant
  - getTenantList — cross-tenant list with counts for /admin/tenants (system_admin)
  - getTenantById — single-tenant + its plants for /admin/tenants/[id] (system_admin)
  - getSystemAdminPlants — all plants with tenant names for system_admin overview
affects:
  - 05-03 (admin users UI)
  - 05-04 (admin tenants UI)
  - 05-05 (admin plant config UI)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "system_admin cross-tenant DAL bypass: role guard before query, tenantId param as lookup key only"
    - "Admin accessor pattern: cache(async () => { verifySession(); role check; scoped query })"

key-files:
  created: []
  modified:
    - src/lib/dal.ts

key-decisions:
  - "getUsersForTenant scoped to session.tenantId even for system_admin — system_admin manages Steco's own tenant on /admin/users, cross-tenant user mgmt is out of scope"
  - "system_admin accessors guard role before bypassing tenant filter — role check IS the security boundary"
  - "UserRole type imported from @/db/schema for type-safe role comparisons in includes() checks"
  - "getPlantConfig fetches fractions and machines in parallel (Promise.all) — two separate queries, no cartesian join"

patterns-established:
  - "system_admin bypass pattern: if (session.role !== 'system_admin') throw new Error('Forbidden') then query without tenantId filter"
  - "Tenant-scoped admin reads: role gate + eq(<table>.tenantId, session.tenantId) in every WHERE"

# Metrics
duration: 2min
completed: 2026-06-11
---

# Phase 5 Plan 02: Admin DAL Accessors Summary

**Six read-side DAL accessors for Phase 5 admin UIs: tenant-scoped user/plant-config reads (admin+/produksjonsleder+) and system_admin cross-tenant tenant/plant reads with hard role guards before bypassing the tenant filter.**

## Performance

- **Duration:** 2 min
- **Started:** 2026-06-11T09:05:28Z
- **Completed:** 2026-06-11T09:07:45Z
- **Tasks:** 2 (committed together — both target same file section)
- **Files modified:** 1

## Accomplishments

- Added tenant-scoped `getUsersForTenant`, `getUserById`, `getPlantConfig` with proper role gates (admin+/produksjonsleder+) and `eq(<table>.tenantId, session.tenantId)` in every WHERE clause
- Added system_admin-only cross-tenant `getTenantList`, `getTenantById`, `getSystemAdminPlants` — each guards `session.role !== 'system_admin'` before executing queries with no tenant filter
- Updated dal.ts header comment to document the controlled system_admin bypass exception; all six interfaces exported alongside the accessors

## Task Commits

Both tasks were implemented in a single atomic commit (both target the same "Admin accessors — Phase 5" section appended to dal.ts):

1. **Task 1: Tenant-scoped admin read accessors** - `ad410b8` (feat)
2. **Task 2: System-admin cross-tenant read accessors** - `ad410b8` (feat, same commit)

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `src/lib/dal.ts` — Added 292 lines: AdminUserRow, getUsersForTenant, getUserById, PlantConfig, getPlantConfig (tenant-scoped); TenantListRow, getTenantList, getTenantById, SystemAdminPlantRow, getSystemAdminPlants (system_admin cross-tenant). Updated file header comment and added UserRole import.

## Decisions Made

- `getUsersForTenant` intentionally scoped to `session.tenantId` even when called as `system_admin` — the `/admin/users` page manages the system_admin's own tenant (Steco). Cross-tenant user management is explicitly out of scope per RESEARCH.
- `getTenantById` accepts a `tenantId` parameter as a lookup key; the `system_admin` role check at the top is the security boundary (not the parameter).
- Used `Promise.all` in `getPlantConfig` for fractions+machines to avoid sequential waits — these are independent queries.
- Imported `UserRole` type from `@/db/schema` directly for type-safe `includes()` checks instead of casting.

## Deviations from Plan

None - plan executed exactly as written. Both tasks were combined into one commit since they both append to the same delimited section of dal.ts and were implemented together.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All six read-side DAL accessors are in place; plans 03/04/05 can now build their UIs against these accessors in parallel without colliding on dal.ts
- `npx tsc --noEmit` passes for the full project
- No schema changes were made — all required columns already existed

---
*Phase: 05-administration-demo-polish*
*Completed: 2026-06-11*

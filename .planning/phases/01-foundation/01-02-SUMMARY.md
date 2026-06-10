---
phase: 01-foundation
plan: 02
subsystem: database
tags: [drizzle-orm, sqlite, drizzle-kit, bcryptjs, tsx, schema, multi-tenant, seed]

# Dependency graph
requires:
  - phase: 01-01
    provides: Drizzle db singleton (src/db/index.ts), drizzle-kit config, all Phase 1 deps installed

provides:
  - Full SIMU-01 schema: 9 tenant-scoped tables in src/db/schema.ts applied to stecopro.db
  - UserRole TypeScript union export for session/DAL reuse
  - db:push / db:seed / db:studio npm scripts
  - Demo seed: 2 tenants, 5 users (all 4 roles), 1 returpapir plant, 4 fractions, 3 machines
  - All demo passwords bcrypt-hashed ('demo123'); seed is idempotent

affects:
  - 01-03 (DAL — imports tables from schema.ts, verifySession uses UserRole)
  - 01-04 (auth actions — users table lookup by email, passwordHash comparison)
  - Phase 2 simulator (writes into baleEvents, stopEvents, timeSeriesReadings via same tables)
  - Phase 4 OEE (reads from shifts, stopEvents, baleEvents, timeSeriesReadings)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "All 9 SIMU-01 tables carry NOT NULL tenantId FK — enforced at schema level, DAL enforces in queries"
    - "integer({mode:'timestamp'}) and integer({mode:'boolean'}) for SQLite/Postgres portability"
    - "Composite indexes (plantId+time) on event/reading tables for efficient time-range queries"
    - "Seed clears tables in FK-safe leaf-to-root order before inserting — guarantees clean known state"
    - "Seed uses direct Database() connection (not server-only singleton) to run outside Next.js context"

key-files:
  created:
    - src/db/schema.ts
    - src/db/seed.ts
  modified:
    - package.json

key-decisions:
  - "system_admin user seeded with tenantId=1 for Phase 1; Phase 5 adds proper cross-tenant management"
  - "drizzle-kit push used for Phase 1 dev iteration (no migration files); switch to generate before production"
  - "Seed uses direct better-sqlite3 Database() rather than the server-only singleton to run via tsx outside Next.js"
  - "Single bcrypt hash computed once and shared across all demo users (same password, same hash cost)"

patterns-established:
  - "Every entity table has NOT NULL tenantId: never add a table without it"
  - "Seed idempotency pattern: delete leaf-to-root, then insert — no upsert complexity"
  - "DB_FILE_NAME env var controls db path in both drizzle.config.ts and seed.ts"

# Metrics
duration: 5min
completed: 2026-06-11
---

# Phase 1 Plan 02: Schema and Seed Summary

**Drizzle SQLite schema with 9 tenant-scoped tables (SIMU-01) applied via drizzle-kit push, plus an idempotent demo seed creating 2 tenants, 4 roles, returpapir plant with fractions and machines**

## Performance

- **Duration:** 5 min
- **Started:** 2026-06-10T22:44:19Z
- **Completed:** 2026-06-10T22:49:00Z
- **Tasks:** 3
- **Files modified:** 3

## Accomplishments

- Complete SIMU-01 data model in `src/db/schema.ts`: 9 tables, all entity tables carrying NOT NULL `tenantId` FK, integer timestamp/boolean modes, composite indexes on time-range columns
- Schema applied to `stecopro.db` via `drizzle-kit push` — all 9 tables verified in sqlite_master
- Idempotent demo seed: 2 tenants (Steco Demo + Isolasjonstest), 5 users across all 4 roles, 1 returpapir plant, 4 fractions, 3 machines; all passwords bcrypt-verified; re-run yields same counts

## Task Commits

Each task was committed atomically:

1. **Task 1: Define full tenant-scoped schema** - `57be992` (feat)
2. **Task 2: Apply schema to db and add db scripts** - `cc13c19` (feat)
3. **Task 3: Write and run the demo seed** - `b64bb59` (feat)

**Plan metadata:** _(docs commit follows)_

## Files Created/Modified

- `src/db/schema.ts` — All 9 SIMU-01 tables with tenant scoping, timestamp/boolean integer modes, indexes, UserRole export (144 lines)
- `src/db/seed.ts` — Idempotent demo seed; clears tables FK-safe then inserts 2 tenants, 5 users, 1 plant, 4 fractions, 3 machines; exits cleanly with process.exit(0)
- `package.json` — Added db:push, db:seed, db:studio scripts

## Decisions Made

- **system_admin in tenant 1 for Phase 1:** The research Open Question 1 recommends tenantId=NULL or a sentinel. For Phase 1 simplicity, system@steco.no is created in tenant 1. Phase 5 builds real cross-tenant management.
- **drizzle-kit push vs generate:** Using push for Phase 1 dev iteration (no migration files accumulate). Research Open Question 3 explicitly recommends this; switch to generate before any multi-person or production deployment.
- **Direct Database() in seed:** The `src/db/index.ts` singleton is marked `server-only` and requires Next.js context. The seed creates its own `Database()` connection so it can run via `tsx` outside Next.js. Both connections point to the same `DB_FILE_NAME`.
- **Single shared bcrypt hash:** All demo users share the same `demo123` password, so computing one `bcrypt.hash()` and reusing it is safe and cuts seed time.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All 9 SIMU-01 tables exist in `stecopro.db` — Phase 2 simulator can immediately write to baleEvents, stopEvents, timeSeriesReadings
- Demo users exist for all 4 roles with working bcrypt passwords — Plan 03 (auth) can build login against real DB rows
- `UserRole` TypeScript union exported from schema.ts — Plan 03 session/DAL can import it directly
- Two tenants seeded — tenant isolation tests in Plan 03 and Phase 2 are unblocked
- No blockers for Plan 03

---
*Phase: 01-foundation*
*Completed: 2026-06-11*

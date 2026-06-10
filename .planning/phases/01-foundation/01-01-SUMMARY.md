---
phase: 01-foundation
plan: 01
subsystem: database
tags: [drizzle-orm, better-sqlite3, sqlite, drizzle-kit, jose, bcryptjs, zod, npm-cache]

# Dependency graph
requires: []
provides:
  - Drizzle db singleton over better-sqlite3 (HMR-safe via globalForDb)
  - drizzle-kit configured and pointing at src/db/schema.ts
  - All Phase 1 npm dependencies installed via project-local cache
  - Environment variable setup with real SESSION_SECRET
  - Git ignore rules protecting secrets, db files, and npm cache
affects:
  - 01-02 (schema — imports db singleton, drizzle-kit migrate runs against config)
  - 01-03 (sessions — jose available, SESSION_SECRET in env)
  - 01-04 (seed — tsx available, db connection works, schema in place)

# Tech tracking
tech-stack:
  added:
    - drizzle-orm@0.45.2
    - better-sqlite3@12.10.0
    - drizzle-kit@0.31.10
    - jose@6.2.3
    - bcryptjs@3.0.3
    - zod@4.4.3
    - server-only
    - "@types/better-sqlite3"
    - dotenv
    - tsx
  patterns:
    - "globalForDb singleton pattern for HMR-safe SQLite connection"
    - "Project-local npm cache (.npm-cache/) to avoid global EACCES issues"
    - "DB_FILE_NAME env var for db path; falls back to ./stecopro.db"

key-files:
  created:
    - src/db/index.ts
    - drizzle.config.ts
    - .env.local
    - .env.example
  modified:
    - .gitignore
    - package.json
    - package-lock.json

key-decisions:
  - "Used project-local npm cache (--cache .npm-cache) to avoid EACCES on global cache"
  - "HMR-safe globalForDb singleton pattern prevents SQLITE_BUSY on hot reload"
  - "bcryptjs (pure JS) chosen over argon2 (native) — no native build step needed for demo"
  - "tsx installed as dev dep so seed script runs via npx tsx without separate build step"

patterns-established:
  - "npm installs always use --cache .npm-cache in this project"
  - "DB connection always via import { db } from '@/db' — single singleton"
  - "Secrets in .env.local (gitignored), templates in .env.example (committed)"

# Metrics
duration: 3min
completed: 2026-06-10
---

# Phase 1 Plan 01: Foundation — Dependency Install and DB Setup Summary

**Drizzle ORM db singleton over better-sqlite3 with HMR-safe globalForDb pattern, drizzle-kit config, all Phase 1 dependencies installed via project-local npm cache**

## Performance

- **Duration:** 3 min
- **Started:** 2026-06-10T22:38:43Z
- **Completed:** 2026-06-10T22:42:26Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- All Phase 1 npm dependencies installed cleanly using project-local cache (`--cache .npm-cache`), avoiding EACCES permission errors on the global cache
- `src/db/index.ts` provides a single HMR-safe Drizzle db singleton — hot reloads reuse the same connection, preventing SQLITE_BUSY errors
- `drizzle.config.ts` configured with `dialect: 'sqlite'`, pointing at `src/db/schema.ts` and `DB_FILE_NAME` env var
- Environment files and git ignore rules set up: secrets and db files are ignored, `.env.example` template is committable

## Task Commits

Each task was committed atomically:

1. **Task 1: Install dependencies with project-local npm cache** - `d8d6ecc` (chore)
2. **Task 2: Configure env files and git ignores** - `fde7f17` (chore)
3. **Task 3: Create db connection singleton and drizzle config** - `459d73e` (feat)

**Plan metadata:** _(docs commit follows)_

## Files Created/Modified

- `src/db/index.ts` - HMR-safe Drizzle singleton over better-sqlite3; imports schema (Plan 02 will create it)
- `drizzle.config.ts` - drizzle-kit config: sqlite dialect, schema at `src/db/schema.ts`, db at `DB_FILE_NAME`
- `.env.local` - DB_FILE_NAME and real random SESSION_SECRET (gitignored)
- `.env.example` - Template with placeholder values (committed)
- `.gitignore` - Added `.npm-cache/`, `*.db`, `*.db-journal`, `*.db-wal`, `*.db-shm`, `!.env.example`
- `package.json` - Added all Phase 1 runtime and dev dependencies
- `package-lock.json` - Lock file generated

## Decisions Made

- **Project-local npm cache:** Used `--cache .npm-cache` on all installs. Global npm cache has EACCES permission issues in this sandbox. The `.npm-cache/` directory is gitignored.
- **bcryptjs over argon2:** bcryptjs is pure JS (no native build step), sufficient for seeded demo credentials. argon2 requires native bindings and adds unnecessary complexity.
- **tsx as dev dep:** Included so `npx tsx src/db/seed.ts` works in Plan 02 without a separate build step.
- **No stub schema.ts:** Plan 02 owns `src/db/schema.ts`. The expected TypeScript error for the missing `./schema` import is acceptable and documented.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All Phase 1 npm dependencies installed and verified
- `better-sqlite3` native addon builds and loads correctly (`node -e "require('better-sqlite3')"` exits 0)
- db singleton ready for Plan 02 (schema) to complete it — expected TS error on missing `./schema` import resolves when schema.ts is created
- drizzle-kit configured and will be able to push/generate migrations once schema.ts exists
- No blockers for Plan 02

---
*Phase: 01-foundation*
*Completed: 2026-06-10*

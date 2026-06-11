---
phase: 07-pwa-operator
plan: 01
subsystem: database
tags: [drizzle, sqlite, better-sqlite3, pwa, push-notifications, web-push]

# Dependency graph
requires:
  - phase: 06-branding-inventory
    provides: schema.ts base tables (tenants, users, plants, stopEvents, photos chain)
provides:
  - Five tenant-scoped Phase 7 tables in schema.ts (pushSubscriptions, photos, stopAcknowledgements, stopComments, shiftNotes)
  - FK-safe seed deletion order extended for all 5 tables
  - getApiSession() helper — cookie → decrypt → SessionPayload|null (no redirect)
  - /uploads gitignore rule
  - VAPID env placeholders in .env.example
affects:
  - 07-02 (PWA shell — no overlap, parallel wave 1)
  - 07-03 (push pipeline — uses pushSubscriptions table + VAPID env)
  - 07-04 (reporting API — uses photos, stopAcknowledgements, stopComments, shiftNotes + getApiSession)
  - 07-05 (operator UI + E2E — full table access)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "getApiSession() pattern: route handlers use this instead of verifySession() (which redirects) — returns null for 401 handling"
    - "FK declaration order: photos before stopComments/shiftNotes for circular-free reference resolution"

key-files:
  created:
    - src/lib/api-auth.ts
  modified:
    - src/db/schema.ts
    - src/db/seed.ts
    - .gitignore
    - .env.example

key-decisions:
  - "photos table declared before stopComments and shiftNotes (both have optional photoId FK) — order matters for module-eval FK resolution"
  - "getApiSession() is server-only + uses next/headers cookies() — do NOT use in notifier (07-03) which runs outside request context"
  - "stop_acknowledgements unique(stopEventId,userId) enforced at DB level (not Zod) — idempotent ack is a data integrity guarantee"
  - "comment OR correctedReason requirement on stop_comments is Zod-only (07-04), not a DB constraint"
  - "VAPID keys not generated here — 07-03 owns web-push install and key generation"

patterns-established:
  - "getApiSession() pattern: all Phase 7 route handlers use this for auth instead of verifySession()"
  - "Phase 7 tables all follow existing schema.ts convention: int() PK, tenantId NOT NULL FK, integer({mode:'timestamp'}) Unix-seconds createdAt"

# Metrics
duration: 3min
completed: 2026-06-11
---

# Phase 7 Plan 01: PWA Operator Data Foundation Summary

**Five tenant-scoped PWA tables (pushSubscriptions, photos, stopAcknowledgements, stopComments, shiftNotes) added to Drizzle schema with FK-safe seed order, non-redirecting getApiSession() helper, and /uploads+VAPID scaffolding**

## Performance

- **Duration:** 3 min
- **Started:** 2026-06-11T16:17:09Z
- **Completed:** 2026-06-11T16:19:41Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- All 5 Phase 7 tables created in schema.ts following existing patterns (tenantId NOT NULL FK, Unix-seconds timestamps, tenant_idx indexes)
- stop_acknowledgements enforces UNIQUE(stopEventId,userId) at DB level for idempotent ack (REPT-01)
- push_subscriptions enforces UNIQUE(endpoint) to support upsert-on-re-subscribe
- FK-safe seed deletion order extended: stopAcknowledgements → stopComments → shiftNotes → photos → pushSubscriptions before existing list
- db:push and demo:setup green; round-trip smoke test across all 5 tables passed
- getApiSession() created as the non-redirecting auth helper for all Phase 7 route handlers

## Task Commits

Each task was committed atomically:

1. **Task 1: Add five Phase 7 PWA tables to schema** - `2040868` (feat)
2. **Task 2: Extend seed deletion list + db:push** - `d681241` (feat)
3. **Task 3: getApiSession + .gitignore + .env.example** - `cdf5683` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `src/db/schema.ts` — Added pushSubscriptions, photos, stopAcknowledgements, stopComments, shiftNotes tables
- `src/db/seed.ts` — Prepended FK-safe deletion of 5 new tables before existing cleanup block
- `src/lib/api-auth.ts` — New: getApiSession() returning SessionPayload|null, never redirects
- `.gitignore` — Added /uploads rule for operator photo storage directory
- `.env.example` — Added VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT placeholders

## Decisions Made

- **photos declared before stopComments and shiftNotes:** Both reference photos.id; declaration order matters for Drizzle module-eval FK resolution
- **getApiSession() is server-only with next/headers:** Fine for route handlers (request context); notifier in 07-03 must NOT use it (runs outside request context — use db parameter pattern instead)
- **DB-level unique constraint on stop_acknowledgements:** Idempotent ack guarantee belongs at data layer, not application layer
- **VAPID keys deferred to 07-03:** 07-03 owns web-push package install and key generation into .env.local

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required for this plan. (VAPID key generation is documented in .env.example and handled by 07-03.)

## Next Phase Readiness

- 07-02 (PWA shell) runs in parallel — no file overlap confirmed, no dependency on this plan
- 07-03 (push pipeline) can proceed: pushSubscriptions table exists, VAPID env placeholders documented, getApiSession() available
- 07-04 (reporting API) can proceed: all 5 tables exist with correct FK structure, getApiSession() available
- No blockers

---
*Phase: 07-pwa-operator*
*Completed: 2026-06-11*

---
phase: 07-pwa-operator
plan: 04
subsystem: api
tags: [nextjs, drizzle, sqlite, multipart, photo-upload, tenant-isolation, zod, dal]

# Dependency graph
requires:
  - phase: 07-01
    provides: photos, stopAcknowledgements, stopComments, shiftNotes tables + getApiSession()
provides:
  - POST /api/photos: multipart upload (10MB cap, image/* only), writes to ./uploads/{tenantId}/{uuid}.ext
  - GET /api/photos/[id]: tenant-scoped authenticated photo serving (404 on foreign tenant)
  - POST /api/stops/[id]/ack: idempotent per-user stop acknowledgement (onConflictDoNothing)
  - POST /api/stops/[id]/comments + GET: comment/correction thread with optional photo, reason correction updates stop_events.reason
  - POST /api/notes: shift note creation, defaults to tenant first plant
  - getRecentNotifiableStops: fault/Bunker-tom stops last 48h with ackCount
  - getTodaysStopsWithAcks: today's stops (Oslo day start) with ackCount
  - getStopDetail: single stop + acks + comments, null on foreign/missing (notFound())
  - getShiftNotes: shift notes with author names, newest-first
affects: [07-05-operator-ui]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - getApiSession() from api-auth.ts for all route handlers (never verifySession — avoids redirect)
    - onConflictDoNothing for idempotent inserts (stop_acknowledgements unique index)
    - Zod .refine() for cross-field validation (comment OR correctedReason required)
    - Photo tenant isolation: same 404 for not-found and foreign-tenant (hides existence)
    - Four DAL accessors added: each calls verifySession() first, tenantId in every WHERE

key-files:
  created:
    - src/app/api/photos/route.ts
    - src/app/api/photos/[id]/route.ts
    - src/app/api/stops/[id]/ack/route.ts
    - src/app/api/stops/[id]/comments/route.ts
    - src/app/api/notes/route.ts
  modified:
    - src/lib/dal.ts

key-decisions:
  - "Photos stored as ./uploads/{tenantId}/{uuid}.{ext}, served only via authenticated API with tenant guard (404 on cross-tenant)"
  - "Ack idempotency via drizzle .onConflictDoNothing() on UNIQUE(stopEventId, userId) index from 07-01"
  - "correctedReason in comments also updates stop_events.reason so correction propagates everywhere"
  - "Notes default to tenant's first plant when plantId not provided"
  - "getStopDetail returns null (not throws) on missing/foreign stop — page calls notFound()"
  - "Buffer as unknown as BodyInit cast needed for Node.js Buffer in NextResponse (Next.js 16 / TypeScript strictness)"

patterns-established:
  - "Route handlers: params is a Promise in Next.js 16 — always await params before destructuring"
  - "Cross-tenant photo guard: fetch photo, check photo.tenantId !== session.tenantId → 404 (never expose existence)"
  - "DAL imports for Phase 7 tables: stopAcknowledgements, stopComments, shiftNotes added to existing import"

# Metrics
duration: 8min
completed: 2026-06-11
---

# Phase 07 Plan 04: Reporting API + DAL Accessors Summary

**Five write API endpoints (photos/ack/comments/notes) plus four tenant-scoped DAL read accessors for the Phase 7 operator UI, with Zod validation, idempotency, and cross-tenant photo isolation**

## Performance

- **Duration:** ~8 min
- **Started:** 2026-06-11T16:22:54Z
- **Completed:** 2026-06-11T16:30:35Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments
- Photo upload/serving endpoints with 10MB size guard, image/* MIME guard, and tenant-scoped 404 isolation
- Idempotent stop acknowledgement via `onConflictDoNothing` on the UNIQUE(stopEventId, userId) index
- Comment endpoint supporting text + reason correction (updates `stop_events.reason`) + optional photo with cross-tenant validation
- Shift notes endpoint with automatic plant resolution (first plant if not specified)
- Four DAL read accessors for operator pages: `getRecentNotifiableStops`, `getTodaysStopsWithAcks`, `getStopDetail`, `getShiftNotes`
- All endpoints return 401 without session, all DAL accessors use verifySession() + session.tenantId

## Task Commits

Each task was committed atomically:

1. **Task 1: Photo upload + tenant-scoped serving** - `462fa01` (feat)
2. **Task 2: Ack, comments, and notes write endpoints** - included in `f3bda61` (parallel 07-03 executor picked up untracked files)
3. **Task 3: DAL read accessors for operator pages** - `10e52b7` (feat)

**Plan metadata:** (docs commit below)

_Note: Task 2 files were committed under 07-03's final commit (f3bda61) because the parallel executor ran `git add` on untracked files while this plan's staging was in-flight. The content is correct and verified._

## Files Created/Modified
- `src/app/api/photos/route.ts` - Multipart photo upload with size/mime guards, disk write, photos table insert
- `src/app/api/photos/[id]/route.ts` - Authenticated photo serving, tenant isolation (404 on foreign/missing)
- `src/app/api/stops/[id]/ack/route.ts` - Idempotent stop acknowledgement (onConflictDoNothing)
- `src/app/api/stops/[id]/comments/route.ts` - Comment + optional reason correction + photo; Zod validation; GET thread
- `src/app/api/notes/route.ts` - Shift note creation with photo and plant resolution
- `src/lib/dal.ts` - Four new read accessors + import extended for Phase 7 tables

## Decisions Made
- `Buffer as unknown as BodyInit` cast required for NextResponse with Node.js Buffer in Next.js 16 — type mismatch between Node ArrayBuffer and browser BodyInit
- `correctedReason` not only stored as comment field but also propagates to `stop_events.reason` immediately, so all views show the corrected reason
- Photo existence is hidden from cross-tenant callers via identical 404 (not 403) — security-by-obscurity pattern matching the plan spec

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered
- Task 2 files (ack, comments, notes) were created and verified before being committed, but were swept up by the parallel 07-03 plan executor's final commit (f3bda61). The files contain exactly the code written and verified here; only the commit attribution differs. No content correctness issue.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- All five write endpoints operational and verified (photo round-trip, 400s, idempotent ack, comment+correction+photo, note, 401s)
- Four DAL read accessors ready for 07-05 operator UI pages (/skift, /varsler, /stopp/[id])
- `npm test` green (58 tests, 0 failures) — no regressions
- No dev server left running

---
*Phase: 07-pwa-operator*
*Completed: 2026-06-11*

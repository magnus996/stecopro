---
phase: 07-pwa-operator
plan: 03
subsystem: infra
tags: [web-push, vapid, push-notifications, pwa, notifier, throttle, service-worker]

# Dependency graph
requires:
  - phase: 07-01
    provides: push_subscriptions schema table in SQLite via Drizzle
  - phase: 07-02
    provides: service worker registration (PwaRegistrar) and PWA shell
provides:
  - Pure notifier module (src/lib/notifier/notifier.ts) with filter, 5-min throttle, pruning, error isolation
  - NotifyingAdapter decorator for live tick only (backfill stays silent)
  - POST /api/push/subscribe — authenticated upsert on endpoint
  - POST /api/push/unsubscribe — remove subscription by endpoint
  - GET /api/push/vapid-public-key — public key or 503 when absent
  - POST /api/dev/trigger-stop — demo/E2E stop injection + notification
  - PushToggle client component
  - VAPID keys generated into .env.local
  - vitest.config.ts with @ path alias support
affects: [07-05, e2e-phase7]

# Tech tracking
tech-stack:
  added: [web-push@3.6.7, "@types/web-push"]
  patterns:
    - "Notifier takes db as parameter — never imports @/db or next/headers (runs in both live loop and request context)"
    - "5-minute in-memory throttle per tenant+reason key prevents per-tick re-notification storms"
    - "Backfill/live split: plain SqliteIngestAdapter for runBackfill, NotifyingAdapter only for setInterval tick"
    - "VAPID keys served via /api/push/vapid-public-key (not NEXT_PUBLIC_*) for graceful 503 degradation"
    - "Subscription endpoint uses onConflictDoUpdate — re-subscribe from same device never 500s"

key-files:
  created:
    - src/lib/notifier/notifier.ts
    - src/lib/notifier/notifier.test.ts
    - src/lib/ingest/notifying-adapter.ts
    - src/app/api/push/vapid-public-key/route.ts
    - src/app/api/push/subscribe/route.ts
    - src/app/api/push/unsubscribe/route.ts
    - src/app/api/dev/trigger-stop/route.ts
    - src/components/PushToggle.tsx
    - vitest.config.ts
  modified:
    - src/lib/simulator/live.ts
    - package.json
    - package-lock.json
    - .env.local

key-decisions:
  - "notifyStop takes db as parameter to run in both live loop (no request context) and route handlers"
  - "5-min in-memory throttle prevents per-minute re-notification: live tick creates new stop row each minute for ongoing stops"
  - "Backfill adapter stays plain SqliteIngestAdapter; NotifyingAdapter wraps it only for setInterval"
  - "VAPID keys served via API not NEXT_PUBLIC_* so absence degrades to 503 without build-time env requirement"
  - "vitest.config.ts added with @ alias to allow @/db/schema imports in tests"

patterns-established:
  - "Fire-and-forget pattern for notify in NotifyingAdapter: void notifyStop(...).catch(console.error)"
  - "Error isolation in notifyStop: 404/410 → prune row, other errors logged, never thrown"
  - "WebPushLike interface + deps injection enables fake webpush in tests without module mocking"

# Metrics
duration: 10min
completed: 2026-06-11
---

# Phase 7 Plan 03: Push Pipeline Summary

**Web Push notification pipeline with VAPID keys, pure tested notifier, NotifyingAdapter for live-only ticking, four API routes, and PushToggle component — fault/Bunker-tom stops trigger per-tenant throttled push notifications with graceful degradation when keys absent**

## Performance

- **Duration:** 10 min
- **Started:** 2026-06-11T16:22:47Z
- **Completed:** 2026-06-11T16:32:50Z
- **Tasks:** 3
- **Files modified:** 13

## Accomplishments

- Full push pipeline: web-push installed, VAPID keys generated into .env.local, pure notifier with all safety properties
- 13 vitest cases covering filter/throttle/pruning/error-tolerance/missing-keys — all green
- Live simulator correctly split: runBackfill uses plain SqliteIngestAdapter; only setInterval tick uses NotifyingAdapter
- Four API routes: vapid-public-key (no auth, degradable), subscribe (upsert), unsubscribe, dev/trigger-stop (E2E hook)
- Curl round-trip verified: 401 without cookie, 201 with cookie, idempotent re-subscribe, trigger-stop returns attempted>=1

## Task Commits

Each task was committed atomically:

1. **Task 1: Install web-push, generate VAPID keys, build tested notifier** - `c205a43` (feat)
2. **Task 2: NotifyingAdapter + live.ts wiring** - `f3bda61` (feat)
3. **Task 3: Push API routes, PushToggle, dev/trigger-stop** - `98de1d4` (feat)

## Files Created/Modified

- `src/lib/notifier/notifier.ts` — Pure notifier: filter (fault/Bunker-tom only), 5-min throttle, dead-sub pruning, error isolation; takes db as parameter
- `src/lib/notifier/notifier.test.ts` — 13 vitest cases with injected fake web-push and in-memory SQLite
- `src/lib/ingest/notifying-adapter.ts` — Decorator implementing IngestAdapter; fires notifyStop fire-and-forget after reportStop
- `src/lib/simulator/live.ts` — Added NotifyingAdapter import; split adapters (plain for backfill, notifying for tick)
- `src/app/api/push/vapid-public-key/route.ts` — GET returns public key or 503; no auth required
- `src/app/api/push/subscribe/route.ts` — POST upsert on endpoint; 401 without session, 503 without VAPID keys
- `src/app/api/push/unsubscribe/route.ts` — POST removes endpoint scoped to tenant
- `src/app/api/dev/trigger-stop/route.ts` — POST injects stop + notifies; role guard in prod; returns {attempted,sent,pruned}
- `src/components/PushToggle.tsx` — 'use client' toggle with Norwegian UI; handles unsupported devices gracefully
- `vitest.config.ts` — Added @ path alias so notifier.test.ts can import @/db/schema
- `package.json` — web-push@3.6.7 added to dependencies, @types/web-push to devDependencies
- `.env.local` — VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT added (gitignored)

## Decisions Made

- **notifyStop takes db as parameter** — runs in both the live simulator loop (no request context) and route handlers; importing @/db would fail outside request context
- **5-minute in-memory throttle** — the live tick closes and re-opens the same stop each minute with a new id; without throttling every tick would re-notify. Map key is `${tenantId}:${reason}`
- **vitest.config.ts added** — existing tests used only relative imports; notifier test needs @/db/schema so a config with path alias was added (Rule 3 - Blocking fix)
- **VAPID keys served via API** — not NEXT_PUBLIC_* so the server can return 503 gracefully when keys absent; client has no stale build-time key

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Added vitest.config.ts with @ path alias**

- **Found during:** Task 1 (running notifier.test.ts)
- **Issue:** notifier.test.ts imports `@/db/schema` but no vitest config existed with path alias resolution — test failed with "Cannot find package @/db/schema"
- **Fix:** Created `vitest.config.ts` with `resolve.alias: { '@': './src' }` matching tsconfig paths
- **Files modified:** vitest.config.ts
- **Verification:** All 13 tests pass; existing 45 tests continue to pass
- **Committed in:** c205a43 (Task 1 commit)

**2. [Rule 1 - Bug] Fixed Uint8Array type error in PushToggle.tsx**

- **Found during:** Task 3 (tsc --noEmit)
- **Issue:** `urlBase64ToUint8Array` returned `Uint8Array<ArrayBufferLike>` which is not assignable to `applicationServerKey` (requires `Uint8Array<ArrayBuffer>`)
- **Fix:** Explicit return type annotation `Uint8Array<ArrayBuffer>` + cast `as Uint8Array<ArrayBuffer>`
- **Files modified:** src/components/PushToggle.tsx
- **Verification:** tsc --noEmit clean
- **Committed in:** 98de1d4 (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (1 blocking, 1 bug)
**Impact on plan:** Both fixes essential for build/test correctness. No scope creep.

## Issues Encountered

None — all verifications passed as expected.

## User Setup Required

None — VAPID keys were generated automatically into .env.local during Task 1 execution.

## Next Phase Readiness

- Push pipeline fully operational; notifier + routes ready for 07-05 (/varsler page) to wire PushToggle
- trigger-stop endpoint ready for E2E phase-7 tests to use as notification injection probe
- PushToggle is a self-contained leaf component; import it from any page
- web-push version 3.6.7 confirmed compatible with project setup

---
*Phase: 07-pwa-operator*
*Completed: 2026-06-11*

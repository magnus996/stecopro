---
phase: 07-pwa-operator
plan: 02
subsystem: pwa
tags: [next.js, pwa, service-worker, manifest, ImageResponse, satori, push-notifications]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: authenticated (app) layout structure for PwaRegistrar mount point
provides:
  - Web app manifest (display:standalone, start_url:/skift, dark theme)
  - Runtime-generated icons at /icon-192 and /icon-512 (ImageResponse + logo-hvit.png)
  - 180px apple-touch-icon via apple-icon.tsx file convention
  - Push-only service worker at /sw.js (push + notificationclick, no offline caching)
  - PwaRegistrar client component that registers SW only inside authenticated layout
affects: [07-03-push-notifications, future PWA phases]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "ImageResponse icons: readFileSync + base64 data URI to load logo (satori cannot fetch URLs reliably)"
    - "PwaRegistrar null-render pattern: 'use client' component that only performs side effects"
    - "SW push-only: deliberately no fetch/cache handler to avoid stale live-dashboard"
    - "SW registration scoped to (app)/layout.tsx so it only fires when authenticated"

key-files:
  created:
    - src/app/manifest.ts
    - src/app/icon-192/route.tsx
    - src/app/icon-512/route.tsx
    - src/app/apple-icon.tsx
    - public/sw.js
    - src/components/PwaRegistrar.tsx
  modified:
    - src/app/(app)/layout.tsx

key-decisions:
  - "Runtime ImageResponse icons using readFileSync+base64 (satori URL fetch not reliable)"
  - "SW registration only in (app)/layout.tsx — not root layout, not login — scoped to auth"
  - "No offline caching in SW — stale live dashboard would actively mislead operators"
  - "notificationclick deep-links to notification.data.url, reuses open window if present"

patterns-established:
  - "Icon routes: export const dynamic = 'force-static' + ImageResponse from next/og"
  - "Apple icon: file convention (apple-icon.tsx) with exported size + contentType"

# Metrics
duration: 3min
completed: 2026-06-11
---

# Phase 7 Plan 02: PWA Manifest, Icons, Service Worker Summary

**Web app manifest (display:standalone), runtime ImageResponse icons from Steco logo, push-only SW with notificationclick deep-link, and PwaRegistrar scoped to the authenticated layout**

## Performance

- **Duration:** 3 min
- **Started:** 2026-06-11T16:17:20Z
- **Completed:** 2026-06-11T16:20:41Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments
- App manifest at /manifest.webmanifest: standalone display, start_url /skift, dark #18181b theme, 192/512 icon references
- Runtime icon routes (/icon-192, /icon-512) using ImageResponse with Steco white logo on dark background — readFileSync+base64 avoids satori URL-fetch issues
- 180px apple-touch-icon via Next.js apple-icon.tsx file convention
- Push-only service worker (public/sw.js) with push event handler and notificationclick deep-link (clients.openWindow); no offline caching deliberately
- PwaRegistrar client component mounts only inside authenticated (app) layout — SW never registers on /login

## Task Commits

Each task was committed atomically:

1. **Task 1: Manifest + runtime icon routes** - `cdf5683` (feat) — note: committed inside 07-01 parallel executor commit due to parallel execution timing; content verified correct
2. **Task 2: Push-only SW + PwaRegistrar in authenticated layout** - `ea03bf5` (feat)

**Plan metadata:** (see final docs commit)

## Files Created/Modified
- `src/app/manifest.ts` - Typed MetadataRoute.Manifest: standalone, start_url /skift, dark theme
- `src/app/icon-192/route.tsx` - 192px ImageResponse route with logo on #18181b bg
- `src/app/icon-512/route.tsx` - 512px ImageResponse route with logo on #18181b bg
- `src/app/apple-icon.tsx` - 180px apple-touch-icon file-convention component
- `public/sw.js` - Push-only service worker: push handler + notificationclick deep-link
- `src/components/PwaRegistrar.tsx` - 'use client' SW registrar, returns null
- `src/app/(app)/layout.tsx` - Added PwaRegistrar import + mount

## Decisions Made
- Used readFileSync+base64 data URI for logo in ImageResponse (satori cannot fetch public/ URLs reliably at runtime)
- No offline caching in SW: a stale cached live dashboard would mislead operators about plant state
- PwaRegistrar mounted only in (app)/layout.tsx (authenticated shell) — SW never registers on unauthenticated pages
- notificationclick reuses existing window if URL matches, otherwise opens new window — avoids duplicate tabs

## Deviations from Plan

None - plan executed exactly as written. Runtime ImageResponse icons worked without needing the static PNG fallback.

## Issues Encountered

Parallel plan 07-01 executor committed our Task 1 files (manifest.ts, icon routes, apple-icon.tsx) as part of its own commit (cdf5683) due to parallel execution timing and use of broader git add. File content was verified correct. Task 2 committed cleanly as ea03bf5.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- PWA foundation complete: manifest + icons + push-ready SW + authenticated registrar
- Ready for 07-03: push notification send API (needs VAPID keys from .env)
- No blockers

---
*Phase: 07-pwa-operator*
*Completed: 2026-06-11*

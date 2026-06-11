---
phase: 06-calibration-branding-inventory
plan: "02"
subsystem: ui
tags: [branding, next/image, logo, tailwind]

# Dependency graph
requires:
  - phase: 05-administration-demo-polish
    provides: App shell layout and login form as stable targets for branding
provides:
  - White Steco logo rendered via next/image in sidebar, mobile header, and login card
  - Dark backing containers (bg-zinc-900) on all three light surfaces for legibility
affects: [demo-readiness, branding]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "next/image with explicit width/height + style height:auto for aspect-ratio-safe scaling"
    - "Dark pill/container pattern (bg-zinc-900) to host white-on-light logo"

key-files:
  created: []
  modified:
    - src/app/(app)/layout.tsx
    - src/app/(auth)/login/LoginForm.tsx

key-decisions:
  - "Logo scaled to 150px wide in sidebar, 110px in mobile header, 170px on login card"
  - "bg-zinc-900 container on each surface so white PNG is legible against light zinc backgrounds"
  - "style={{ height: 'auto' }} used alongside explicit height prop to avoid Next.js distortion warning"

patterns-established:
  - "Logo placement pattern: wrap in dark pill for white-on-light legibility"

# Metrics
duration: 2min
completed: 2026-06-11
---

# Phase 6 Plan 02: Branding Summary

**White Steco wordmark (269x57 PNG) rendered via next/image in three locations — sidebar, mobile header, and login card — each on a bg-zinc-900 dark backing for legibility against light zinc surfaces**

## Performance

- **Duration:** 2 min
- **Started:** 2026-06-11T14:29:50Z
- **Completed:** 2026-06-11T14:31:50Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments

- Replaced `Steco<span>pro</span>` text in sidebar with `next/image` logo (150px wide) on dark `bg-zinc-900` container
- Replaced `Steco<span>pro</span>` text in mobile header with dark pill + logo (110px wide)
- Replaced `<h1>StecoPro</h1>` on login card with centered dark rounded container + logo (170px wide)
- TypeScript clean, no warnings

## Task Commits

Each task was committed atomically:

1. **Task 1: Logo in app shell (sidebar + mobile header)** - `9195a2a` (feat)
2. **Task 2: Logo on login page** - `32a9e3c` (feat)

**Plan metadata:** (see docs commit below)

## Files Created/Modified

- `src/app/(app)/layout.tsx` - Imported next/image; sidebar title div gains bg-zinc-900 + Image; mobile header span replaced with dark pill + Image
- `src/app/(auth)/login/LoginForm.tsx` - Imported next/image; h1 StecoPro replaced with inline-flex dark rounded container + Image

## Decisions Made

- Sidebar logo at 150px wide (scaled from 269px source, keeping aspect ratio via `height: auto`)
- Mobile header logo at 110px wide in a `rounded px-2 py-1` pill — compact but readable
- Login card logo at 170px wide in a `rounded-lg px-4 py-3` block — prominent above the form
- `style={{ height: 'auto', width: 'Xpx' }}` pattern used to prevent Next.js aspect-ratio warnings while still passing numeric `height` prop

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- All three brand surfaces display the real Steco logo on dark backgrounds
- No text placeholder wordmarks remain in the app shell or login page
- Ready for plan 06-03 (inventory / remaining calibration tasks if any)

---
*Phase: 06-calibration-branding-inventory*
*Completed: 2026-06-11*

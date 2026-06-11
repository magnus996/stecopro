---
phase: 03-live-dashboard
plan: 01
subsystem: ui
tags: [recharts, timezone, oslo, typescript, shift-attribution]

# Dependency graph
requires:
  - phase: 02-simulator-ingest
    provides: "Simulator time helpers (osloHour/getShiftType/getShiftBoundsUtc) originally in src/lib/simulator/time.ts"
provides:
  - "src/lib/time.ts — canonical Oslo-timezone shift helpers importable by dashboard and reports without simulator dependency"
  - "recharts 3.8.1 installed and resolvable for client chart components"
affects:
  - 03-live-dashboard plans 02-onwards (dashboard DAL and chart UI import from src/lib/time.ts)
  - 04-reports (shared time helpers for OEE and shift attribution)

# Tech tracking
tech-stack:
  added: [recharts@3.8.1]
  patterns: ["Shared lib pattern: move shared helpers out of feature subdirectory to src/lib/ with re-export for backward compat"]

key-files:
  created: [src/lib/time.ts]
  modified: [src/lib/simulator/time.ts, package.json, package-lock.json]

key-decisions:
  - "src/lib/time.ts is the canonical home for Oslo shift helpers; simulator re-exports for backward compat"
  - "recharts 3.x installs cleanly with React 19 (no --legacy-peer-deps needed)"

patterns-established:
  - "Re-export pattern: feature module (simulator/time.ts) becomes a one-line re-export from shared lib — no import path changes in consumers"

# Metrics
duration: 2min
completed: 2026-06-11
---

# Phase 3 Plan 01: Foundation — Shared Time Helpers and Recharts

**Oslo shift helpers promoted from simulator subdirectory to src/lib/time.ts (shared); recharts 3.8.1 installed for chart components**

## Performance

- **Duration:** 2 min
- **Started:** 2026-06-11T07:40:34Z
- **Completed:** 2026-06-11T07:42:19Z
- **Tasks:** 2
- **Files modified:** 4

## Accomplishments
- Created `src/lib/time.ts` as canonical home for `osloHour`, `getShiftType`, and `getShiftBoundsUtc` — dashboard and reports can now import these without touching the simulator package
- Reduced `src/lib/simulator/time.ts` to a single re-export line, preserving backward compatibility for all existing simulator imports
- Installed recharts 3.8.1 (React 19 peer dep satisfied without `--legacy-peer-deps`)

## Task Commits

Each task was committed atomically:

1. **Task 1: Move shift helpers to src/lib/time.ts and re-export from simulator** - `b39afd4` (refactor)
2. **Task 2: Install recharts** - `36ce8b5` (chore)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `src/lib/time.ts` - Canonical Oslo timezone shift helpers (osloHour, getShiftType, getShiftBoundsUtc)
- `src/lib/simulator/time.ts` - Replaced with one-line re-export from `../time`
- `package.json` - recharts added to dependencies
- `package-lock.json` - Lock file updated with recharts 3.8.1 and transitive deps

## Decisions Made
- Re-export pattern chosen over updating all simulator import paths — zero risk of breaking existing tests, purely additive change
- recharts 3.x used directly (no `--legacy-peer-deps`) — React 19.2.4 satisfies the `^19.0.0` peer requirement as expected per research

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- `src/lib/time.ts` ready for import by dashboard DAL (plan 03-02) and any Phase 4 report modules
- recharts available for the current-draw chart component (plan 03-04 or equivalent)
- Simulator tests (17/17) continue to pass through the re-export

---
*Phase: 03-live-dashboard*
*Completed: 2026-06-11*

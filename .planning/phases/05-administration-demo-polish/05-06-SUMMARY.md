---
phase: 05-administration-demo-polish
plan: 06
subsystem: testing
tags: [e2e, curl, bash, walkthrough, role-gates, user-crud, bcryptjs, tsx]

# Dependency graph
requires:
  - phase: 05-01
    provides: demo seed polish + demo:setup script
  - phase: 05-03
    provides: plant config page (/admin/plant)
  - phase: 05-04
    provides: user management pages (/admin/users)
  - phase: 05-05
    provides: tenant management pages (/admin/tenants)
provides:
  - curl-based full role-walkthrough E2E script (scripts/e2e-phase5-walkthrough.sh)
  - 34-check executable proof of all role gates, page access, and user CRUD lifecycle
  - demo runbook doubling as CI-runnable acceptance test
affects: []

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "E2E script mirrors e2e-phase4-shifts.sh pattern: BASE override, pass/fail counter, check() helper"
    - "blocked() helper: passes if status != 200 OR body lacks expected heading (handles 307 redirects and RSC role-gate redirects)"
    - "User CRUD via npx tsx -e inline snippets using better-sqlite3 + bcryptjs directly (no server-action curl needed)"

key-files:
  created:
    - scripts/e2e-phase5-walkthrough.sh
  modified: []

key-decisions:
  - "blocked() checks either non-200 status OR absence of heading marker — handles both proxy-level (unauthenticated) and page-level (wrong role, gets dashboard redirect) blocking"
  - "User CRUD round-trip done via npx tsx -e inline DB snippets, not curl-invoked server actions — avoids RSC multipart form complexity while directly testing the auth.ts !user.active code path"
  - "Temp user cleanup at end of SC9 preserves idempotency — script can be re-run without stale state"

patterns-established:
  - "Phase E2E scripts live in scripts/ and follow the BASE/pass/fail/check pattern"
  - "blocked() helper pattern for testing RSC role gates without needing redirect-aware curl"

# Metrics
duration: 3min
completed: 2026-06-11
---

# Phase 5 Plan 06: E2E Walkthrough Summary

**curl-based 34-check role walkthrough script proving all four demo roles, every role gate, and the user deactivation auth path — exits 0 against fresh demo:setup data**

## Performance

- **Duration:** 3 min
- **Started:** 2026-06-11T09:20:28Z
- **Completed:** 2026-06-11T09:23:36Z
- **Tasks:** 1
- **Files modified:** 1

## Accomplishments

- Full role walkthrough script for all four roles (operator, produksjonsleder, admin, system_admin) covering every page in the demo path
- Role gate coverage: operator blocked from /reports, /admin/plant, /admin/users, /admin/tenants; produksjonsleder blocked from /admin/users, /admin/tenants; admin blocked from /admin/tenants
- User CRUD lifecycle verified: active user logs in (200), deactivated user rejected (401), temp user cleaned up — directly exercises the `!user.active` auth path
- system_admin tenant visibility proves ADMN-04 isolation: both "Steco Demo" and "Isolasjonstest" appear in /admin/tenants
- 34/34 checks pass against fresh demo:setup data

## Task Commits

Each task was committed atomically:

1. **Task 1: Write the full role-walkthrough + role-gate + user-CRUD E2E script** - `fa5c269` (feat)

**Plan metadata:** (see docs commit below)

## Files Created/Modified

- `scripts/e2e-phase5-walkthrough.sh` - Full demo walkthrough E2E: 4 roles, role gates, user CRUD lifecycle, 34 checks, exits 0

## Decisions Made

- `blocked()` helper checks either non-200 status OR absence of expected heading marker — this correctly handles both proxy-level (no session → redirect to /login) and page-level (wrong role → redirect to /dashboard) blocking, where the redirect gives a 307 without curl's `-L` flag
- User CRUD round-trip via `npx tsx -e` inline snippets to insert/update/delete rows directly in the SQLite DB, rather than curl-invoking RSC server actions — avoids multipart form complexity while testing the exact `!user.active` code path in `route.ts`
- Temp user (`e2e-temp@steco-demo.no`) is deleted at the end of the script to ensure idempotency on re-runs

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

All Phase 5 plans are complete. The demo milestone is ready for `/gsd:complete-milestone`:

- Phase 5 plan 01: Demo seed polish + demo:setup script
- Phase 5 plan 02: Plant config page (/admin/plant)
- Phase 5 plan 03: (see 05-03-SUMMARY.md)
- Phase 5 plan 04: User management pages (/admin/users)
- Phase 5 plan 05: Tenant management pages (/admin/tenants)
- Phase 5 plan 06: Full role E2E walkthrough (this plan)

The single `./scripts/e2e-phase5-walkthrough.sh` script provides an executable proof that every Phase 5 page exists, every role gate holds, and the user deactivation lifecycle works.

---
*Phase: 05-administration-demo-polish*
*Completed: 2026-06-11*

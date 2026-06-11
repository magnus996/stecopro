---
phase: 05-administration-demo-polish
plan: 04
subsystem: ui
tags: [next.js, react, server-actions, useActionState, zod, bcryptjs, drizzle-orm, admin, users, multi-tenant]

# Dependency graph
requires:
  - phase: 05-02
    provides: getUsersForTenant, getUserById DAL accessors (admin role-gated, tenant-scoped)
provides:
  - "src/actions/users.ts with createUser/updateUser/deactivateUser/reactivateUser server actions"
  - "/admin/users list page (admin+, tenant-scoped user table)"
  - "/admin/users/new create page with bcrypt hashing"
  - "/admin/users/[userId] edit/deactivate page (pre-populated)"
  - "DeactivateButton client component with useActionState feedback"
affects: [05-05-tenants, 05-06-plant, demo-walkthrough, e2e-tests]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server action + useActionState pattern replicated from LoginForm.tsx"
    - "Role gate in BOTH server action AND page (defence in depth)"
    - "tenantId always from session.tenantId — never from form input (multi-tenant isolation)"
    - "DeactivateButton colocated as named export in UserForm.tsx"

key-files:
  created:
    - src/actions/users.ts
    - src/app/(app)/admin/users/page.tsx
    - src/app/(app)/admin/users/UserForm.tsx
    - src/app/(app)/admin/users/new/page.tsx
    - src/app/(app)/admin/users/[userId]/page.tsx
  modified: []

key-decisions:
  - "DeactivateButton colocated in UserForm.tsx as named export — avoids extra file per plan guidance"
  - "reactivateUser added for demo convenience — allows reversing deactivation without seed reset"
  - "Email read-only on edit — keeps edit scope tight (no email change in v1)"
  - "Duplicate email guard in createUser action — returns field error instead of raw constraint crash"

patterns-established:
  - "Role gate pattern: getCurrentUser() + role check + redirect('/dashboard') in every admin page"
  - "Server action pattern: verifySession() → isAdmin check → zod parse → db mutation → revalidatePath → redirect"
  - "useActionState<FormState, FormData>(action, undefined) — explicit type parameters for React 19 compatibility"

# Metrics
duration: 3min
completed: 2026-06-11
---

# Phase 5 Plan 04: User Management Summary

**Per-tenant user CRUD (list/create/edit/deactivate) with bcrypt passwords, admin+ role gates in both pages and server actions, system_admin excluded from role dropdown**

## Performance

- **Duration:** 3 min
- **Started:** 2026-06-11T09:12:05Z
- **Completed:** 2026-06-11T09:15:27Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- `src/actions/users.ts` — createUser/updateUser/deactivateUser/reactivateUser server actions with bcrypt hashing, admin+ role gate, tenant isolation via `session.tenantId`, duplicate email guard
- `/admin/users` list page with Aktiv/Inaktiv badges, Ny bruker link, and per-row Rediger links
- `/admin/users/new` create page and `/admin/users/[userId]` edit page pre-populated from getUserById
- Shared `UserForm.tsx` (use client) with `useActionState`, role select excluding system_admin, and colocated `DeactivateButton` with live success feedback

## Task Commits

1. **Task 1: users server actions** - `86873bc` (feat)
2. **Task 2: user list/new/edit pages + UserForm + DeactivateButton** - `b9da40c` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified

- `src/actions/users.ts` — createUser/updateUser/deactivateUser/reactivateUser; bcrypt hashing; z.enum excludes system_admin; tenantId always from session
- `src/app/(app)/admin/users/page.tsx` — user list with role gate, getUsersForTenant, active/inactive status badges
- `src/app/(app)/admin/users/UserForm.tsx` — shared create/edit form (use client); DeactivateButton named export
- `src/app/(app)/admin/users/new/page.tsx` — create user page with role gate
- `src/app/(app)/admin/users/[userId]/page.tsx` — edit/deactivate page with role gate, pre-populated via getUserById

## Decisions Made

- **DeactivateButton colocated in UserForm.tsx**: Per plan guidance, kept as a named export in UserForm.tsx to avoid an extra file while still providing a proper client boundary for useActionState feedback.
- **reactivateUser added**: For demo convenience — allows admin to reverse a deactivation without resetting the entire seed. Low overhead, high demo value.
- **Email read-only on edit**: Email changes are a security-sensitive operation. Keeping edit scope to name/role only avoids edge cases around duplicate email handling on update.
- **Duplicate email guard**: Action returns `{ errors: { email: ['E-post er allerede i bruk'] } }` before insert to give a clean user-facing error rather than surfacing a raw SQLite unique constraint violation.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- TENA-04 + ADMN-02 satisfied: tenant admin creates/edits/deactivates users in their own tenant
- bcrypt passwords, system_admin cannot be assigned via UI, deactivated users cannot log in
- Gates enforced in both pages AND server actions
- Ready for 05-05 (tenant management) and 05-06 (plant config)

---
*Phase: 05-administration-demo-polish*
*Completed: 2026-06-11*

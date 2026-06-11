# Summary: 01-04 — Protected shell, role-based navigation, dashboard placeholder, E2E verify

**Status:** Complete
**Duration:** ~45 min (two executor crashes + orchestrator recovery)

## What Was Built

- `src/lib/nav.ts` — `NAV_ITEMS` with role arrays + `navItemsForRole()`; six nav entries (Dashbord, Skiftrapporter, Analyser, Anleggsoppsett, Brukere, Tenants) gated by role
- `src/components/Nav.tsx`, `src/components/LogoutButton.tsx` — sidebar navigation and logout
- `src/app/(app)/layout.tsx` — protected shell: verifySession + getCurrentUser + getTenant, shows name/role/tenant, renders role-filtered nav
- `src/app/(app)/dashboard/page.tsx` — placeholder dashboard with logged-in context panel and tenant-scoped plant list
- `src/app/page.tsx` — root redirect to /dashboard
- `src/lib/dal.ts` — added `getTenant()` accessor (session-derived tenantId, same DAL rule)
- `scripts/e2e-phase1.sh` — repeatable E2E smoke test, 16 assertions covering all five phase success criteria
- Base Next.js scaffold files committed (README, next.config.ts, tsconfig.json, globals.css, root layout, public/)

## Commits

- `d6cbbb7` feat(01-04): role-based nav config and components
- `b8bec3f` feat(01-04): protected app shell, dashboard placeholder, root redirect
- `3a394ae` fix(01-04): add getTenant() to DAL and show tenant name on dashboard
- `ef24789` chore(01-04): commit base Next.js scaffold files
- (this commit) test(01-04): E2E smoke script + summary

## Verification (E2E, all passed — 16/16)

1. App runs: /login answers 200 (SC1)
2. operator@steco-demo.no logs in, sees Steco Demo tenant and Returpapir Linje 1 (SC2)
3. Negative isolation: bruker@isolasjonstest.no sees Isolasjonstest, NOT Steco Demo's plant (SC2)
4. Wrong password rejected with Norwegian error; unauthenticated /dashboard → 307 redirect
5. Role nav: admin has Brukere, operator does not; only system_admin has Tenants link (SC3)
6. All 9 schema tables present in stecopro.db (SC4)
7. DAL structural: no function takes tenantId as parameter; tenant derived via verifySession() (SC5)

## Deviations

- **Two executor agents crashed on API socket errors mid-plan.** Orchestrator recovered from committed state both times; final E2E run + summary done by orchestrator directly.
- **False positive in first E2E run:** generic `grep -i 'Tenant'` matched the "Tenant: Steco Demo" context label shown to all users. Fixed by asserting on the `/admin/tenants` nav href instead. Role gating itself was always correct.
- **Added `scripts/e2e-phase1.sh`** (not in plan's files_modified) so the smoke test is repeatable instead of throwaway.
- `getTenant()` added to DAL (used by shell to show tenant name) — follows the session-derived tenantId rule.

## Decisions

- E2E asserts on stable markers (hrefs, seeded names) rather than free text where possible.

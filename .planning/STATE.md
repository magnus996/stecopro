# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-11)

**Core value:** Plant owners see exactly what their sorting plant is doing — uptime, OEE, stops with reasons, and bales produced per fraction — without walking the floor or reading PLC logs.
**Current focus:** Phase 3 - Live Dashboard

## Current Position

Phase: 3 of 5 (Live Dashboard) — In progress
Plan: 3 of N complete
Status: In progress
Last activity: 2026-06-11 — Completed 03-03-PLAN.md (dashboard DAL accessors + getDashboardData)

Progress: [█████░░░░░] ~47% of milestone (11 plans complete, phases 3-5 partially planned)

## Performance Metrics

**Velocity:**
- Total plans completed: 11
- Average duration: ~10 min
- Total execution time: ~101 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 Foundation | 4/4 | 79 min | 20 min |
| 2 Simulator & Ingest | 4/4 | ~42 min | ~11 min |
| 3 Live Dashboard | 3/N | ~2 min | ~2 min |

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Next.js (App Router) + TypeScript full-stack — one codebase, demo-to-production path
- SQLite for demo with Postgres/Timescale-portable schema
- Simulator writes through the same ingest interface a future OPC UA adapter will use
- OEE quality factor approximated and configurable (no material analysis in scope)
- Roles: operator < produksjonsleder < admin, plus Steco system admin for tenant management
- Hand-rolled jose sessions chosen over next-auth@beta (v5 still in beta June 2026)
- Project-local npm cache (.npm-cache/) required due to global cache EACCES issues in this sandbox
- bcryptjs (pure JS) over argon2 — no native build step for demo credentials
- db/index.ts creates fresh Database() per module load (not globalThis singleton) — Turbopack worker threads don't share globalThis
- tsx installed as dev dep so seed script runs without separate build step
- drizzle-kit push used for Phase 1 dev iteration (switch to generate before production)
- system_admin seeded in tenant 1 for Phase 1; Phase 5 adds cross-tenant management
- Seed uses direct Database() connection (not server-only singleton) to run via tsx outside Next.js
- proxy.ts must be in src/ (not project root) for Turbopack detection in src/-layout projects
- Proxy uses req.cookies (not cookies() API) to read session in proxy/middleware context
- Login page split: Server Component (page.tsx with force-dynamic) + Client Component (LoginForm.tsx)
- IngestAdapter is write-only interface; implementations receive Drizzle db in constructor (not @/db/index which is server-only)
- SqliteIngestAdapter.flush() uses db.transaction(tx => {...}) callback form — NOT IIFE pattern
- WAL mode + busy_timeout=5000 + synchronous=NORMAL added to src/db/index.ts for concurrent simulator access
- BUNKER_REFILL_PERIOD_MIN=120 (not 15): large dosing bunker takes ~2h to empty, not 15min
- Stop duration last band capped at 20-40 min (not 30-120): weighted avg stop ~9.65 min targets ~90% availability
- simulateShift() uses abstract machineId (0,1,2) and fractionId (0-3); runner maps to real DB ids
- runner.ts is DB-connection-free — adapter always injected; live mode (plan 04) reuses runBackfill
- SQLite column names: runState, startAt, endAt are camelCase (not snake_case) — raw queries must quote them
- verify-backfill.sh writes temp .ts assertions inside scripts/ (not /tmp) for node_modules resolution
- instrumentationHook flag NOT added to next.config.ts — deprecated/auto-enabled in Next.js 16.2.9
- recordedAt stored as Unix seconds in better-sqlite3 (integer/timestamp mode) — multiply by 1000 for epoch ms
- Live mode catch-up uses capped gap window (MAX_CATCHUP_MS=24h) to avoid re-generating full history
- src/lib/time.ts is canonical home for Oslo shift helpers; src/lib/simulator/time.ts re-exports (backward compat)
- recharts 3.x installs cleanly with React 19 — no --legacy-peer-deps needed
- calculateOee in src/lib/oee.ts is the single OEE source of truth for Phase 3 + Phase 4
- QUALITY_FACTOR=0.95 hardcoded in oee.ts; Phase 5 adds per-plant override
- nowMs explicit parameter in calculateOee — avoids Date.now() nondeterminism in tests
- stopType (fault/idle/planned) does NOT change OEE math — all reduce availability equally
- NOMINAL_BALES_PER_SHIFT = 120 defined locally in dal.ts (not imported from simulator params.ts — avoids coupling simulator-side code into DAL)
- getDashboardData composing accessor: verifySession + Promise.all sub-queries; PlantState and DashboardData types exported for plan 04
- PlantState derivation order: freshness (>3min stale) → outside_shift → open stop type → running
- getBaleCountsByFraction uses LEFT JOIN fractions→baleEvents so zero-bale fractions always appear
- osloDateStr derived via Intl.DateTimeFormat('en-CA', {timeZone:'Europe/Oslo'}) — returns YYYY-MM-DD natively

### Pending Todos

None.

### Blockers/Concerns

None.

**Research flags for planning:**
- Phase 1: Auth choice resolved — hand-rolled jose sessions confirmed; tenant scoping DAL in 01-03
- Phase 2: Simulator realism drives the whole demo; model plant state as a state machine (running / small-stop / fault / empty / outside-shift) generating consistent current draw, stops, and bale events
- Phase 3: Polling is fine for refresh; avoid premature websockets
- Phase 4: OEE math must be consistent between dashboard and reports — single shared calculation module
- Phase 5: Demo seed quality matters more than admin UI polish

## Session Continuity

Last session: 2026-06-11T07:48:46Z
Stopped at: Completed 03-03-PLAN.md (dashboard DAL accessors + getDashboardData) — Phase 3 plan 3 complete
Resume file: None

---
*State initialized: 2026-06-11*
*Next step: /gsd:plan-phase 3*

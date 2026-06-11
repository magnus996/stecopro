# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-11)

**Core value:** Plant owners see exactly what their sorting plant is doing — uptime, OEE, stops with reasons, and bales produced per fraction — without walking the floor or reading PLC logs.
**Current focus:** Phase 1 - Foundation

## Current Position

Phase: 2 of 5 (Simulator & Ingest) — In progress
Plan: 2 of 4 complete (02-01 + 02-02 done; 02-03, 02-04 remain)
Status: In progress
Last activity: 2026-06-11 — Completed 02-02-PLAN.md (simulator engine: time helpers + params + engine)

Progress: [█████░░░░░] ~30% of milestone (6 plans complete: 4 foundation + 02-01 + 02-02)

## Performance Metrics

**Velocity:**
- Total plans completed: 4
- Average duration: 20 min
- Total execution time: 79 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 Foundation | 4/4 | 79 min | 20 min |

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

Last session: 2026-06-11T06:30:33Z
Stopped at: Completed 02-02-PLAN.md (simulator engine)
Resume file: None

---
*State initialized: 2026-06-11*
*Next step: /gsd:execute-phase 1 (plan 01-03)*

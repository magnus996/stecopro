# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-11)

**Core value:** Plant owners see exactly what their sorting plant is doing — uptime, OEE, stops with reasons, and bales produced per fraction — without walking the floor or reading PLC logs.
**Current focus:** Phase 1 - Foundation

## Current Position

Phase: 1 of 5 (Foundation)
Plan: 2 of 4 in current phase
Status: In progress
Last activity: 2026-06-11 — Completed 01-02-PLAN.md

Progress: [██░░░░░░░░] 20% (2 plans complete)

## Performance Metrics

**Velocity:**
- Total plans completed: 2
- Average duration: 4 min
- Total execution time: 8 min

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1 Foundation | 2/4 | 8 min | 4 min |

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
- globalForDb singleton pattern for better-sqlite3 (prevents SQLITE_BUSY on HMR)
- tsx installed as dev dep so seed script runs without separate build step
- drizzle-kit push used for Phase 1 dev iteration (switch to generate before production)
- system_admin seeded in tenant 1 for Phase 1; Phase 5 adds cross-tenant management
- Seed uses direct Database() connection (not server-only singleton) to run via tsx outside Next.js

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

Last session: 2026-06-10T22:49:00Z
Stopped at: Completed 01-02-PLAN.md
Resume file: None

---
*State initialized: 2026-06-11*
*Next step: /gsd:execute-phase 1 (plan 01-03)*

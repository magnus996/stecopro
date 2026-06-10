# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-06-11)

**Core value:** Plant owners see exactly what their sorting plant is doing — uptime, OEE, stops with reasons, and bales produced per fraction — without walking the floor or reading PLC logs.
**Current focus:** Phase 1 - Foundation

## Current Position

Phase: 1 of 5 (Foundation)
Plan: Not started
Status: Ready to plan
Last activity: 2026-06-11 — Project initialized (PROJECT.md, REQUIREMENTS.md, ROADMAP.md)

Progress: [░░░░░░░░░░] 0% (0 plans complete)

## Performance Metrics

**Velocity:**
- Total plans completed: 0
- Average duration: -
- Total execution time: -

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| - | - | - | - |

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

### Pending Todos

None yet.

### Blockers/Concerns

None yet.

**Research flags for planning:**
- Phase 1: Auth choice (Auth.js credentials vs hand-rolled session) and tenant scoping pattern in the data access layer deserve a deliberate pick — hardest thing to retrofit
- Phase 2: Simulator realism drives the whole demo; model plant state as a state machine (running / small-stop / fault / empty / outside-shift) generating consistent current draw, stops, and bale events
- Phase 3: Polling is fine for refresh; avoid premature websockets
- Phase 4: OEE math must be consistent between dashboard and reports — single shared calculation module
- Phase 5: Demo seed quality matters more than admin UI polish

## Session Continuity

Last session: 2026-06-11
Stopped at: Planning files created, awaiting Phase 1 planning
Resume file: None

---
*State initialized: 2026-06-11*
*Next step: /gsd:plan-phase 1*

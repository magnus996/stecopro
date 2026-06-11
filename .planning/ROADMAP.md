# Roadmap: StecoPro (Milestone: Technology Demo)

## Overview

StecoPro's technology demo proves the product end-to-end on mock data: a multi-tenant platform where a Norwegian returpapir sorting plant's production is visible live and in reports. Foundation phase establishes the app, data model, and tenant/role security. Simulator phase produces realistic plant behavior through the same ingest interface a real OPC UA adapter will use. Dashboard phase delivers the live view. Reports phase adds shift reports and historical analysis. Admin phase completes user/tenant management and demo polish.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

Decimal phases appear between their surrounding integers in numeric order.

- [x] **Phase 1: Foundation** - App scaffold, data model, multi-tenant auth with roles
- [x] **Phase 2: Simulator & Ingest** - Realistic mock plant data through the real ingest interface
- [ ] **Phase 3: Live Dashboard** - Plant status, OEE, bale counts, current draw, stops
- [ ] **Phase 4: Shift Reports & Analysis** - Shift reports, historical reports, downtime Pareto, export
- [ ] **Phase 5: Administration & Demo Polish** - User/tenant/plant admin and demo seed

## Phase Details

### Phase 1: Foundation
**Goal**: A running multi-tenant app where users log in with roles and all plant data has a home
**Depends on**: Nothing (first phase)
**Requirements**: TENA-01, TENA-02, TENA-03, SIMU-01
**Success Criteria** (what must be TRUE):
  1. Next.js app runs locally with one command
  2. Seeded users can log in and only see their own tenant
  3. Operator, produksjonsleder, and admin see role-appropriate navigation
  4. Database schema exists for tenants, plants, machines, shifts, fractions, bale events, stop events, and time-series readings
  5. Every data table carries tenant scoping enforced in the data access layer (not per-query discipline)
**Plans**: 4 plans
- [x] 01-01-PLAN.md — Project foundation: deps, env, db connection singleton, drizzle config
- [x] 01-02-PLAN.md — Tenant-scoped schema (SIMU-01), migration, and demo seed
- [x] 01-03-PLAN.md — jose sessions, tenant-scoping DAL, login/logout, proxy route protection
- [x] 01-04-PLAN.md — Protected shell, role-based navigation, dashboard placeholder, E2E verify

### Phase 2: Simulator & Ingest
**Goal**: The demo plant produces 14 days of believable history and keeps running live
**Depends on**: Phase 1
**Requirements**: SIMU-02, SIMU-03, SIMU-04, SIMU-05, SIMU-06, SIMU-07, SIMU-08
**Success Criteria** (what must be TRUE):
  1. All simulated data enters through the ingest interface a future OPC UA adapter will implement
  2. 14 days of history exist: two shifts/day (07–15, 15–22), availability ~90% when computed
  3. Stops have realistic spread (many 2–10 min, a few longer) with HMI-style reasons
  4. Dosing bunker current draw shows refill/decay cycles; bunker-empty periods (~15 min after last refill) register as idle, not fault
  5. Bale events accumulate per fraction (Deink, Tetra/emballasjepapp, OCC, Miks) at plausible rates
  6. With the app running, new data appears continuously (live mode)
**Plans**: 4 plans
- [x] 02-01-PLAN.md — Ingest interface + SQLite adapter + WAL pragmas on app DB
- [x] 02-02-PLAN.md — TDD: pure state-machine engine (params, Oslo shift attribution, ~90% availability, idle≠fault)
- [x] 02-03-PLAN.md — Runner + db:simulate backfill (14 days through ingest) + verify-backfill.sh
- [x] 02-04-PLAN.md — Live mode via instrumentation.ts (catch-up + 60s tick) + verify-live.sh

### Phase 3: Live Dashboard
**Goal**: An operator sees what the plant is doing right now without walking the floor
**Depends on**: Phase 2
**Requirements**: DASH-01, DASH-02, DASH-03, DASH-04, DASH-05, DASH-06, DASH-07, DASH-08
**Success Criteria** (what must be TRUE):
  1. Dashboard shows live plant state: running / stopped with reason / running empty
  2. OEE for current shift is shown with A/P/Q breakdown and visible definition
  3. Bale counts per fraction shown for current shift and today
  4. Dosing bunker current-draw graph visualizes material level / empty detection
  5. Recent stops listed with start, duration, reason
  6. Dashboard updates automatically while the simulator runs
**Plans**: TBD during planning

### Phase 4: Shift Reports & Analysis
**Goal**: Produksjonsleder gets shift reports and historical analysis instead of guesswork
**Depends on**: Phase 3
**Requirements**: SHFT-01, SHFT-02, SHFT-03, RPRT-01, RPRT-02, RPRT-03, RPRT-04
**Success Criteria** (what must be TRUE):
  1. Any historical shift has a report: OEE, uptime, stops (count + total time), bales per fraction
  2. Data is attributed to the correct shift (07–15 / 15–22) automatically
  3. Day vs evening shifts comparable over a selected period
  4. Date-range report shows production totals, uptime, and OEE trend
  5. Downtime Pareto ranks stop reasons by total duration and count
  6. Report data exports to CSV
**Plans**: TBD during planning

### Phase 5: Administration & Demo Polish
**Goal**: The demo is self-contained: admins manage users/tenants/plants and the demo dataset sells the product
**Depends on**: Phase 4
**Requirements**: TENA-04, TENA-05, ADMN-01, ADMN-02, ADMN-03, ADMN-04
**Success Criteria** (what must be TRUE):
  1. Tenant admin can create/edit/deactivate users in own tenant
  2. System admin can create tenants and plants
  3. Plant config (fractions, shift times, nominal capacity, machines) editable in UI
  4. Demo seed creates "Steco Demo" tenant with the returpapir plant plus a second tenant proving isolation
  5. A full demo walkthrough (login as each role → dashboard → shift report → downtime analysis → admin) works without touching code
**Plans**: TBD during planning

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 4/4 | Complete | 2026-06-11 |
| 2. Simulator & Ingest | 4/4 | Complete | 2026-06-11 |
| 3. Live Dashboard | 0/? | Not started | - |
| 4. Shift Reports & Analysis | 0/? | Not started | - |
| 5. Administration & Demo Polish | 0/? | Not started | - |

---
*Roadmap created: 2026-06-11*
*Depth: quick (5 phases)*
*Coverage: 32/32 v1 requirements mapped*

# Requirements: StecoPro

**Defined:** 2026-06-11
**Core Value:** Plant owners see exactly what their sorting plant is doing — uptime, OEE, stops with reasons, and bales produced per fraction — without walking the floor or reading PLC logs.

## v1 Requirements (Technology Demo)

Requirements for the technology demo. Each maps to roadmap phases.

### Multi-tenant & Users

- [x] **TENA-01**: Users log in with email/password (seeded demo users)
- [x] **TENA-02**: All data is isolated per tenant; users only see their own tenant's plants
- [x] **TENA-03**: Roles with differentiated access: operator (view dashboards/shift reports), produksjonsleder (all reports + plant config), admin (user management), Steco system admin (tenant management)
- [ ] **TENA-04**: Tenant admin can create, edit, and deactivate users within own tenant
- [ ] **TENA-05**: System admin can create and manage tenants and their plants

### Data Model & Simulator

- [x] **SIMU-01**: Data model covers tenants, plants, machines, shifts, fractions, bale events, stop events (with reason), and time-series readings (current draw) — designed so an OPC UA adapter can replace the simulator
- [x] **SIMU-02**: Ingest interface (internal API) through which all plant data enters the system; simulator is just one producer
- [x] **SIMU-03**: Simulator generates 14 days of history: two shifts per day (07–15, 15–22), ~90% availability
- [x] **SIMU-04**: Stops follow realistic patterns: frequent small stops (2–10 min), occasional longer stops, each with an HMI-reported reason (e.g. driftsstans transportbånd, nødstopp, papirbrudd i presse, planlagt vedlikehold)
- [x] **SIMU-05**: Plant-runs-empty events: dosing bunker current draw decays toward idle; bunker empties ~15 min after last refill; empty time is tracked as idle, not as fault downtime
- [x] **SIMU-06**: Bale events per fraction (Deink, Tetra/emballasjepapp, OCC, Miks) with timestamp and press, at realistic rates
- [x] **SIMU-07**: Current-draw time series for key motors (dosing bunker, main conveyors, presses) at ~1 min resolution
- [x] **SIMU-08**: Live mode: simulator keeps producing data in near-real time so the dashboard moves during a demo

### Dashboard

- [ ] **DASH-01**: Live plant status: running / stopped (with current stop reason) / running empty
- [ ] **DASH-02**: OEE for current shift with availability/performance/quality breakdown and explicit definition
- [ ] **DASH-03**: Uptime for current shift and today
- [ ] **DASH-04**: Bale counts per fraction for current shift and today
- [ ] **DASH-05**: Current-draw graph for the dosing bunker showing material/empty detection
- [ ] **DASH-06**: Recent stops list: start, duration, reason
- [ ] **DASH-07**: Throughput vs nominal capacity indicator
- [ ] **DASH-08**: Dashboard auto-refreshes (near-real-time, polling acceptable)

### Shift Reports

- [ ] **SHFT-01**: Shift report per shift: OEE, uptime, stop count and total stop time, bales per fraction, energy indication
- [ ] **SHFT-02**: Shift boundaries fixed at 07–15 and 15–22; data attributed to the correct shift automatically
- [ ] **SHFT-03**: Compare shifts over a selected period (day vs evening)

### Reports & Analysis

- [ ] **RPRT-01**: Historical report for a date range: production totals, uptime, OEE trend
- [ ] **RPRT-02**: Downtime analysis: Pareto of stop reasons by total duration and count
- [ ] **RPRT-03**: Bale production per fraction over time (chart + table)
- [ ] **RPRT-04**: Export report data to CSV

### Administration

- [ ] **ADMN-01**: Plant configuration: fractions, shift times, nominal capacity, machine list
- [ ] **ADMN-02**: User management UI (per tenant)
- [ ] **ADMN-03**: Tenant management UI (system admin)
- [ ] **ADMN-04**: Demo seed: tenant "Steco Demo" with the returpapir plant + a second minimal tenant proving isolation

## v2 Requirements (First Production Version)

Deferred to production milestone. Tracked but not in current roadmap.

### Connectivity

- **OPCU-01**: OPC UA client adapter for Siemens S7-1500 replacing the simulator (same ingest interface)
- **OPCU-02**: Signal mapping configuration per plant (tag → machine/measurement)
- **OPCU-03**: Edge buffering / reconnect handling for unstable plant networks
- **REST-01**: REST connector framework for sorting machines (polling + webhook)

### Platform

- **PLAT-01**: Postgres/TimescaleDB for time-series storage
- **PLAT-02**: Alerting/notifications (e-stop, long stops, OEE below threshold)
- **PLAT-03**: Scheduled e-mail shift/day reports (PDF)
- **PLAT-04**: Audit log for admin actions
- **PLAT-05**: Energy reports (kWh per shift/tonne) from drive data

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| AI/vision material analysis | We track what the plant does, not material composition — differentiates from Greyparrot-style add-ons |
| Writing to / controlling PLC | Read-only platform; control belongs on HMI/SCADA |
| Predictive maintenance | Record and report first; predict later |
| Maintenance/inventory modules (à la Bollegraaf One) | Possible future milestone, not v1/v2 |
| Mobile app | Responsive web is sufficient |
| 3D plant visualization | Demo gimmick cost > value at this stage |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| TENA-01 | Phase 1 | Complete |
| TENA-02 | Phase 1 | Complete |
| TENA-03 | Phase 1 | Complete |
| TENA-04 | Phase 5 | Pending |
| TENA-05 | Phase 5 | Pending |
| SIMU-01 | Phase 1 | Complete |
| SIMU-02 | Phase 2 | Complete |
| SIMU-03 | Phase 2 | Complete |
| SIMU-04 | Phase 2 | Complete |
| SIMU-05 | Phase 2 | Complete |
| SIMU-06 | Phase 2 | Complete |
| SIMU-07 | Phase 2 | Complete |
| SIMU-08 | Phase 2 | Complete |
| DASH-01 | Phase 3 | Pending |
| DASH-02 | Phase 3 | Pending |
| DASH-03 | Phase 3 | Pending |
| DASH-04 | Phase 3 | Pending |
| DASH-05 | Phase 3 | Pending |
| DASH-06 | Phase 3 | Pending |
| DASH-07 | Phase 3 | Pending |
| DASH-08 | Phase 3 | Pending |
| SHFT-01 | Phase 4 | Pending |
| SHFT-02 | Phase 4 | Pending |
| SHFT-03 | Phase 4 | Pending |
| RPRT-01 | Phase 4 | Pending |
| RPRT-02 | Phase 4 | Pending |
| RPRT-03 | Phase 4 | Pending |
| RPRT-04 | Phase 4 | Pending |
| ADMN-01 | Phase 5 | Pending |
| ADMN-02 | Phase 5 | Pending |
| ADMN-03 | Phase 5 | Pending |
| ADMN-04 | Phase 5 | Pending |

**Coverage:**
- v1 requirements: 32 total
- Mapped to phases: 32 (100% coverage)
- Unmapped: 0

---
*Requirements defined: 2026-06-11*
*Last updated: 2026-06-11 after roadmap creation*

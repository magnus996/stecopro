# StecoPro

## What This Is

A production monitoring platform for waste sorting facilities — a competitor to Sutco ProDigit and Bollegraaf One. Plant operators, production managers, and admins get dashboards, shift reports, and downtime analysis built on data from the plant's Siemens S7-1500 PLCs (via OPC UA) and connected sorting machines (via REST APIs). First deliverable is a technology demo running on realistic mock data, architected so the simulator can be swapped for real OPC UA ingest in the first production version.

## Core Value

Plant owners see exactly what their sorting plant is doing — uptime, OEE, stops with reasons, and bales produced per fraction — without walking the floor or reading PLC logs.

## Requirements

### Validated

(None yet — demo to validate)

### Active

- [ ] Multi-tenant platform: each customer (tenant) sees only their own plants and data
- [ ] Users with roles: operator, production manager (produksjonsleder), admin
- [ ] Live dashboard: plant status, OEE, uptime, bale counts per fraction, current-draw graphs, recent stops
- [ ] Shift reports for two shifts (07–15 and 15–22) with KPIs per shift
- [ ] Historical reports: OEE/uptime trends, downtime Pareto by reason, bale production per fraction
- [ ] Mock-data simulator producing realistic plant behavior (~90% uptime, small stops, plant-runs-empty events, bale events)
- [ ] Data model and ingest interface designed so OPC UA replaces the simulator without rework

### Out of Scope

- AI/vision analysis of the actual material — we only track what the plant does, not what flows through it
- Writing to/controlling the PLC — platform is read-only; control stays on the HMI
- Predictive maintenance — v1 records and reports what happened
- Real OPC UA / REST connectivity in the demo — mock data only, but the interfaces must be real

## Context

**Demo scenario:** A Norwegian returpapir (recovered paper) sorting plant. The plant sorts paper into quality fractions that are baled:

- **Deink** (de-inking quality)
- **Tetra/emballasjepapp** (beverage carton / packaging board)
- **OCC** (old corrugated containers)
- **Miks** (mixed rest fraction)

Bales are counted per fraction — the PLC reports an event each time a bale press completes a bale.

**Operations:** Two shifts: day 07:00–15:00 and evening 15:00–22:00. Target test data shows ~90% uptime with scattered small stops and occasional longer ones.

**Plant signals (what the real plants expose):**
- Siemens S7-1500 PLCs with frequency drives and motor starters → motor current draw, run/stop states, emergency stops
- Downtime reasons: when the plant restarts after a stop, the operator selects a cause on the HMI panel; the PLC reports it
- Infeed material detection: current draw on the dosing bunker (doseringsbunker) motor indicates whether there is material in the infeed bunker. A full bunker runs empty in ~15 minutes if not refilled — "plant running empty" is tracked as idle time, distinct from fault stops
- Bale presses: PLC event per completed bale, tagged with fraction
- Sorting machines (e.g. optical sorters) can export data via REST API or similar — future connector

**OEE for a sorting plant:** Availability = run time vs planned shift time. Performance = actual throughput vs nominal capacity. Quality has no direct material measurement (no AI analysis), so the demo approximates it (configurable; e.g. share of prime fractions vs miks) and makes the definition explicit in the UI.

**Competitive reference:** Sutco ProDigit (production dashboards, shift reports, data center, process analytics) and Bollegraaf One (bunker management, OEE, asset/maintenance modules). StecoPro starts narrower: production logging, OEE, and reporting done well.

## Constraints

- **Demo data**: Mock/simulated only — no plant connectivity in the demo
- **Architecture**: Simulator must sit behind the same ingest interface a future OPC UA adapter will use
- **Demo plant**: One tenant with the returpapir plant above, plus a second tenant to prove isolation
- **Language**: UI in Norwegian (customers are Norwegian plant operators)
- **Hosting (demo)**: Runs locally with `npm run dev` / single Docker container — no cloud dependency

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Next.js (App Router) + TypeScript full-stack | One codebase for UI, API, and auth; clear path from demo to production | — Pending |
| SQLite for demo, schema portable to Postgres/Timescale | Zero-setup demo; time-series tables designed for later migration | — Pending |
| Simulator behind ingest interface | Mock data writes through the same API as future OPC UA adapter — swap, not rewrite | — Pending |
| OEE quality factor approximated and configurable | No material analysis in scope; honest, explicit definition beats fake precision | — Pending |
| Roles: operator < produksjonsleder < admin (+ Steco system admin) | Matches plant org structure; system admin manages tenants | — Pending |

---
*Last updated: 2026-06-11 after initialization*

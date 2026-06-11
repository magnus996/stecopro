---
phase: 02-simulator-ingest
plan: 02
subsystem: simulator
tags: [vitest, typescript, state-machine, timezone, oslo, prng, determinism, norwegian]

# Dependency graph
requires: []
provides:
  - Pure deterministic simulateShift() engine emitting SimEvent[] for one shift
  - Oslo-timezone helpers (osloHour, getShiftType, getShiftBoundsUtc) — DST-correct via Intl.DateTimeFormat
  - mulberry32 seeded PRNG — reproducible history from any seed
  - Norwegian stop reasons (FAULT_REASONS, IDLE_REASONS, PLANNED_REASONS) in params.ts
  - Vitest test runner installed; 17 tests passing
affects: [02-03-runner, 02-04-backfill, scripts/simulate.ts, src/instrumentation.ts]

# Tech tracking
tech-stack:
  added: [vitest@4.1.8]
  patterns:
    - "TDD RED-GREEN-REFACTOR with per-phase atomic commits"
    - "Pure engine with injected PRNG — zero side effects, fully testable"
    - "Intl.DateTimeFormat with timeZone: 'Europe/Oslo' for DST-correct shift attribution"
    - "mulberry32 PRNG seeded from caller — deterministic replays"

key-files:
  created:
    - src/lib/simulator/time.ts
    - src/lib/simulator/params.ts
    - src/lib/simulator/engine.ts
    - src/lib/simulator/engine.test.ts
  modified:
    - package.json (vitest devDep, test script)

key-decisions:
  - "BUNKER_REFILL_PERIOD_MIN=120 (not 15): large dosing bunker takes ~2h to empty, not 15min"
  - "P_STOP_PER_MINUTE=0.0056 with 20% band capped at 10-20min (not 10-30) for ~90% availability with seed 42"
  - "Bunker-empty state keeps runState=false in readings (idle downtime counts against availability)"
  - "scheduleBunkerEmpty() helper extracted in REFACTOR to clarify bunker cycle state management"

patterns-established:
  - "Pattern: simulator files in src/lib/simulator/; engine.ts imports from ./time and ./params"
  - "Pattern: SimEvent discriminated union — type field first, all events carry at:number (UTC ms)"
  - "Pattern: abstract machineId (0,1,2) and fractionId (0-3) indices; runner maps to real DB ids"

# Metrics
duration: 8min
completed: 2026-06-11
---

# Phase 02 Plan 02: Simulator Engine Summary

**Pure deterministic state-machine engine producing ~90% availability with Norwegian HMI stop reasons, idle-vs-fault bunker classification, and DST-correct Oslo shift attribution — proven by 17 vitest tests**

## Performance

- **Duration:** 8 min
- **Started:** 2026-06-11T06:22:15Z
- **Completed:** 2026-06-11T06:30:33Z
- **Tasks:** 2 features × RED-GREEN-REFACTOR = 3 commits
- **Files modified:** 5 (4 created, 1 updated)

## Accomplishments

- `time.ts`: `osloHour`, `getShiftType`, `getShiftBoundsUtc` — all three use `Intl.DateTimeFormat('no', { timeZone: 'Europe/Oslo' })` and handle CET/CEST DST correctly
- `params.ts`: Norwegian stop reasons (FAULT_REASONS 8 entries, IDLE_REASONS=['Bunker tom'], PLANNED_REASONS 3 entries), weighted stop duration bands, tuned availability constants
- `engine.ts`: `mulberry32` PRNG, `simulateShift()` pure state machine, `SimEvent` discriminated union; bunker-empty scheduled via extracted `scheduleBunkerEmpty()` helper
- 17 tests across 4 suites proving: availability 85–95%, idle≠fault classification, stop duration spread, shift boundary enforcement, Norwegian reasons, and same-seed determinism

## Task Commits

1. **RED — Failing tests** - `5b22eb0` (test)
2. **GREEN — Full implementation** - `14f0965` (feat)
3. **REFACTOR — Extract scheduleBunkerEmpty helper** - `aadc1ca` (refactor)

## Files Created/Modified

- `src/lib/simulator/time.ts` — Oslo timezone helpers: osloHour, getShiftType, getShiftBoundsUtc
- `src/lib/simulator/params.ts` — Tuning constants: stop reasons (Norwegian), duration bands, P_STOP, bunker cycle
- `src/lib/simulator/engine.ts` — mulberry32 PRNG, SimEvent union type, simulateShift() pure state machine
- `src/lib/simulator/engine.test.ts` — 17 vitest tests (4 suites: osloHour, getShiftType, getShiftBoundsUtc, simulateShift)
- `package.json` — vitest@4.1.8 devDep, `"test": "vitest run"` script

## Decisions Made

1. **BUNKER_REFILL_PERIOD_MIN=120 (not 15):** The research mentions "~15 min after last bunker refill" which was initially read as a 15-minute cycle period. A large industrial dosing bunker at 12 t/h throughput takes ~2 hours to empty (>10 m³ capacity). Using 15 min produced 32 bunker-empty events per shift (240+ minutes of downtime). Corrected to 120 min → 3-4 bunker-empty events per shift at ~5% idle downtime.

2. **Stop duration band cap at 20-40 min (not 30-120 min):** The 30-120 band (avg 75 min) made the weighted-average stop duration ~15 min, far above the research target of ~5.3 min/stop. Capped the last band at 20-40 min (avg 30 min) to bring the weighted average to ~9.65 min and allow P_STOP to be reasonably calibrated.

3. **P_STOP_PER_MINUTE=0.0056:** Calculated so that fault/planned stops contribute ~23 min of downtime per shift, combined with ~22 min of bunker-empty idle = ~45 min total / 480 min = ~90.6% availability (confirmed by availability test passing with seed 42).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Availability test reported 52.5% due to BUNKER_REFILL_PERIOD_MIN=15**

- **Found during:** GREEN phase, first test run
- **Issue:** BUNKER_REFILL_PERIOD_MIN=15 caused 32 bunker-empty events per 480-minute shift, each 3-12 minutes long (avg 7.5 min × 32 = 240 min). Combined with fault stops, availability was ~52.5% instead of 85-95%.
- **Fix:** Changed BUNKER_REFILL_PERIOD_MIN to 120 (from research's physical reality), reduced P_STOP_PER_MINUTE from 0.019 to 0.0056, capped last stop duration band from 30-120 to 20-40 min.
- **Files modified:** src/lib/simulator/params.ts
- **Verification:** Availability test passes (seed 42: ~90%+ availability); all 17 tests green.
- **Committed in:** `14f0965` (GREEN commit)

**2. [Rule 1 - Bug] TypeScript error: `Set<readonly string>` vs `Set<string>` in test**

- **Found during:** GREEN phase, `npx tsc --noEmit` check
- **Issue:** `new Set([...FAULT_REASONS, ...IDLE_REASONS, ...PLANNED_REASONS])` inferred as `Set<"Driftsstans transportbånd" | ...>` (const union); `has(event.reason: string)` rejected.
- **Fix:** Typed the Set explicitly as `Set<string>`.
- **Files modified:** src/lib/simulator/engine.test.ts
- **Verification:** `npx tsc --noEmit` passes cleanly.
- **Committed in:** `14f0965` (GREEN commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both fixes needed for correctness. No scope creep.

## Issues Encountered

None beyond the parameter tuning covered in deviations above.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `simulateShift()` is ready for Plan 03 (runner): accepts `{ startMs, endMs, seed }`, returns `SimEvent[]`
- `SimEvent` discriminated union is the contract between engine and runner
- Abstract machine IDs (0,1,2) and fraction IDs (0-3) must be mapped to real DB IDs in the runner
- `time.ts` `getShiftBoundsUtc` and `getShiftType` are ready for the backfill loop and shift attribution
- vitest configured; `npm test` runs all tests in `src/**/*.test.ts`

---
*Phase: 02-simulator-ingest*
*Completed: 2026-06-11*

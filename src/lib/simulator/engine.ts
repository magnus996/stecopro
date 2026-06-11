/**
 * Pure, deterministic time-walking state machine for the plant simulator.
 * No I/O, no Date.now(), no Math.random() — all randomness flows through
 * the injected seeded PRNG (mulberry32).
 *
 * simulateShift(input) -> SimEvent[]
 */

import {
  FAULT_REASONS,
  IDLE_REASONS,
  PLANNED_REASONS,
  STOP_DURATION_BANDS,
  STOP_DURATION_WEIGHTS,
  P_STOP_PER_MINUTE,
  BUNKER_REFILL_PERIOD_MIN,
  BUNKER_EMPTY_MIN_MIN,
  BUNKER_EMPTY_MAX_MIN,
  CURRENT_BUNKER_FULL_MIN,
  CURRENT_BUNKER_FULL_MAX,
  CURRENT_BUNKER_EMPTY_MIN,
  CURRENT_BUNKER_EMPTY_MAX,
  CURRENT_CONVEYOR_RUN_MIN,
  CURRENT_CONVEYOR_RUN_MAX,
  CURRENT_PRESS_PEAK_MIN,
  CURRENT_PRESS_PEAK_MAX,
  BALE_RATES_PER_SHIFT,
} from './params'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SimEvent =
  | { type: 'reading'; machineId: number; at: number; currentA: number; runState: boolean }
  | { type: 'stop'; at: number; reason: string; stopType: 'fault' | 'idle' | 'planned' }
  | { type: 'stopEnd'; at: number }
  | { type: 'bale'; fractionId: number; at: number }

// Plant operational state
type PlantState =
  | 'running'
  | 'stopped'   // fault or planned stop
  | 'bunker-empty' // idle stopType

export interface SimulateShiftInput {
  startMs: number
  endMs: number
  seed: number
}

// ---------------------------------------------------------------------------
// Seeded PRNG: mulberry32
// Simple, fast, no dependencies. Produces reproducible sequences from a seed.
// ---------------------------------------------------------------------------

export function mulberry32(seed: number): () => number {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ---------------------------------------------------------------------------
// Pure helpers — no side effects, only operate on the rng and return values
// ---------------------------------------------------------------------------

/** Pick a random integer in [min, max] inclusive. */
function randInt(rng: () => number, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1))
}

/** Pick a random float in [min, max]. */
function randFloat(rng: () => number, min: number, max: number): number {
  return min + rng() * (max - min)
}

/**
 * Sample a stop duration (in minutes) from the weighted band distribution.
 * Uses STOP_DURATION_BANDS and STOP_DURATION_WEIGHTS from params.
 */
function sampleStopDuration(rng: () => number): number {
  const r = rng()
  let cumulative = 0
  for (let i = 0; i < STOP_DURATION_WEIGHTS.length; i++) {
    cumulative += STOP_DURATION_WEIGHTS[i]
    if (r < cumulative) {
      const [min, max] = STOP_DURATION_BANDS[i]
      return randInt(rng, min, max)
    }
  }
  // Fallback: last band (should not reach here with valid weights)
  const [min, max] = STOP_DURATION_BANDS[STOP_DURATION_BANDS.length - 1]
  return randInt(rng, min, max)
}

/**
 * Pick a random fault (85%) or planned (15%) stop reason.
 * All strings are Norwegian HMI-style.
 */
function pickFaultOrPlannedReason(rng: () => number): { reason: string; stopType: 'fault' | 'planned' } {
  if (rng() < 0.85) {
    const idx = Math.floor(rng() * FAULT_REASONS.length)
    return { reason: FAULT_REASONS[idx], stopType: 'fault' }
  }
  const idx = Math.floor(rng() * PLANNED_REASONS.length)
  return { reason: PLANNED_REASONS[idx], stopType: 'planned' }
}

/**
 * Schedule the next bunker-empty event after a refill at `refillMinute`.
 * Returns { startMinute, endMinute } or null if it falls outside the shift.
 */
function scheduleBunkerEmpty(
  rng: () => number,
  refillMinute: number,
  totalMinutes: number
): { startMinute: number; endMinute: number } | null {
  const startMinute = refillMinute + BUNKER_REFILL_PERIOD_MIN
  if (startMinute >= totalMinutes) return null
  const duration = randInt(rng, BUNKER_EMPTY_MIN_MIN, BUNKER_EMPTY_MAX_MIN)
  return { startMinute, endMinute: startMinute + duration }
}

// ---------------------------------------------------------------------------
// Main engine
// ---------------------------------------------------------------------------

/**
 * Walk the shift minute-by-minute, emitting SimEvents.
 * The shift runs from startMs to endMs (exclusive).
 * Readings are emitted at each minute mark (startMs, startMs+60000, ...).
 * Machine IDs are abstract indices (0=bunker, 1=conveyor, 2=press).
 * Fraction IDs are abstract indices (0=deink, 1=occ, 2=tetra, 3=miks).
 */
export function simulateShift(input: SimulateShiftInput): SimEvent[] {
  const { startMs, endMs, seed } = input
  const rng = mulberry32(seed)
  const events: SimEvent[] = []

  const shiftDurationMs = endMs - startMs
  const totalMinutes = Math.floor(shiftDurationMs / 60000)

  // ---- Bale rate setup ----
  // Abstract fractions: 0=deink(40/shift), 1=occ(8/shift), 2=tetra(6/shift), 3=miks(26/shift)
  // Engine order [deink, occ, tetra, miks] matches runner.ts ABSTRACT_FRACTION_NAMES.
  const baleRates = [
    BALE_RATES_PER_SHIFT.deink,
    BALE_RATES_PER_SHIFT.occ,
    BALE_RATES_PER_SHIFT.tetra,
    BALE_RATES_PER_SHIFT.miks,
  ]
  // Convert to per-minute probabilities for each fraction
  const baleProbabilities = baleRates.map(r => r / totalMinutes)

  // ---- State machine ----
  let state: PlantState = 'running'
  let stopEndMinute = 0   // minute when current fault/planned stop ends

  // Schedule first bunker empty: starts BUNKER_REFILL_PERIOD_MIN minutes into the shift
  let nextBunker = scheduleBunkerEmpty(rng, 0, totalMinutes)

  for (let minute = 0; minute < totalMinutes; minute++) {
    const atMs = startMs + minute * 60000

    // ---- Handle bunker-empty start ----
    if (nextBunker && state === 'running' && minute === nextBunker.startMinute) {
      state = 'bunker-empty'
      events.push({ type: 'stop', at: atMs, reason: IDLE_REASONS[0], stopType: 'idle' })
    }

    // ---- Handle bunker-empty end ----
    if (state === 'bunker-empty' && nextBunker && minute >= nextBunker.endMinute) {
      state = 'running'
      events.push({ type: 'stopEnd', at: atMs })
      // Schedule next bunker-empty from this refill point
      nextBunker = scheduleBunkerEmpty(rng, minute, totalMinutes)
    }

    // ---- Handle fault/planned stop end ----
    if (state === 'stopped' && minute >= stopEndMinute) {
      state = 'running'
      events.push({ type: 'stopEnd', at: atMs })
    }

    // ---- Possibly start a new fault/planned stop ----
    if (state === 'running' && rng() < P_STOP_PER_MINUTE) {
      const durationMin = sampleStopDuration(rng)
      const endMinute = Math.min(minute + durationMin, totalMinutes - 1)
      if (endMinute > minute) {
        const { reason, stopType } = pickFaultOrPlannedReason(rng)
        state = 'stopped'
        stopEndMinute = endMinute
        events.push({ type: 'stop', at: atMs, reason, stopType })
      }
    }

    // ---- Emit readings (one per abstract machine) ----
    const isRunning = state === 'running'
    const isBunkerEmpty = state === 'bunker-empty'

    // Machine 0: bunker
    const bunkerCurrent = isBunkerEmpty
      ? randFloat(rng, CURRENT_BUNKER_EMPTY_MIN, CURRENT_BUNKER_EMPTY_MAX)
      : isRunning
      ? randFloat(rng, CURRENT_BUNKER_FULL_MIN, CURRENT_BUNKER_FULL_MAX)
      : 0
    events.push({
      type: 'reading',
      machineId: 0,
      at: atMs,
      currentA: bunkerCurrent,
      runState: isRunning,
    })

    // Machine 1: conveyor
    const conveyorCurrent = isRunning ? randFloat(rng, CURRENT_CONVEYOR_RUN_MIN, CURRENT_CONVEYOR_RUN_MAX) : 0
    events.push({
      type: 'reading',
      machineId: 1,
      at: atMs,
      currentA: conveyorCurrent,
      runState: isRunning,
    })

    // Machine 2: press
    const pressCurrent = isRunning ? randFloat(rng, CURRENT_PRESS_PEAK_MIN, CURRENT_PRESS_PEAK_MAX) : 0
    events.push({
      type: 'reading',
      machineId: 2,
      at: atMs,
      currentA: pressCurrent,
      runState: isRunning,
    })

    // ---- Emit bale events (only when running) ----
    if (isRunning) {
      for (let fi = 0; fi < baleProbabilities.length; fi++) {
        if (rng() < baleProbabilities[fi]) {
          events.push({ type: 'bale', fractionId: fi, at: atMs })
        }
      }
    }
  }

  return events
}

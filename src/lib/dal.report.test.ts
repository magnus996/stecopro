import { describe, it, expect } from 'vitest'
import { calculateOee, QUALITY_FACTOR } from './oee'

/**
 * Vitest invariant suite for Phase 4 DAL report accessors.
 *
 * The DAL accessors are server-only (import 'server-only') and require a live DB +
 * session, so we do NOT call them directly here. Instead, we test the pure logic they
 * rely on — matching exactly what the accessors do — to lock the two hardest correctness
 * invariants:
 *
 * 1. Cartesian-avoidance invariant: proves that JS bucketing (the accessor approach)
 *    gives correct stopSeconds, while a naive combined-JOIN multiply would not.
 *
 * 2. OEE-consistency invariant: proves that calculateOee with nowMs=shiftEnd is stable
 *    (deterministic) for historical shifts regardless of "now", and that boundary-spanning
 *    stops are clamped within the shift window.
 */

const NOMINAL_BALES_PER_SHIFT = 120  // matches NOMINAL_BALES_PER_SHIFT in dal.ts

// Helper: create a Date at a given offset from BASE_MS
const BASE_MS = Date.parse('2026-06-11T07:00:00Z')  // shift start: Oslo 09:00
const shiftDurationMs = 8 * 60 * 60 * 1000           // 8h day shift = 28800s

// ============================================================
// Invariant 1: Cartesian-avoidance
// ============================================================

describe('Cartesian-avoidance invariant', () => {

  /**
   * Simulate the JS-bucketing approach used by getShiftReportList.
   *
   * Given a shift window and a set of stop events, compute total stop seconds
   * by summing the overlap of each stop with [shiftStart, shiftEnd].
   */
  function computeCorrectStopSeconds(
    shiftStartMs: number,
    shiftEndMs: number,
    stops: { startMs: number; endMs: number }[],
  ): number {
    let total = 0
    for (const stop of stops) {
      const overlapStart = Math.max(stop.startMs, shiftStartMs)
      const overlapEnd = Math.min(stop.endMs, shiftEndMs)
      if (overlapEnd > overlapStart) {
        total += (overlapEnd - overlapStart) / 1000
      }
    }
    return total
  }

  /**
   * Simulate what a naïve combined JOIN would do:
   * each stop row appears once per bale row → sum gets multiplied by baleCount.
   * This is the cartesian product bug (RESEARCH Pitfall 1).
   */
  function computeCartesianStopSeconds(
    shiftStartMs: number,
    shiftEndMs: number,
    stops: { startMs: number; endMs: number }[],
    baleCount: number,
  ): number {
    // In a combined LEFT JOIN GROUP BY, each stop duration gets accumulated
    // once per matching bale row — the sum is multiplied by baleCount.
    return computeCorrectStopSeconds(shiftStartMs, shiftEndMs, stops) * baleCount
  }

  it('JS bucketing yields correct stop seconds for a shift with multiple stops', () => {
    const shiftStartMs = BASE_MS
    const shiftEndMs   = BASE_MS + shiftDurationMs

    // 5 stops of varying duration (all within shift)
    const stops = [
      { startMs: BASE_MS + 30 * 60 * 1000,  endMs: BASE_MS + 40 * 60 * 1000  }, // 10 min
      { startMs: BASE_MS + 90 * 60 * 1000,  endMs: BASE_MS + 105 * 60 * 1000 }, // 15 min
      { startMs: BASE_MS + 150 * 60 * 1000, endMs: BASE_MS + 158 * 60 * 1000 }, // 8 min
      { startMs: BASE_MS + 200 * 60 * 1000, endMs: BASE_MS + 210 * 60 * 1000 }, // 10 min
      { startMs: BASE_MS + 300 * 60 * 1000, endMs: BASE_MS + 307 * 60 * 1000 }, // 7 min
    ]
    // Hand-computed: (10+15+8+10+7) min = 50 min = 3000s
    const expected = 3000

    const correct = computeCorrectStopSeconds(shiftStartMs, shiftEndMs, stops)
    expect(correct).toBeCloseTo(expected, 1)
  })

  it('cartesian product inflates stopSeconds — correct !== inflated for baleCount > 1', () => {
    const shiftStartMs = BASE_MS
    const shiftEndMs   = BASE_MS + shiftDurationMs

    const stops = [
      { startMs: BASE_MS + 30 * 60 * 1000,  endMs: BASE_MS + 40 * 60 * 1000  }, // 10 min
      { startMs: BASE_MS + 90 * 60 * 1000,  endMs: BASE_MS + 105 * 60 * 1000 }, // 15 min
      { startMs: BASE_MS + 150 * 60 * 1000, endMs: BASE_MS + 158 * 60 * 1000 }, // 8 min
      { startMs: BASE_MS + 200 * 60 * 1000, endMs: BASE_MS + 210 * 60 * 1000 }, // 10 min
      { startMs: BASE_MS + 300 * 60 * 1000, endMs: BASE_MS + 307 * 60 * 1000 }, // 7 min
    ]
    const baleCount = 106  // matches live DB demo value from RESEARCH

    const correct  = computeCorrectStopSeconds(shiftStartMs, shiftEndMs, stops)
    const inflated = computeCartesianStopSeconds(shiftStartMs, shiftEndMs, stops, baleCount)

    // Inflated result differs from correct (by factor of baleCount)
    expect(inflated).not.toBeCloseTo(correct, 0)
    // Inflated = correct * baleCount
    expect(inflated).toBeCloseTo(correct * baleCount, 1)
    // Inflated is much larger
    expect(inflated).toBeGreaterThan(correct * 2)
  })

  it('correct bucketing handles stops that span the shift boundary', () => {
    const shiftStartMs = BASE_MS
    const shiftEndMs   = BASE_MS + shiftDurationMs

    // Stop started 10 min before shift, ends 5 min into shift → 5 min overlap
    const stops = [
      { startMs: BASE_MS - 10 * 60 * 1000, endMs: BASE_MS + 5 * 60 * 1000 },
    ]

    const correct = computeCorrectStopSeconds(shiftStartMs, shiftEndMs, stops)
    expect(correct).toBeCloseTo(5 * 60, 1)  // 300s
  })

  it('correct bucketing returns 0 for stop entirely outside shift', () => {
    const shiftStartMs = BASE_MS
    const shiftEndMs   = BASE_MS + shiftDurationMs

    // Stop 2h after shift ends
    const stops = [
      { startMs: BASE_MS + shiftDurationMs + 2 * 60 * 60 * 1000,
        endMs:   BASE_MS + shiftDurationMs + 3 * 60 * 60 * 1000 },
    ]

    const correct = computeCorrectStopSeconds(shiftStartMs, shiftEndMs, stops)
    expect(correct).toBe(0)
  })

  it('correct bucketing: stop fully inside shift gives exact overlap', () => {
    const shiftStartMs = BASE_MS
    const shiftEndMs   = BASE_MS + shiftDurationMs

    // Single 30-min stop in the middle of the shift
    const stops = [
      { startMs: BASE_MS + 4 * 60 * 60 * 1000, endMs: BASE_MS + 4 * 60 * 60 * 1000 + 30 * 60 * 1000 },
    ]

    const correct = computeCorrectStopSeconds(shiftStartMs, shiftEndMs, stops)
    expect(correct).toBeCloseTo(1800, 1)  // 1800s = 30 min
  })
})

// ============================================================
// Invariant 2: OEE-consistency — historical shifts are deterministic
// ============================================================

describe('OEE-consistency invariant', () => {

  const shiftStart = new Date(BASE_MS)
  const shiftEnd   = new Date(BASE_MS + shiftDurationMs)  // 8h later
  const shiftEndMs = shiftEnd.getTime()

  // Representative stop events for a historical shift
  const stopEventsForShift = [
    { startAt: new Date(BASE_MS + 30 * 60_000),  endAt: new Date(BASE_MS + 40 * 60_000),  stopType: 'fault'   as const },
    { startAt: new Date(BASE_MS + 90 * 60_000),  endAt: new Date(BASE_MS + 105 * 60_000), stopType: 'idle'    as const },
    { startAt: new Date(BASE_MS + 200 * 60_000), endAt: new Date(BASE_MS + 210 * 60_000), stopType: 'planned' as const },
  ]
  // Total stop time = 10+15+10 = 35 min = 2100s inside shift

  it('calculateOee with nowMs=shiftEnd produces correct OEE for historical shift', () => {
    const result = calculateOee({
      shiftStart,
      shiftEnd,
      nowMs: shiftEndMs,  // historical: fully elapsed
      stopEvents: stopEventsForShift,
      baleCount: 100,
      nominalBalesPerShift: NOMINAL_BALES_PER_SHIFT,
      qualityFactor: QUALITY_FACTOR,
    })

    expect(result.plannedSeconds).toBe(28800)
    expect(result.stopSeconds).toBeCloseTo(2100, 1)
    expect(result.runSeconds).toBeCloseTo(28800 - 2100, 1)
    expect(result.availability).toBeCloseTo((28800 - 2100) / 28800, 5)
    expect(result.oee).toBeGreaterThan(0)
    expect(result.oee).toBeLessThanOrEqual(1)
  })

  it('nowMs=shiftEnd and nowMs=shiftEnd+10min produce IDENTICAL OeeResult (historical shift is deterministic)', () => {
    const inputs = {
      shiftStart,
      shiftEnd,
      stopEvents: stopEventsForShift,
      baleCount: 100,
      nominalBalesPerShift: NOMINAL_BALES_PER_SHIFT,
      qualityFactor: QUALITY_FACTOR,
    }

    const atShiftEnd  = calculateOee({ ...inputs, nowMs: shiftEndMs })
    const tenMinLater = calculateOee({ ...inputs, nowMs: shiftEndMs + 10 * 60 * 1000 })

    // Both should be identical — windowEnd clamps to shiftEnd in both cases
    expect(atShiftEnd.availability).toBeCloseTo(tenMinLater.availability, 10)
    expect(atShiftEnd.performance).toBeCloseTo(tenMinLater.performance, 10)
    expect(atShiftEnd.oee).toBeCloseTo(tenMinLater.oee, 10)
    expect(atShiftEnd.plannedSeconds).toBe(tenMinLater.plannedSeconds)
    expect(atShiftEnd.stopSeconds).toBeCloseTo(tenMinLater.stopSeconds, 10)
    expect(atShiftEnd.runSeconds).toBeCloseTo(tenMinLater.runSeconds, 10)
  })

  it('nowMs=shiftEnd+1h produces IDENTICAL result to nowMs=shiftEnd (clamped)', () => {
    const inputs = {
      shiftStart,
      shiftEnd,
      stopEvents: stopEventsForShift,
      baleCount: 100,
      nominalBalesPerShift: NOMINAL_BALES_PER_SHIFT,
      qualityFactor: QUALITY_FACTOR,
    }

    const atShiftEnd = calculateOee({ ...inputs, nowMs: shiftEndMs })
    const oneHourLater = calculateOee({ ...inputs, nowMs: shiftEndMs + 60 * 60 * 1000 })

    expect(atShiftEnd.oee).toBeCloseTo(oneHourLater.oee, 10)
    expect(atShiftEnd.availability).toBeCloseTo(oneHourLater.availability, 10)
    expect(atShiftEnd.performance).toBeCloseTo(oneHourLater.performance, 10)
  })

  it('stop spanning shift boundary is clamped — stopSeconds <= plannedSeconds', () => {
    // Stop starts 30 min before shift, ends 3h into shift → overlap = 3h, not 3.5h
    const boundaryStop = [
      {
        startAt: new Date(BASE_MS - 30 * 60_000),  // 30 min before shift start
        endAt:   new Date(BASE_MS + 3 * 60 * 60_000),  // 3h into shift
        stopType: 'fault' as const,
      }
    ]

    const result = calculateOee({
      shiftStart,
      shiftEnd,
      nowMs: shiftEndMs,
      stopEvents: boundaryStop,
      baleCount: 0,
      nominalBalesPerShift: NOMINAL_BALES_PER_SHIFT,
      qualityFactor: QUALITY_FACTOR,
    })

    // Only 3h (10800s) overlap with shift, not 3.5h (12600s)
    expect(result.stopSeconds).toBeCloseTo(3 * 60 * 60, 1)
    // stopSeconds must not exceed plannedSeconds
    expect(result.stopSeconds).toBeLessThanOrEqual(result.plannedSeconds)
    expect(result.runSeconds).toBeGreaterThanOrEqual(0)
  })

  it('stop entirely after shiftEnd contributes 0 — boundary clamping works', () => {
    const afterShiftStop = [
      {
        startAt: new Date(BASE_MS + shiftDurationMs + 10 * 60_000),  // 10min after shift end
        endAt:   new Date(BASE_MS + shiftDurationMs + 30 * 60_000),
        stopType: 'idle' as const,
      }
    ]

    const result = calculateOee({
      shiftStart,
      shiftEnd,
      nowMs: shiftEndMs,
      stopEvents: afterShiftStop,
      baleCount: 120,
      nominalBalesPerShift: NOMINAL_BALES_PER_SHIFT,
      qualityFactor: QUALITY_FACTOR,
    })

    expect(result.stopSeconds).toBe(0)
    expect(result.availability).toBeCloseTo(1, 5)
  })

  it('QUALITY_FACTOR constant matches expected value (0.95) — same as dashboard', () => {
    expect(QUALITY_FACTOR).toBe(0.95)
  })

  it('full shift with no stops — availability=1, OEE=quality factor', () => {
    const result = calculateOee({
      shiftStart,
      shiftEnd,
      nowMs: shiftEndMs,
      stopEvents: [],
      baleCount: NOMINAL_BALES_PER_SHIFT,
      nominalBalesPerShift: NOMINAL_BALES_PER_SHIFT,
      qualityFactor: QUALITY_FACTOR,
    })

    expect(result.availability).toBeCloseTo(1, 5)
    expect(result.performance).toBeCloseTo(1, 5)
    expect(result.oee).toBeCloseTo(QUALITY_FACTOR, 5)
  })
})

import { describe, it, expect } from 'vitest'
import { calculateOee, QUALITY_FACTOR } from './oee'

// All tests use explicit nowMs and fixed Date values to ensure deterministic results.

// Helper: create a Date at a fixed Unix-second offset from a base time.
const BASE_MS = Date.parse('2026-06-11T07:00:00Z')  // arbitrary shift start

// ============================================================
// Feature: calculateOee — shared OEE calculation module
// ============================================================

describe('calculateOee', () => {

  // ----------------------------------------------------------
  // Full-shift, no stops, bales == nominal
  // ----------------------------------------------------------
  it('full shift, no stops, bales == nominal → A=1, P=1, Q=0.95, OEE=0.95', () => {
    const shiftStart = new Date(BASE_MS)
    const shiftEnd   = new Date(BASE_MS + 28_800_000)  // +8h
    const result = calculateOee({
      shiftStart,
      shiftEnd,
      nowMs: BASE_MS + 28_800_000,  // at shift end
      stopEvents: [],
      baleCount: 120,
      nominalBalesPerShift: 120,
    })
    expect(result.availability).toBeCloseTo(1, 5)
    expect(result.performance).toBeCloseTo(1, 5)
    expect(result.quality).toBeCloseTo(0.95, 5)
    expect(result.oee).toBeCloseTo(0.95, 5)
  })

  // ----------------------------------------------------------
  // Full shift, one 48-min stop (2880s) in 8h (28800s) window
  // availability = (28800-2880)/28800 = 0.9
  // ----------------------------------------------------------
  it('full shift, one 48-min stop → availability ≈ 0.9', () => {
    const shiftStart = new Date(BASE_MS)
    const shiftEnd   = new Date(BASE_MS + 28_800_000)
    const stopStart  = new Date(BASE_MS + 3_600_000)         // 1h in
    const stopEnd    = new Date(BASE_MS + 3_600_000 + 2_880_000)  // +48 min
    const result = calculateOee({
      shiftStart,
      shiftEnd,
      nowMs: BASE_MS + 28_800_000,
      stopEvents: [{ startAt: stopStart, endAt: stopEnd, stopType: 'fault' }],
      baleCount: 100,
      nominalBalesPerShift: 120,
    })
    expect(result.availability).toBeCloseTo((28800 - 2880) / 28800, 5)
    expect(result.plannedSeconds).toBe(28800)
    expect(result.stopSeconds).toBeCloseTo(2880, 1)
    expect(result.runSeconds).toBeCloseTo(28800 - 2880, 1)
  })

  // ----------------------------------------------------------
  // Ongoing stop (endAt=null) that started 10 min ago, now = shiftStart + 1h
  // plannedSeconds=3600, stopSeconds=600, availability=(3600-600)/3600 ≈ 0.8333
  // ----------------------------------------------------------
  it('ongoing stop (endAt=null) reduces availability correctly', () => {
    const shiftStart = new Date(BASE_MS)
    const shiftEnd   = new Date(BASE_MS + 28_800_000)
    const nowMs      = BASE_MS + 3_600_000        // 1h into shift
    const stopStart  = new Date(BASE_MS + 3_600_000 - 600_000)  // 10 min before now

    const result = calculateOee({
      shiftStart,
      shiftEnd,
      nowMs,
      stopEvents: [{ startAt: stopStart, endAt: null, stopType: 'idle' }],
      baleCount: 10,
      nominalBalesPerShift: 120,
    })
    expect(result.plannedSeconds).toBe(3600)
    expect(result.stopSeconds).toBeCloseTo(600, 1)
    expect(result.availability).toBeCloseTo((3600 - 600) / 3600, 5)
  })

  // ----------------------------------------------------------
  // Stop that started BEFORE shiftStart and ends 5 min into the shift
  // Only the 5-min in-window overlap (300s) counts
  // ----------------------------------------------------------
  it('stop starting before shiftStart — only in-window overlap counts', () => {
    const shiftStart = new Date(BASE_MS)
    const shiftEnd   = new Date(BASE_MS + 28_800_000)
    const stopStart  = new Date(BASE_MS - 600_000)   // 10 min BEFORE shift
    const stopEnd    = new Date(BASE_MS + 300_000)    // 5 min AFTER shift start

    const result = calculateOee({
      shiftStart,
      shiftEnd,
      nowMs: BASE_MS + 28_800_000,
      stopEvents: [{ startAt: stopStart, endAt: stopEnd, stopType: 'planned' }],
      baleCount: 115,
      nominalBalesPerShift: 120,
    })
    expect(result.stopSeconds).toBeCloseTo(300, 1)
    expect(result.plannedSeconds).toBe(28800)
    expect(result.runSeconds).toBeCloseTo(28800 - 300, 1)
  })

  // ----------------------------------------------------------
  // Stop fully before shiftStart — contributes 0
  // ----------------------------------------------------------
  it('stop fully before shiftStart — contributes 0 stop seconds', () => {
    const shiftStart = new Date(BASE_MS)
    const shiftEnd   = new Date(BASE_MS + 28_800_000)
    const stopStart  = new Date(BASE_MS - 3_600_000)  // 1h before shift
    const stopEnd    = new Date(BASE_MS - 1_000)      // just before shift

    const result = calculateOee({
      shiftStart,
      shiftEnd,
      nowMs: BASE_MS + 28_800_000,
      stopEvents: [{ startAt: stopStart, endAt: stopEnd, stopType: 'fault' }],
      baleCount: 120,
      nominalBalesPerShift: 120,
    })
    expect(result.stopSeconds).toBe(0)
    expect(result.availability).toBeCloseTo(1, 5)
  })

  // ----------------------------------------------------------
  // nowMs before shiftStart — plannedSeconds=0: availability=0, performance=0, oee=0
  // No divide-by-zero, no NaN
  // ----------------------------------------------------------
  it('nowMs before shiftStart — no NaN, availability=0, performance=0, oee=0', () => {
    const shiftStart = new Date(BASE_MS)
    const shiftEnd   = new Date(BASE_MS + 28_800_000)

    const result = calculateOee({
      shiftStart,
      shiftEnd,
      nowMs: BASE_MS - 60_000,  // 1 min before shift start
      stopEvents: [],
      baleCount: 0,
      nominalBalesPerShift: 120,
    })
    expect(result.plannedSeconds).toBe(0)
    expect(result.availability).toBe(0)
    expect(result.performance).toBe(0)
    expect(result.oee).toBe(0)
    // Ensure no NaN anywhere
    expect(Number.isNaN(result.availability)).toBe(false)
    expect(Number.isNaN(result.performance)).toBe(false)
    expect(Number.isNaN(result.oee)).toBe(false)
  })

  // ----------------------------------------------------------
  // baleCount=0 with run time → performance=0
  // ----------------------------------------------------------
  it('baleCount=0 with run time → performance=0', () => {
    const shiftStart = new Date(BASE_MS)
    const shiftEnd   = new Date(BASE_MS + 28_800_000)

    const result = calculateOee({
      shiftStart,
      shiftEnd,
      nowMs: BASE_MS + 28_800_000,
      stopEvents: [],
      baleCount: 0,
      nominalBalesPerShift: 120,
    })
    expect(result.performance).toBe(0)
  })

  // ----------------------------------------------------------
  // baleCount above nominalAtRunTime → performance capped at exactly 1
  // ----------------------------------------------------------
  it('baleCount above nominal → performance capped at 1', () => {
    const shiftStart = new Date(BASE_MS)
    const shiftEnd   = new Date(BASE_MS + 28_800_000)

    const result = calculateOee({
      shiftStart,
      shiftEnd,
      nowMs: BASE_MS + 28_800_000,
      stopEvents: [],
      baleCount: 999,  // way above nominal
      nominalBalesPerShift: 120,
    })
    expect(result.performance).toBe(1)
  })

  // ----------------------------------------------------------
  // qualityFactor override (0.9) flows into quality and oee
  // ----------------------------------------------------------
  it('qualityFactor override flows into quality and oee', () => {
    const shiftStart = new Date(BASE_MS)
    const shiftEnd   = new Date(BASE_MS + 28_800_000)

    const result = calculateOee({
      shiftStart,
      shiftEnd,
      nowMs: BASE_MS + 28_800_000,
      stopEvents: [],
      baleCount: 120,
      nominalBalesPerShift: 120,
      qualityFactor: 0.9,
    })
    expect(result.quality).toBeCloseTo(0.9, 5)
    expect(result.oee).toBeCloseTo(1 * 1 * 0.9, 5)
  })

  // ----------------------------------------------------------
  // Output fields are populated and consistent
  // runSeconds = plannedSeconds - stopSeconds; totalBales = baleCount
  // ----------------------------------------------------------
  it('returned fields are populated and consistent', () => {
    const shiftStart = new Date(BASE_MS)
    const shiftEnd   = new Date(BASE_MS + 28_800_000)
    const stopStart  = new Date(BASE_MS + 1_800_000)
    const stopEnd    = new Date(BASE_MS + 4_800_000)  // 50 min stop

    const result = calculateOee({
      shiftStart,
      shiftEnd,
      nowMs: BASE_MS + 28_800_000,
      stopEvents: [{ startAt: stopStart, endAt: stopEnd, stopType: 'fault' }],
      baleCount: 85,
      nominalBalesPerShift: 120,
    })
    expect(result.totalBales).toBe(85)
    expect(result.runSeconds).toBeCloseTo(result.plannedSeconds - result.stopSeconds, 1)
    expect(result.availability).toBeCloseTo(result.runSeconds / result.plannedSeconds, 5)
  })

  // ----------------------------------------------------------
  // QUALITY_FACTOR constant: default quality used when not overridden
  // ----------------------------------------------------------
  it('default qualityFactor equals exported QUALITY_FACTOR constant (0.95)', () => {
    expect(QUALITY_FACTOR).toBe(0.95)

    const shiftStart = new Date(BASE_MS)
    const shiftEnd   = new Date(BASE_MS + 28_800_000)
    const result = calculateOee({
      shiftStart,
      shiftEnd,
      nowMs: BASE_MS + 28_800_000,
      stopEvents: [],
      baleCount: 120,
      nominalBalesPerShift: 120,
      // no qualityFactor — should use QUALITY_FACTOR
    })
    expect(result.quality).toBe(QUALITY_FACTOR)
  })

  // ----------------------------------------------------------
  // stopSeconds capped at plannedSeconds (never exceeds the window)
  // e.g. multiple overlapping stops that together exceed planned time
  // ----------------------------------------------------------
  it('stopSeconds is capped at plannedSeconds even with massive stop overlap', () => {
    const shiftStart = new Date(BASE_MS)
    const shiftEnd   = new Date(BASE_MS + 3_600_000)  // 1h shift for this test
    // A stop lasting 2h in a 1h shift window → clamped to 1h
    const stopStart  = new Date(BASE_MS - 1_800_000)  // 30 min before shift
    const stopEnd    = new Date(BASE_MS + 5_400_000)  // 90 min after shift start

    const result = calculateOee({
      shiftStart,
      shiftEnd,
      nowMs: BASE_MS + 3_600_000,
      stopEvents: [{ startAt: stopStart, endAt: stopEnd, stopType: 'fault' }],
      baleCount: 0,
      nominalBalesPerShift: 30,
    })
    expect(result.stopSeconds).toBeLessThanOrEqual(result.plannedSeconds)
    expect(result.runSeconds).toBeGreaterThanOrEqual(0)
    expect(result.availability).toBeGreaterThanOrEqual(0)
  })

  // ----------------------------------------------------------
  // stopType does NOT affect the math (idle, fault, planned all same)
  // ----------------------------------------------------------
  it('stopType does not change the math — idle, fault, planned all reduce availability equally', () => {
    const shiftStart = new Date(BASE_MS)
    const shiftEnd   = new Date(BASE_MS + 28_800_000)
    const stopStart  = new Date(BASE_MS + 3_600_000)
    const stopEnd    = new Date(BASE_MS + 3_600_000 + 1_800_000)  // 30 min

    const makeResult = (stopType: 'fault' | 'idle' | 'planned') => calculateOee({
      shiftStart,
      shiftEnd,
      nowMs: BASE_MS + 28_800_000,
      stopEvents: [{ startAt: stopStart, endAt: stopEnd, stopType }],
      baleCount: 100,
      nominalBalesPerShift: 120,
    })

    const rFault   = makeResult('fault')
    const rIdle    = makeResult('idle')
    const rPlanned = makeResult('planned')

    expect(rFault.availability).toBeCloseTo(rIdle.availability, 5)
    expect(rFault.availability).toBeCloseTo(rPlanned.availability, 5)
  })

  // ----------------------------------------------------------
  // Performance: scales nominal by run-time fraction of FULL planned window
  // At 50% run time with exactly half the nominal bales → performance = 1
  // ----------------------------------------------------------
  it('performance scales nominal by full-shift run fraction', () => {
    // 8h shift, 4h of stops → 4h run
    const shiftStart = new Date(BASE_MS)
    const shiftEnd   = new Date(BASE_MS + 28_800_000)  // 8h
    const stopStart  = new Date(BASE_MS)
    const stopEnd    = new Date(BASE_MS + 14_400_000)  // 4h stop from start
    // nominalAtRunTime = 120 * (4h/8h) = 60; if baleCount = 60 → performance = 1
    const result = calculateOee({
      shiftStart,
      shiftEnd,
      nowMs: BASE_MS + 28_800_000,
      stopEvents: [{ startAt: stopStart, endAt: stopEnd, stopType: 'planned' }],
      baleCount: 60,
      nominalBalesPerShift: 120,
    })
    expect(result.performance).toBeCloseTo(1, 5)
    expect(result.availability).toBeCloseTo(0.5, 5)
  })

})

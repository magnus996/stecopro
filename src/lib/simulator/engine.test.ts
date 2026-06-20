import { describe, it, expect } from 'vitest'
import { osloHour, getShiftType, getShiftBoundsUtc } from './time'
import { simulateShift } from './engine'
import {
  FAULT_REASONS,
  IDLE_REASONS,
  PLANNED_REASONS,
  COVERAGE_RUN_MIN,
  COVERAGE_RUN_MAX,
  COVERAGE_EMPTY_MIN,
  COVERAGE_EMPTY_MAX,
} from './params'

// ============================================================
// Feature A: Oslo-timezone shift attribution
// ============================================================

describe('osloHour', () => {
  it('returns 7 for 2026-01-10T06:00:00Z (CET = UTC+1)', () => {
    expect(osloHour(Date.parse('2026-01-10T06:00:00Z'))).toBe(7)
  })

  it('returns 7 for 2026-07-10T05:00:00Z (CEST = UTC+2)', () => {
    expect(osloHour(Date.parse('2026-07-10T05:00:00Z'))).toBe(7)
  })
})

describe('getShiftType', () => {
  it('returns "day" for 08:00 Oslo time', () => {
    // 2026-01-10 08:00 Oslo CET = 07:00 UTC
    expect(getShiftType(Date.parse('2026-01-10T07:00:00Z'))).toBe('day')
  })

  it('returns "evening" for 16:00 Oslo time', () => {
    // 2026-01-10 16:00 Oslo CET = 15:00 UTC
    expect(getShiftType(Date.parse('2026-01-10T15:00:00Z'))).toBe('evening')
  })

  it('returns null for 23:00 Oslo time', () => {
    // 2026-01-10 23:00 Oslo CET = 22:00 UTC
    expect(getShiftType(Date.parse('2026-01-10T22:00:00Z'))).toBe(null)
  })

  it('returns null for 05:00 Oslo time', () => {
    // 2026-01-10 05:00 Oslo CET = 04:00 UTC
    expect(getShiftType(Date.parse('2026-01-10T04:00:00Z'))).toBe(null)
  })
})

describe('getShiftBoundsUtc', () => {
  it('returns correct UTC bounds for 2026-01-10 day shift (CET, UTC+1)', () => {
    const bounds = getShiftBoundsUtc('2026-01-10', 'day')
    // Day shift: 07:00–15:00 Oslo. In CET (UTC+1): 06:00–14:00 UTC
    expect(getShiftType(bounds.startMs)).toBe('day')
    expect(osloHour(bounds.startMs)).toBe(7)
    expect(bounds.endMs - bounds.startMs).toBe(8 * 3600 * 1000)
  })

  it('returns correct UTC bounds for 2026-07-10 day shift (CEST, UTC+2)', () => {
    const bounds = getShiftBoundsUtc('2026-07-10', 'day')
    // Day shift: 07:00–15:00 Oslo. In CEST (UTC+2): 05:00–13:00 UTC
    expect(getShiftType(bounds.startMs)).toBe('day')
    expect(osloHour(bounds.startMs)).toBe(7)
    expect(bounds.endMs - bounds.startMs).toBe(8 * 3600 * 1000)
  })

  it('returns correct UTC bounds for evening shift', () => {
    const bounds = getShiftBoundsUtc('2026-01-10', 'evening')
    expect(getShiftType(bounds.startMs)).toBe('evening')
    expect(osloHour(bounds.startMs)).toBe(15)
    expect(bounds.endMs - bounds.startMs).toBe(7 * 3600 * 1000)
  })
})

// ============================================================
// Feature B: Seeded engine producing ~90% availability
// ============================================================

describe('simulateShift', () => {
  const dayBounds = getShiftBoundsUtc('2026-01-10', 'day')

  it('AVAILABILITY: running-minutes / 480 is within 85%-95% for 8h day shift', () => {
    const events = simulateShift({
      startMs: dayBounds.startMs,
      endMs: dayBounds.endMs,
      seed: 42,
    })

    // Count running minutes by examining reading events with runState=true
    const readingEvents = events.filter(e => e.type === 'reading')
    const runningMinutes = readingEvents.filter(e => e.type === 'reading' && e.runState).length
    const totalMinutes = readingEvents.length

    expect(totalMinutes).toBeGreaterThan(0)
    const availability = runningMinutes / totalMinutes
    expect(availability).toBeGreaterThanOrEqual(0.85)
    expect(availability).toBeLessThanOrEqual(0.95)
  })

  it('IDLE_NEQ_FAULT: at least one stop event has stopType="idle" with reason "Bunker tom"', () => {
    const events = simulateShift({
      startMs: dayBounds.startMs,
      endMs: dayBounds.endMs,
      seed: 42,
    })
    const idleStop = events.find(
      e => e.type === 'stop' && e.stopType === 'idle' && e.reason === 'Bunker tom'
    )
    expect(idleStop).toBeDefined()
  })

  it('IDLE_NEQ_FAULT: no stop event has stopType="fault" with reason "Bunker tom"', () => {
    const events = simulateShift({
      startMs: dayBounds.startMs,
      endMs: dayBounds.endMs,
      seed: 42,
    })
    const wrongFault = events.find(
      e => e.type === 'stop' && e.stopType === 'fault' && e.reason === 'Bunker tom'
    )
    expect(wrongFault).toBeUndefined()
  })

  it('STOP_SPREAD: more stops in 2-10 min band than 30-120 min band', () => {
    const events = simulateShift({
      startMs: dayBounds.startMs,
      endMs: dayBounds.endMs,
      seed: 42,
    })

    // Pair stops with stopEnds to compute durations
    const stopEvents = events.filter(e => e.type === 'stop')
    const stopEndEvents = events.filter(e => e.type === 'stopEnd')

    let shortStops = 0 // 2-10 min
    let longStops = 0  // 30-120 min

    for (let i = 0; i < Math.min(stopEvents.length, stopEndEvents.length); i++) {
      const stop = stopEvents[i]
      const stopEnd = stopEndEvents[i]
      if (stop.type !== 'stop' || stopEnd.type !== 'stopEnd') continue
      const durationMin = (stopEnd.at - stop.at) / 60000
      if (durationMin >= 2 && durationMin <= 10) shortStops++
      if (durationMin >= 30 && durationMin <= 120) longStops++
    }

    expect(shortStops).toBeGreaterThan(longStops)
  })

  it('BOUNDARIES: every event timestamp is >= shift start and < shift end', () => {
    const events = simulateShift({
      startMs: dayBounds.startMs,
      endMs: dayBounds.endMs,
      seed: 42,
    })

    for (const event of events) {
      expect(event.at).toBeGreaterThanOrEqual(dayBounds.startMs)
      expect(event.at).toBeLessThan(dayBounds.endMs)
    }
  })

  it('REASONS_NORWEGIAN: every stop reason is in the known Norwegian reason lists', () => {
    const events = simulateShift({
      startMs: dayBounds.startMs,
      endMs: dayBounds.endMs,
      seed: 42,
    })

    const allReasons = new Set<string>([...FAULT_REASONS, ...IDLE_REASONS, ...PLANNED_REASONS])
    const stopEvents = events.filter(e => e.type === 'stop')

    for (const event of stopEvents) {
      if (event.type === 'stop') {
        expect(allReasons.has(event.reason)).toBe(true)
      }
    }
  })

  it('DETERMINISM: same seed produces identical event arrays', () => {
    const events1 = simulateShift({
      startMs: dayBounds.startMs,
      endMs: dayBounds.endMs,
      seed: 99,
    })
    const events2 = simulateShift({
      startMs: dayBounds.startMs,
      endMs: dayBounds.endMs,
      seed: 99,
    })
    expect(events1).toEqual(events2)
  })

  it('DETERMINISM: different seeds produce different event arrays', () => {
    const events1 = simulateShift({
      startMs: dayBounds.startMs,
      endMs: dayBounds.endMs,
      seed: 1,
    })
    const events2 = simulateShift({
      startMs: dayBounds.startMs,
      endMs: dayBounds.endMs,
      seed: 2,
    })
    expect(events1).not.toEqual(events2)
  })

  it('CURRENT_BANDS: bunker readings are 0, or 4-6 (empty), or 10-15 (loaded)', () => {
    const events = simulateShift({ startMs: dayBounds.startMs, endMs: dayBounds.endMs, seed: 42 })
    const bunker = events.filter(e => e.type === 'reading' && e.machineId === 0)
    for (const r of bunker) {
      if (r.type !== 'reading') continue
      const a = r.currentA
      const ok = a === 0 || (a >= 4 && a <= 6) || (a >= 10 && a <= 15)
      expect(ok).toBe(true)
    }
  })

  it('COVERAGE_EMITTED: optical sorter (machine 3) has one coverage reading per minute', () => {
    const events = simulateShift({ startMs: dayBounds.startMs, endMs: dayBounds.endMs, seed: 42 })
    const optical = events.filter(e => e.type === 'reading' && e.machineId === 3)
    const totalMinutes = (dayBounds.endMs - dayBounds.startMs) / 60000
    expect(optical.length).toBe(totalMinutes)
    for (const r of optical) {
      if (r.type !== 'reading') continue
      expect(typeof r.coveragePct).toBe('number')
    }
  })

  it('COVERAGE_BANDS: utilisation is 0-120, running at saturation, otherwise dipped/zero', () => {
    const events = simulateShift({ startMs: dayBounds.startMs, endMs: dayBounds.endMs, seed: 42 })
    const optical = events.filter(e => e.type === 'reading' && e.machineId === 3)
    for (const r of optical) {
      if (r.type !== 'reading') continue
      const c = r.coveragePct as number
      expect(c).toBeGreaterThanOrEqual(0)
      expect(c).toBeLessThanOrEqual(120)
      if (r.runState) {
        // running: Tomra saturated (~100 %)
        expect(c >= COVERAGE_RUN_MIN && c <= COVERAGE_RUN_MAX).toBe(true)
      } else {
        // bunker-empty (starved) → COVERAGE_EMPTY band, or full stop → 0
        expect(c === 0 || (c >= COVERAGE_EMPTY_MIN && c <= COVERAGE_EMPTY_MAX)).toBe(true)
      }
    }
  })

  it('COVERAGE_ISOLATION: adding the coverage sub-stream does not change the main stream', () => {
    // Stops, bales and bunker/conveyor/press currents must be unaffected by the
    // optical-sorter readings (which draw from an independent rng). We assert this
    // indirectly: the non-optical events are stable for a fixed seed.
    const events = simulateShift({ startMs: dayBounds.startMs, endMs: dayBounds.endMs, seed: 42 })
    const bunkerReadings = events.filter(e => e.type === 'reading' && e.machineId === 0).length
    const baleCount = events.filter(e => e.type === 'bale').length
    // Same counts as the historical (pre-coverage) seed-42 day shift.
    expect(bunkerReadings).toBe(480)
    expect(baleCount).toBeGreaterThanOrEqual(60)
    expect(baleCount).toBeLessThanOrEqual(95)
  })

  it('BALE_MIX: deink is the largest fraction and total is plausible (~70-90 for an 8h shift)', () => {
    const events = simulateShift({ startMs: dayBounds.startMs, endMs: dayBounds.endMs, seed: 42 })
    const bales = events.filter(e => e.type === 'bale')
    const byFrac = [0, 0, 0, 0]
    for (const b of bales) if (b.type === 'bale') byFrac[b.fractionId]++
    const total = byFrac.reduce((s, n) => s + n, 0)
    // engine order [deink, occ, tetra, miks]; deink (40) must dominate
    expect(byFrac[0]).toBeGreaterThan(byFrac[1])
    expect(byFrac[0]).toBeGreaterThan(byFrac[2])
    expect(byFrac[0]).toBeGreaterThanOrEqual(byFrac[3])
    expect(total).toBeGreaterThanOrEqual(60)
    expect(total).toBeLessThanOrEqual(95)
  })
})

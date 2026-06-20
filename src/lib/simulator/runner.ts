/**
 * Simulator runner — glue between the pure engine and the IngestAdapter.
 *
 * runBackfill walks 14 days of Oslo-calendar shifts, calls simulateShift per
 * shift, and translates each SimEvent into the matching IngestAdapter call.
 *
 * This module is intentionally free of `new Database()` — the adapter is
 * always injected so both the backfill script (plan 03) and the live ticker
 * (plan 04) can reuse this code without modification.
 */

import { simulateShift } from './engine'
import { getShiftBoundsUtc } from './time'
import type { IngestAdapter } from '@/lib/ingest/interface'

// ---------------------------------------------------------------------------
// Types exported for callers
// ---------------------------------------------------------------------------

/**
 * Resolved real-DB ids discovered by the standalone script.
 * Abstract engine indices map to these ids:
 *   machineIds.bunker        ← abstract index 0
 *   machineIds.conveyor      ← abstract index 1
 *   machineIds.press         ← abstract index 2
 *   machineIds.opticalSorter ← abstract index 3
 *   fractionIds[name]    ← abstract index 0=deink, 1=occ, 2=tetra, 3=miks
 */
export interface SimContext {
  plantId: number
  tenantId: number
  machineIds: {
    bunker: number
    conveyor: number
    press: number
    opticalSorter: number
  }
  /** Fraction name → real DB id, covering Deink, Tetra/emballasjepapp, OCC, Miks */
  fractionIds: Record<string, number>
}

export interface RunBackfillOptions {
  daysBack?: number
  now?: Date
}

// ---------------------------------------------------------------------------
// Index → real-id mappings
// ---------------------------------------------------------------------------

/** Abstract engine machine index (0/1/2) → real machineId from SimContext */
function resolveMachineId(
  machineKey: number,
  ctx: SimContext,
): number {
  switch (machineKey) {
    case 0: return ctx.machineIds.bunker
    case 1: return ctx.machineIds.conveyor
    case 2: return ctx.machineIds.press
    case 3: return ctx.machineIds.opticalSorter
    default: return ctx.machineIds.bunker
  }
}

/**
 * Abstract engine fraction index → real fractionId from SimContext.
 * Engine order: 0=deink, 1=occ, 2=tetra, 3=miks
 * Fraction names must match the seed exactly.
 */
const ABSTRACT_FRACTION_NAMES = [
  'Deink',
  'OCC',
  'Tetra/emballasjepapp',
  'Miks',
] as const

function resolveFractionId(fractionIdx: number, ctx: SimContext): number {
  const name = ABSTRACT_FRACTION_NAMES[fractionIdx]
  const id = ctx.fractionIds[name]
  if (id === undefined) {
    throw new Error(
      `SimContext.fractionIds missing entry for "${name}". ` +
      `Available keys: ${Object.keys(ctx.fractionIds).join(', ')}`,
    )
  }
  return id
}

// ---------------------------------------------------------------------------
// Oslo calendar date helpers (no extra dependencies)
// ---------------------------------------------------------------------------

/** Format a Date as 'YYYY-MM-DD' in the Oslo timezone. */
function toOsloDateStr(utcMs: number): string {
  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Oslo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(utcMs))
}

/** Return the last `daysBack` Oslo calendar dates ending at (and including) today. */
function osloCalendarDays(now: Date, daysBack: number): string[] {
  const days: string[] = []
  for (let i = daysBack - 1; i >= 0; i--) {
    const utcMs = now.getTime() - i * 86400000
    days.push(toOsloDateStr(utcMs))
  }
  return days
}

// ---------------------------------------------------------------------------
// Main backfill runner
// ---------------------------------------------------------------------------

/**
 * Walk `daysBack` Oslo calendar days (default 14), simulate each day/evening
 * shift, and write all events to `adapter`.
 *
 * Shifts whose start is in the future relative to `now` are skipped so that a
 * mid-day run does not fabricate unfinished shifts.
 *
 * `adapter.flush()` is called after every shift to commit buffered readings.
 */
export function runBackfill(
  adapter: IngestAdapter,
  ctx: SimContext,
  opts: RunBackfillOptions = {},
): void {
  const daysBack = opts.daysBack ?? 14
  const now = opts.now ?? new Date()
  const nowMs = now.getTime()

  const days = osloCalendarDays(now, daysBack)

  for (const osloDate of days) {
    for (const shiftType of ['day', 'evening'] as const) {
      const { startMs, endMs } = getShiftBoundsUtc(osloDate, shiftType)

      // Skip shifts that haven't started yet
      if (startMs >= nowMs) continue

      const startAt = new Date(startMs)
      const endAt = new Date(endMs)

      // Idempotently ensure shift row exists; returns existing id if already inserted
      const shiftId = adapter.ensureShift(ctx.plantId, shiftType, startAt, endAt)
      void shiftId // shiftId is available for future use (e.g. tagging readings)

      // Deterministic seed from the day index (day-unique across history)
      const dayIndex = Math.floor(startMs / 86400000)
      const seed = dayIndex * 2 + (shiftType === 'day' ? 0 : 1)

      const events = simulateShift({ startMs, endMs, seed })

      // Track the current open stop id so stopEnd can close it
      let openStopId: number | null = null

      for (const ev of events) {
        switch (ev.type) {
          case 'reading': {
            const machineId = resolveMachineId(ev.machineId, ctx)
            adapter.reportReading(machineId, new Date(ev.at), ev.currentA, ev.runState, ev.coveragePct ?? null)
            break
          }

          case 'stop': {
            // Close any previously open stop before opening a new one (safety)
            if (openStopId !== null) {
              adapter.reportStopEnded(openStopId, new Date(ev.at))
              openStopId = null
            }
            openStopId = adapter.reportStop(ctx.plantId, new Date(ev.at), ev.reason, ev.stopType)
            break
          }

          case 'stopEnd': {
            if (openStopId !== null) {
              adapter.reportStopEnded(openStopId, new Date(ev.at))
              openStopId = null
            }
            break
          }

          case 'bale': {
            const fractionId = resolveFractionId(ev.fractionId, ctx)
            adapter.reportBale(
              ctx.plantId,
              fractionId,
              ctx.machineIds.press,
              new Date(ev.at),
            )
            break
          }
        }
      }

      // Close any stop that was open at end of shift
      if (openStopId !== null) {
        adapter.reportStopEnded(openStopId, endAt)
        openStopId = null
      }

      // Flush buffered time-series readings for this shift
      adapter.flush()
    }
  }
}

// ---------------------------------------------------------------------------
// Live tick stub — plan 04 will flesh this out
// ---------------------------------------------------------------------------

/**
 * Advance the live simulation by one minute.
 * Called on a 60-second interval by the live runner (plan 04).
 *
 * Runs a single-minute window ending at `now`, using the current shift's
 * seed offset from the shift start. This is intentionally thin — plan 04
 * will manage shift boundaries and scheduling.
 *
 * @param adapter - The IngestAdapter to write to
 * @param ctx     - The resolved DB ids
 * @param now     - The current timestamp (defaults to new Date())
 */
export function advanceLiveTick(
  adapter: IngestAdapter,
  ctx: SimContext,
  now: Date = new Date(),
): void {
  const nowMs = now.getTime()
  const tickStartMs = nowMs - 60000
  const tickEndMs = nowMs

  // Derive a deterministic seed from the current minute
  const minuteIndex = Math.floor(tickStartMs / 60000)
  const seed = minuteIndex

  const events = simulateShift({ startMs: tickStartMs, endMs: tickEndMs, seed })

  let openStopId: number | null = null

  for (const ev of events) {
    switch (ev.type) {
      case 'reading': {
        const machineId = resolveMachineId(ev.machineId, ctx)
        adapter.reportReading(machineId, new Date(ev.at), ev.currentA, ev.runState, ev.coveragePct ?? null)
        break
      }
      case 'stop': {
        if (openStopId !== null) {
          adapter.reportStopEnded(openStopId, new Date(ev.at))
          openStopId = null
        }
        openStopId = adapter.reportStop(ctx.plantId, new Date(ev.at), ev.reason, ev.stopType)
        break
      }
      case 'stopEnd': {
        if (openStopId !== null) {
          adapter.reportStopEnded(openStopId, new Date(ev.at))
          openStopId = null
        }
        break
      }
      case 'bale': {
        const fractionId = resolveFractionId(ev.fractionId, ctx)
        adapter.reportBale(ctx.plantId, fractionId, ctx.machineIds.press, new Date(ev.at))
        break
      }
    }
  }

  if (openStopId !== null) {
    adapter.reportStopEnded(openStopId, new Date(tickEndMs))
  }

  adapter.flush()
}

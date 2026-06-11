/**
 * Shared OEE calculation module.
 *
 * Pure business logic — no DB access, no server-only imports, no Date.now() reliance.
 * Accepts `nowMs` explicitly so tests are fully deterministic.
 *
 * Used by Phase 3 dashboard and Phase 4 reports to ensure identical numbers.
 */

export interface OeeStopInput {
  startAt: Date
  endAt: Date | null        // null = ongoing; treated as nowMs
  stopType: 'fault' | 'idle' | 'planned'
}

export interface OeeInput {
  shiftStart: Date
  shiftEnd: Date            // planned window end (may be in the future for the current shift)
  nowMs?: number            // default Date.now(); the moment "ongoing" stops are measured up to
  stopEvents: OeeStopInput[]
  baleCount: number         // actual bales produced this shift
  nominalBalesPerShift: number  // bales at 100% availability across the full planned window
  qualityFactor?: number    // default QUALITY_FACTOR
}

export interface OeeResult {
  availability: number    // 0-1
  performance: number     // 0-1
  quality: number         // 0-1
  oee: number             // A * P * Q, 0-1
  plannedSeconds: number  // effective planned window so far: shiftStart..min(shiftEnd, now)
  runSeconds: number
  stopSeconds: number
  totalBales: number
}

/** Default quality factor — configurable per plant in Phase 5. Visible in OEE widget definition text. */
export const QUALITY_FACTOR = 0.95

/**
 * Compute the overlap in seconds between interval [a, b] and [c, d].
 * All values in milliseconds. Returns 0 if no overlap.
 */
function overlapSeconds(
  aMs: number, bMs: number,
  cMs: number, dMs: number,
): number {
  const start = Math.max(aMs, cMs)
  const end   = Math.min(bMs, dMs)
  return end > start ? (end - start) / 1000 : 0
}

/**
 * Calculate OEE for a shift window.
 *
 * Behaviour rules:
 * 1. plannedSeconds = floor of (min(shiftEnd, now) - shiftStart) / 1000, clamped at 0.
 * 2. Each stop's contribution = overlap of [startAt, endAt ?? now] with [shiftStart, min(shiftEnd, now)].
 * 3. stopSeconds = sum of clamped overlaps, then capped at plannedSeconds.
 * 4. runSeconds = plannedSeconds - stopSeconds.
 * 5. availability = plannedSeconds > 0 ? runSeconds / plannedSeconds : 0.
 * 6. performance: nominalAtRunTime = nominalBalesPerShift * (runSeconds / fullPlannedSeconds)
 *    where fullPlannedSeconds = (shiftEnd - shiftStart) / 1000.
 *    performance = nominalAtRunTime > 0 ? min(baleCount / nominalAtRunTime, 1) : 0.
 * 7. quality = qualityFactor ?? QUALITY_FACTOR.
 * 8. oee = availability * performance * quality.
 * 9. stopType does not affect the math.
 */
export function calculateOee(input: OeeInput): OeeResult {
  const now = input.nowMs ?? Date.now()

  const shiftStartMs = input.shiftStart.getTime()
  const shiftEndMs   = input.shiftEnd.getTime()

  // Effective window end: the lesser of planned shift end and now
  const windowEndMs = Math.min(shiftEndMs, now)

  // 1. plannedSeconds — how much of the shift has elapsed so far; floored at 0
  const plannedSeconds = Math.max(0, (windowEndMs - shiftStartMs) / 1000)

  // 2-3. Stop overlap accumulation, then cap at planned window
  let rawStopSeconds = 0
  for (const stop of input.stopEvents) {
    const stopEndMs = stop.endAt ? stop.endAt.getTime() : now
    rawStopSeconds += overlapSeconds(
      stop.startAt.getTime(), stopEndMs,
      shiftStartMs, windowEndMs,
    )
  }
  const stopSeconds = Math.min(rawStopSeconds, plannedSeconds)

  // 4. runSeconds
  const runSeconds = plannedSeconds - stopSeconds

  // 5. availability
  const availability = plannedSeconds > 0 ? runSeconds / plannedSeconds : 0

  // 6. performance — nominal scales by run-time fraction of the FULL planned window
  const fullPlannedSeconds = Math.max(0, (shiftEndMs - shiftStartMs) / 1000)
  const nominalAtRunTime = fullPlannedSeconds > 0
    ? input.nominalBalesPerShift * (runSeconds / fullPlannedSeconds)
    : 0
  const performance = nominalAtRunTime > 0
    ? Math.min(input.baleCount / nominalAtRunTime, 1)
    : 0

  // 7. quality
  const quality = input.qualityFactor ?? QUALITY_FACTOR

  // 8. oee
  const oee = availability * performance * quality

  return {
    availability,
    performance,
    quality,
    oee,
    plannedSeconds,
    runSeconds,
    stopSeconds,
    totalBales: input.baleCount,
  }
}

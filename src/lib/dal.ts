import 'server-only'
// ---------------------------------------------------------------------------
// DATA ACCESS LAYER (DAL) — Tenant Isolation Rule
// ---------------------------------------------------------------------------
// EVERY accessor in this file derives tenantId from the verified session.
// NO accessor accepts tenantId as a parameter.
// This is the single enforcement point for multi-tenant data isolation.
// When adding new accessors: call verifySession() first, use session.tenantId
// in every WHERE clause. Never pass tenantId in from a page or component.
// ---------------------------------------------------------------------------
import { cache } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { decrypt } from './session'
import { db } from '@/db'
import {
  users, plants, tenants,
  shifts, stopEvents, baleEvents, machines, timeSeriesReadings, fractions,
} from '@/db/schema'
import { eq, and, lte, gt, gte, lt, desc, asc, isNull, isNotNull, or, sql } from 'drizzle-orm'
import type { SessionPayload } from './definitions'
import { getShiftType, getShiftBoundsUtc } from './time'
import { calculateOee, QUALITY_FACTOR } from './oee'
import type { OeeResult } from './oee'

// Verify the session cookie and redirect to /login if invalid.
// Returns the full session payload on success.
export const verifySession = cache(async (): Promise<SessionPayload> => {
  const cookie = (await cookies()).get('session')?.value
  const session = await decrypt(cookie)
  if (!session?.userId) redirect('/login')
  return session
})

// Re-query the users table by userId AND tenantId (honoring the active flag).
// Used for nav/role decisions. Returns safe fields only.
export const getCurrentUser = cache(async () => {
  const session = await verifySession()
  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      tenantId: users.tenantId,
    })
    .from(users)
    .where(
      and(
        eq(users.id, session.userId),
        eq(users.tenantId, session.tenantId),
        eq(users.active, true),
      )
    )
  return user ?? null
})

// Returns the current tenant's record (name, slug).
export const getTenant = cache(async () => {
  const session = await verifySession()
  const [tenant] = await db
    .select({ id: tenants.id, name: tenants.name, slug: tenants.slug })
    .from(tenants)
    .where(eq(tenants.id, session.tenantId))
  return tenant ?? null
})

// Example tenant-scoped accessor: returns plants for the current tenant.
// system_admin sees all plants (no tenant filter) — Phase 5 builds the full
// system-admin surface; keep this minimal for Phase 1.
export const getPlants = cache(async () => {
  const session = await verifySession()
  if (session.role === 'system_admin') {
    return db.select().from(plants)
  }
  return db.select().from(plants).where(eq(plants.tenantId, session.tenantId))
})

// ---------------------------------------------------------------------------
// Dashboard accessors — Phase 3
// All accept plantId (a normal parameter); tenantId is NEVER a parameter.
// ---------------------------------------------------------------------------

/**
 * Returns the shift row whose [startAt, endAt) covers now, or null (= outside shift).
 */
export const getCurrentShiftForPlant = cache(async (plantId: number) => {
  const session = await verifySession()
  const now = new Date()
  const [shift] = await db
    .select()
    .from(shifts)
    .where(
      and(
        eq(shifts.tenantId, session.tenantId),
        eq(shifts.plantId, plantId),
        lte(shifts.startAt, now),
        gt(shifts.endAt, now),
      )
    )
    .limit(1)
  return shift ?? null
})

/**
 * Returns the latest stop rows ordered by startAt DESC.
 * Caller computes duration from (endAt ?? now) - startAt.
 */
export const getRecentStops = cache(async (plantId: number, limit = 8) => {
  const session = await verifySession()
  return db
    .select({
      id: stopEvents.id,
      startAt: stopEvents.startAt,
      endAt: stopEvents.endAt,
      reason: stopEvents.reason,
      stopType: stopEvents.stopType,
    })
    .from(stopEvents)
    .where(
      and(
        eq(stopEvents.tenantId, session.tenantId),
        eq(stopEvents.plantId, plantId),
      )
    )
    .orderBy(desc(stopEvents.startAt))
    .limit(limit)
})

/**
 * Finds the bunker machine for this plant/tenant, then returns the single latest
 * time_series_readings row for that machine. Used for freshness + empty detection.
 */
export const getLatestBunkerReadingState = cache(async (plantId: number) => {
  const session = await verifySession()
  const [bunkerMachine] = await db
    .select({ id: machines.id })
    .from(machines)
    .where(
      and(
        eq(machines.tenantId, session.tenantId),
        eq(machines.plantId, plantId),
        eq(machines.type, 'bunker'),
      )
    )
    .limit(1)
  if (!bunkerMachine) return null

  const [reading] = await db
    .select({
      recordedAt: timeSeriesReadings.recordedAt,
      currentA: timeSeriesReadings.currentA,
      runState: timeSeriesReadings.runState,
    })
    .from(timeSeriesReadings)
    .where(
      and(
        eq(timeSeriesReadings.tenantId, session.tenantId),
        eq(timeSeriesReadings.machineId, bunkerMachine.id),
      )
    )
    .orderBy(desc(timeSeriesReadings.recordedAt))
    .limit(1)
  return reading ?? null
})

/**
 * Returns the most recent open stop (endAt IS NULL), or null.
 * stopType='idle' + reason='Bunker tom' => running_empty state.
 */
export const getOpenStop = cache(async (plantId: number) => {
  const session = await verifySession()
  const [stop] = await db
    .select({
      id: stopEvents.id,
      startAt: stopEvents.startAt,
      endAt: stopEvents.endAt,
      reason: stopEvents.reason,
      stopType: stopEvents.stopType,
    })
    .from(stopEvents)
    .where(
      and(
        eq(stopEvents.tenantId, session.tenantId),
        eq(stopEvents.plantId, plantId),
        isNull(stopEvents.endAt),
      )
    )
    .orderBy(desc(stopEvents.startAt))
    .limit(1)
  return stop ?? null
})

/**
 * Returns stops overlapping [shiftStart, shiftEnd): started before shiftEnd AND
 * either ongoing or ended after shiftStart. Feeds calculateOee.
 */
export const getShiftStops = cache(async (
  plantId: number,
  shiftStart: Date,
  shiftEnd: Date,
) => {
  const session = await verifySession()
  return db
    .select({
      startAt: stopEvents.startAt,
      endAt: stopEvents.endAt,
      stopType: stopEvents.stopType,
      reason: stopEvents.reason,
    })
    .from(stopEvents)
    .where(
      and(
        eq(stopEvents.tenantId, session.tenantId),
        eq(stopEvents.plantId, plantId),
        lt(stopEvents.startAt, shiftEnd),
        or(
          isNull(stopEvents.endAt),
          gt(stopEvents.endAt, shiftStart),
        ),
      )
    )
})

// ---------------------------------------------------------------------------
// Task 2: Bale counts, current-draw series, and the composed getDashboardData
// ---------------------------------------------------------------------------

/**
 * Returns one row per fraction {fractionId, name, sortOrder, count} using a LEFT
 * JOIN so fractions with zero bales still appear. Serves both "current shift" and
 * "today" by passing different fromAt/toAt windows.
 */
export const getBaleCountsByFraction = cache(async (
  plantId: number,
  fromAt: Date,
  toAt: Date,
) => {
  const session = await verifySession()
  return db
    .select({
      fractionId: fractions.id,
      name: fractions.name,
      sortOrder: fractions.sortOrder,
      count: sql<number>`count(${baleEvents.id})`,
    })
    .from(fractions)
    .leftJoin(
      baleEvents,
      and(
        eq(baleEvents.fractionId, fractions.id),
        eq(baleEvents.tenantId, session.tenantId),
        gte(baleEvents.occurredAt, fromAt),
        lt(baleEvents.occurredAt, toAt),
      ),
    )
    .where(
      and(
        eq(fractions.tenantId, session.tenantId),
        eq(fractions.plantId, plantId),
      )
    )
    .groupBy(fractions.id)
    .orderBy(asc(fractions.sortOrder))
})

/**
 * Returns bunker current-draw readings for [fromAt, toAt), ordered ascending.
 * Returns [] if no bunker machine found for this plant.
 */
export const getBunkerCurrentDraw = cache(async (
  plantId: number,
  fromAt: Date,
  toAt: Date,
) => {
  const session = await verifySession()
  const [bunkerMachine] = await db
    .select({ id: machines.id })
    .from(machines)
    .where(
      and(
        eq(machines.tenantId, session.tenantId),
        eq(machines.plantId, plantId),
        eq(machines.type, 'bunker'),
      )
    )
    .limit(1)
  if (!bunkerMachine) return []

  return db
    .select({
      recordedAt: timeSeriesReadings.recordedAt,
      currentA: timeSeriesReadings.currentA,
      runState: timeSeriesReadings.runState,
    })
    .from(timeSeriesReadings)
    .where(
      and(
        eq(timeSeriesReadings.tenantId, session.tenantId),
        eq(timeSeriesReadings.machineId, bunkerMachine.id),
        gte(timeSeriesReadings.recordedAt, fromAt),
        lt(timeSeriesReadings.recordedAt, toAt),
      )
    )
    .orderBy(asc(timeSeriesReadings.recordedAt))
})

// Nominal bales per 8h shift = sum of per-fraction rates from params.ts:
// BALE_RATES_PER_SHIFT = { deink:45, occ:35, tetra:25, miks:15 } => 120 total
const NOMINAL_BALES_PER_SHIFT = 120

// Plant state string enum — maps to Norwegian UI labels in plan 04
export type PlantState = 'running' | 'running_empty' | 'stopped' | 'outside_shift' | 'no_data'

// Shape returned by getDashboardData
export interface DashboardData {
  plant: { id: number; name: string; nominalCapacityTph: number | null }
  state: PlantState
  openStopReason: string | null
  oee: OeeResult | null
  todayUptime: { runSeconds: number; plannedSeconds: number }
  baleCounts: {
    currentShift: { fractionId: number; name: string; sortOrder: number; count: number }[]
    today: { fractionId: number; name: string; sortOrder: number; count: number }[]
  }
  recentStops: {
    id: number
    startAt: Date
    endAt: Date | null
    reason: string | null
    stopType: string
  }[]
  currentDraw: { recordedAt: Date; currentA: number | null; runState: boolean | null }[]
  latestReadingAt: Date | null
  now: Date
  shift: { startAt: Date; endAt: Date; shiftType: string } | null
  throughput: {
    nominalCapacityTph: number | null
    expectedBalesSoFar: number
    actualBalesSoFar: number
  }
}

// ---------------------------------------------------------------------------
// Report/Analysis accessors — Phase 4
// All accept plantId (and shiftId where relevant); tenantId is NEVER a parameter.
// OEE for every historical shift is computed via calculateOee with nowMs=shiftEnd.
// Stops and bales are ALWAYS fetched in separate queries (see RESEARCH Pitfall 1).
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Exported interfaces for report accessors
// ---------------------------------------------------------------------------

export interface ShiftReportRow {
  id: number
  shiftType: string
  startAt: Date
  endAt: Date
  oee: number
  availability: number
  performance: number
  uptimeRunSeconds: number
  uptimePlannedSeconds: number
  stopCount: number
  stopSeconds: number
  totalBales: number
}

export interface ShiftReportDetail {
  shift: { id: number; shiftType: string; startAt: Date; endAt: Date }
  oee: OeeResult
  stops: { startAt: Date; endAt: Date | null; reason: string | null; stopType: string }[]
  balesByFraction: { fractionId: number; name: string; count: number }[]
  totalBales: number
}

export interface ParetoRow {
  reason: string
  stopType: string
  incidentCount: number
  totalSeconds: number
}

export interface BalesPerDayRow {
  osloDate: string
  fractionId: number
  fractionName: string
  count: number
}

export interface ShiftComparisonRow {
  shiftType: string
  shiftCount: number
  avgOee: number
  avgAvailability: number
  avgPerformance: number
  avgUptimePct: number
  totalBales: number
  totalStopSeconds: number
  totalStopCount: number
}

export interface ShiftEnergyProxy {
  avgCurrentA: number | null
  nominalCurrentA: number | null
  readingCount: number
}

/**
 * Returns all historical shifts in [fromDate, toDate] (Oslo calendar dates) for the plant,
 * with per-shift OEE computed via calculateOee. Stops and bales are fetched in SEPARATE
 * queries (see RESEARCH Pitfall 1 — combined LEFT JOIN produces cartesian product).
 */
export const getShiftReportList = cache(async (
  plantId: number,
  fromDate: string,  // Oslo 'YYYY-MM-DD'
  toDate: string,    // Oslo 'YYYY-MM-DD'
): Promise<ShiftReportRow[]> => {
  const session = await verifySession()
  const { startMs: fromMs } = getShiftBoundsUtc(fromDate, 'day')
  const { endMs: toMs } = getShiftBoundsUtc(toDate, 'evening')

  // Query A: all shifts in range, ordered reverse-chronological for the list
  const shiftRows = await db
    .select({
      id: shifts.id,
      shiftType: shifts.shiftType,
      startAt: shifts.startAt,
      endAt: shifts.endAt,
    })
    .from(shifts)
    .where(
      and(
        eq(shifts.tenantId, session.tenantId),
        eq(shifts.plantId, plantId),
        gte(shifts.startAt, new Date(fromMs)),
        lte(shifts.startAt, new Date(toMs)),
      )
    )
    .orderBy(desc(shifts.startAt))

  if (shiftRows.length === 0) return []

  // Query B: all stop events overlapping the date range, then bucket by shift in JS
  const allStops = await db
    .select({
      startAt: stopEvents.startAt,
      endAt: stopEvents.endAt,
      stopType: stopEvents.stopType,
      reason: stopEvents.reason,
    })
    .from(stopEvents)
    .where(
      and(
        eq(stopEvents.tenantId, session.tenantId),
        eq(stopEvents.plantId, plantId),
        lt(stopEvents.startAt, new Date(toMs)),
        or(
          isNull(stopEvents.endAt),
          gt(stopEvents.endAt, new Date(fromMs)),
        ),
      )
    )

  // Query C: all bale events in range, then bucket by shift in JS
  const allBales = await db
    .select({
      occurredAt: baleEvents.occurredAt,
      fractionId: baleEvents.fractionId,
    })
    .from(baleEvents)
    .where(
      and(
        eq(baleEvents.tenantId, session.tenantId),
        eq(baleEvents.plantId, plantId),
        gte(baleEvents.occurredAt, new Date(fromMs)),
        lt(baleEvents.occurredAt, new Date(toMs)),
      )
    )

  // Compute per-shift OEE by bucketing stops and bales in JS
  return shiftRows.map(shift => {
    const shiftStartMs = shift.startAt.getTime()
    const shiftEndMs = shift.endAt.getTime()

    // Bucket stops: overlap [shiftStart, shiftEnd)
    const shiftStops = allStops.filter(s => {
      const stopStartMs = s.startAt.getTime()
      const stopEndMs = s.endAt ? s.endAt.getTime() : shiftEndMs
      return stopStartMs < shiftEndMs && stopEndMs > shiftStartMs
    })

    // Bucket bales: occurredAt in [shiftStart, shiftEnd)
    const shiftBales = allBales.filter(b => {
      const bMs = b.occurredAt.getTime()
      return bMs >= shiftStartMs && bMs < shiftEndMs
    })

    const baleCount = shiftBales.length

    const oeeResult = calculateOee({
      shiftStart: shift.startAt,
      shiftEnd: shift.endAt,
      nowMs: shiftEndMs,  // historical shift: fully elapsed
      stopEvents: shiftStops.map(s => ({
        startAt: s.startAt,
        endAt: s.endAt,
        stopType: s.stopType as 'fault' | 'idle' | 'planned',
      })),
      baleCount,
      nominalBalesPerShift: NOMINAL_BALES_PER_SHIFT,
      qualityFactor: QUALITY_FACTOR,
    })

    return {
      id: shift.id,
      shiftType: shift.shiftType,
      startAt: shift.startAt,
      endAt: shift.endAt,
      oee: oeeResult.oee,
      availability: oeeResult.availability,
      performance: oeeResult.performance,
      uptimeRunSeconds: oeeResult.runSeconds,
      uptimePlannedSeconds: oeeResult.plannedSeconds,
      stopCount: shiftStops.filter(s => s.endAt !== null).length,
      stopSeconds: oeeResult.stopSeconds,
      totalBales: baleCount,
    }
  })
})

/**
 * Returns full detail for a single historical shift: OEE breakdown, stop list,
 * bales per fraction, and total bales. Returns null if shiftId not found for this
 * tenant+plant (prevents cross-tenant access — RESEARCH Pitfall 6).
 */
export const getShiftReportDetail = cache(async (
  plantId: number,
  shiftId: number,
): Promise<ShiftReportDetail | null> => {
  const session = await verifySession()

  const [shift] = await db
    .select()
    .from(shifts)
    .where(
      and(
        eq(shifts.id, shiftId),
        eq(shifts.tenantId, session.tenantId),
        eq(shifts.plantId, plantId),
      )
    )
    .limit(1)

  if (!shift) return null

  // Reuse existing tenant-scoped stop and bale accessors
  const [stopRows, baleRows] = await Promise.all([
    getShiftStops(plantId, shift.startAt, shift.endAt),
    getBaleCountsByFraction(plantId, shift.startAt, shift.endAt),
  ])

  const totalBales = baleRows.reduce((sum, r) => sum + Number(r.count), 0)

  const oeeResult = calculateOee({
    shiftStart: shift.startAt,
    shiftEnd: shift.endAt,
    nowMs: shift.endAt.getTime(),  // historical shift: fully elapsed
    stopEvents: stopRows.map(s => ({
      startAt: s.startAt,
      endAt: s.endAt,
      stopType: s.stopType as 'fault' | 'idle' | 'planned',
    })),
    baleCount: totalBales,
    nominalBalesPerShift: NOMINAL_BALES_PER_SHIFT,
    qualityFactor: QUALITY_FACTOR,
  })

  return {
    shift: {
      id: shift.id,
      shiftType: shift.shiftType,
      startAt: shift.startAt,
      endAt: shift.endAt,
    },
    oee: oeeResult,
    stops: stopRows.map(s => ({
      startAt: s.startAt,
      endAt: s.endAt,
      reason: s.reason,
      stopType: s.stopType,
    })),
    balesByFraction: baleRows.map(r => ({
      fractionId: r.fractionId,
      name: r.name,
      count: Number(r.count),
    })),
    totalBales,
  }
})

/**
 * Composing accessor: returns the full dashboard payload for a single plant.
 * verifySession() is called here (and deduped via React.cache in sub-accessors)
 * to guarantee dynamic rendering and tenant isolation.
 */
export const getDashboardData = cache(async (plantId: number): Promise<DashboardData> => {
  // verifySession at the top guarantees dynamic rendering even though sub-accessors
  // also call it — React.cache dedupes within the request (RESEARCH Pitfall 6).
  const session = await verifySession()

  const now = new Date()
  const nowMs = now.getTime()

  // -- Plant row --
  const [plant] = await db
    .select({
      id: plants.id,
      name: plants.name,
      nominalCapacityTph: plants.nominalCapacityTph,
    })
    .from(plants)
    .where(
      and(
        eq(plants.tenantId, session.tenantId),
        eq(plants.id, plantId),
      )
    )
    .limit(1)

  // -- Current shift --
  const shift = await getCurrentShiftForPlant(plantId)

  // -- "Today" window: 07:00 Oslo today → now --
  const osloDateStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Oslo' }).format(now)
  const todayBounds = getShiftBoundsUtc(osloDateStr, 'day')
  const todayStart = new Date(todayBounds.startMs)
  const todayEnd = now

  // -- Open stop and latest bunker reading (used for state derivation) --
  const [openStop, latestBunker] = await Promise.all([
    getOpenStop(plantId),
    getLatestBunkerReadingState(plantId),
  ])

  // -- Derive plant state (Pattern 5 ordering from RESEARCH) --
  let state: PlantState
  const threeMinMs = 3 * 60 * 1000
  if (!latestBunker || (nowMs - latestBunker.recordedAt.getTime()) > threeMinMs) {
    state = 'no_data'
  } else if (getShiftType(nowMs) === null) {
    state = 'outside_shift'
  } else if (openStop) {
    state = openStop.stopType === 'idle' ? 'running_empty' : 'stopped'
  } else {
    state = 'running'
  }

  // -- Current-shift window --
  const shiftStart = shift?.startAt ?? null
  const shiftEnd = shift?.endAt ?? null

  // -- OEE for current shift --
  let oee: OeeResult | null = null
  let shiftBaleCount = 0
  if (shift && shiftStart && shiftEnd) {
    const [shiftStopRows, shiftBaleRows] = await Promise.all([
      getShiftStops(plantId, shiftStart, shiftEnd),
      getBaleCountsByFraction(plantId, shiftStart, shiftEnd),
    ])
    shiftBaleCount = shiftBaleRows.reduce((sum, r) => sum + Number(r.count), 0)
    oee = calculateOee({
      shiftStart,
      shiftEnd,
      nowMs,
      stopEvents: shiftStopRows.map(s => ({
        startAt: s.startAt,
        endAt: s.endAt,
        stopType: s.stopType as 'fault' | 'idle' | 'planned',
      })),
      baleCount: shiftBaleCount,
      nominalBalesPerShift: NOMINAL_BALES_PER_SHIFT,
      qualityFactor: QUALITY_FACTOR,
    })
  }

  // -- Today uptime: use calculateOee over [todayStart, now] for shared math --
  const todayStopRows = await getShiftStops(plantId, todayStart, todayEnd)
  const todayBaleRows = await getBaleCountsByFraction(plantId, todayStart, todayEnd)
  const todayBaleCount = todayBaleRows.reduce((sum, r) => sum + Number(r.count), 0)
  // Use a synthetic "shift" window of [todayStart, now] to get run/planned seconds
  const todayOee = calculateOee({
    shiftStart: todayStart,
    shiftEnd: todayEnd,
    nowMs,
    stopEvents: todayStopRows.map(s => ({
      startAt: s.startAt,
      endAt: s.endAt,
      stopType: s.stopType as 'fault' | 'idle' | 'planned',
    })),
    baleCount: todayBaleCount,
    nominalBalesPerShift: NOMINAL_BALES_PER_SHIFT,
    qualityFactor: QUALITY_FACTOR,
  })
  const todayUptime = {
    runSeconds: todayOee.runSeconds,
    plannedSeconds: todayOee.plannedSeconds,
  }

  // -- Throughput vs nominal --
  // expectedBalesSoFar: nominal scaled by elapsed shift fraction
  let expectedBalesSoFar = 0
  if (shift && shiftStart && shiftEnd) {
    const fullShiftMs = shiftEnd.getTime() - shiftStart.getTime()
    const elapsedMs = Math.min(nowMs, shiftEnd.getTime()) - shiftStart.getTime()
    const elapsedFraction = fullShiftMs > 0 ? Math.max(0, elapsedMs) / fullShiftMs : 0
    expectedBalesSoFar = Math.round(NOMINAL_BALES_PER_SHIFT * elapsedFraction)
  }

  // -- Bale counts per fraction: current shift + today --
  const [currentShiftBales, todayBales] = await Promise.all([
    shift && shiftStart && shiftEnd
      ? getBaleCountsByFraction(plantId, shiftStart, shiftEnd)
      : Promise.resolve([] as { fractionId: number; name: string; sortOrder: number; count: number }[]),
    getBaleCountsByFraction(plantId, todayStart, todayEnd),
  ])

  // -- Recent stops --
  const recentStops = await getRecentStops(plantId)

  // -- Current draw: current-shift window, or last 120 min if outside shift --
  const drawFrom = shiftStart ?? new Date(nowMs - 120 * 60 * 1000)
  const drawTo = shiftEnd && shiftEnd.getTime() > nowMs ? now : (shiftEnd ?? now)
  const currentDraw = await getBunkerCurrentDraw(plantId, drawFrom, drawTo)

  return {
    plant: {
      id: plant?.id ?? plantId,
      name: plant?.name ?? '',
      nominalCapacityTph: plant?.nominalCapacityTph ?? null,
    },
    state,
    openStopReason: openStop?.reason ?? null,
    oee,
    todayUptime,
    baleCounts: {
      currentShift: currentShiftBales.map(r => ({ ...r, count: Number(r.count) })),
      today: todayBales.map(r => ({ ...r, count: Number(r.count) })),
    },
    recentStops,
    currentDraw,
    latestReadingAt: latestBunker?.recordedAt ?? null,
    now,
    shift: shift
      ? { startAt: shift.startAt, endAt: shift.endAt, shiftType: shift.shiftType }
      : null,
    throughput: {
      nominalCapacityTph: plant?.nominalCapacityTph ?? null,
      expectedBalesSoFar,
      actualBalesSoFar: shiftBaleCount,
    },
  }
})

// ---------------------------------------------------------------------------
// Task 2: Pareto, bales-per-day, day-vs-evening, energy-proxy accessors
// ---------------------------------------------------------------------------

/**
 * Returns stop-reason aggregates for Pareto analysis in [fromDate, toDate].
 * Raw totals only — cumulative % is computed in JS by the page (RESEARCH anti-pattern avoidance).
 * Only closed stops (endAt IS NOT NULL) with a reason are included.
 */
export const getParetoData = cache(async (
  plantId: number,
  fromDate: string,  // Oslo 'YYYY-MM-DD'
  toDate: string,
): Promise<ParetoRow[]> => {
  const session = await verifySession()
  const { startMs } = getShiftBoundsUtc(fromDate, 'day')
  const { endMs } = getShiftBoundsUtc(toDate, 'evening')

  return db
    .select({
      reason: stopEvents.reason,
      stopType: stopEvents.stopType,
      incidentCount: sql<number>`count(*)`,
      totalSeconds: sql<number>`sum(coalesce(${stopEvents.endAt}, unixepoch()) - ${stopEvents.startAt})`,
    })
    .from(stopEvents)
    .where(
      and(
        eq(stopEvents.tenantId, session.tenantId),
        eq(stopEvents.plantId, plantId),
        isNotNull(stopEvents.reason),
        isNotNull(stopEvents.endAt),
        gte(stopEvents.startAt, new Date(startMs)),
        lt(stopEvents.startAt, new Date(endMs)),
      )
    )
    .groupBy(stopEvents.reason, stopEvents.stopType)
    .orderBy(desc(sql`sum(coalesce(${stopEvents.endAt}, unixepoch()) - ${stopEvents.startAt})`))
    .then(rows => rows.map(r => ({
      reason: r.reason as string,
      stopType: r.stopType,
      incidentCount: Number(r.incidentCount),
      totalSeconds: Number(r.totalSeconds),
    })))
})

/**
 * Returns bale events grouped by Oslo calendar day and fraction in long format.
 * Oslo day derivation done in JS (avoids UTC-vs-Oslo complexity in SQL).
 * Also returns an ordered fractions list so the chart can assign stable colors.
 */
export const getBalesPerDayData = cache(async (
  plantId: number,
  fromDate: string,  // Oslo 'YYYY-MM-DD'
  toDate: string,
): Promise<{ rows: BalesPerDayRow[]; fractions: { id: number; name: string; sortOrder: number }[] }> => {
  const session = await verifySession()
  const { startMs } = getShiftBoundsUtc(fromDate, 'day')
  const { endMs } = getShiftBoundsUtc(toDate, 'evening')

  // Fetch raw bale rows with fraction name
  const rawBales = await db
    .select({
      occurredAt: baleEvents.occurredAt,
      fractionId: baleEvents.fractionId,
      fractionName: fractions.name,
    })
    .from(baleEvents)
    .innerJoin(fractions, eq(fractions.id, baleEvents.fractionId))
    .where(
      and(
        eq(baleEvents.tenantId, session.tenantId),
        eq(baleEvents.plantId, plantId),
        gte(baleEvents.occurredAt, new Date(startMs)),
        lt(baleEvents.occurredAt, new Date(endMs)),
      )
    )

  // Fetch ordered fractions list for the chart
  const fractionList = await db
    .select({ id: fractions.id, name: fractions.name, sortOrder: fractions.sortOrder })
    .from(fractions)
    .where(
      and(
        eq(fractions.tenantId, session.tenantId),
        eq(fractions.plantId, plantId),
      )
    )
    .orderBy(asc(fractions.sortOrder))

  // Group in JS: derive Oslo date string per row via Intl.DateTimeFormat
  const osloFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Oslo' })
  const countMap = new Map<string, number>()

  for (const row of rawBales) {
    const osloDate = osloFormatter.format(row.occurredAt)
    const key = `${osloDate}|${row.fractionId}|${row.fractionName}`
    countMap.set(key, (countMap.get(key) ?? 0) + 1)
  }

  const rows: BalesPerDayRow[] = []
  for (const [key, count] of countMap.entries()) {
    const [osloDate, fractionIdStr, fractionName] = key.split('|')
    rows.push({ osloDate, fractionId: Number(fractionIdStr), fractionName, count })
  }

  // Sort by date then fraction sortOrder for stable output
  const fractionOrder = new Map(fractionList.map((f, i) => [f.id, i]))
  rows.sort((a, b) => {
    const dateCmp = a.osloDate.localeCompare(b.osloDate)
    if (dateCmp !== 0) return dateCmp
    return (fractionOrder.get(a.fractionId) ?? 0) - (fractionOrder.get(b.fractionId) ?? 0)
  })

  return { rows, fractions: fractionList }
})

/**
 * Returns day vs evening comparison over [fromDate, toDate], bucketed by shiftType.
 * Reuses getShiftReportList for OEE consistency (same calculateOee path as the list page).
 * avgUptimePct is weighted (sum(run)/sum(planned)) not a mean of ratios.
 */
export const getDayVsEveningComparison = cache(async (
  plantId: number,
  fromDate: string,  // Oslo 'YYYY-MM-DD'
  toDate: string,
): Promise<ShiftComparisonRow[]> => {
  const allShifts = await getShiftReportList(plantId, fromDate, toDate)

  const buckets = new Map<string, {
    shiftCount: number
    sumOee: number
    sumAvailability: number
    sumPerformance: number
    sumRunSeconds: number
    sumPlannedSeconds: number
    totalBales: number
    totalStopSeconds: number
    totalStopCount: number
  }>()

  for (const shift of allShifts) {
    const existing = buckets.get(shift.shiftType) ?? {
      shiftCount: 0, sumOee: 0, sumAvailability: 0, sumPerformance: 0,
      sumRunSeconds: 0, sumPlannedSeconds: 0, totalBales: 0,
      totalStopSeconds: 0, totalStopCount: 0,
    }
    existing.shiftCount += 1
    existing.sumOee += shift.oee
    existing.sumAvailability += shift.availability
    existing.sumPerformance += shift.performance
    existing.sumRunSeconds += shift.uptimeRunSeconds
    existing.sumPlannedSeconds += shift.uptimePlannedSeconds
    existing.totalBales += shift.totalBales
    existing.totalStopSeconds += shift.stopSeconds
    existing.totalStopCount += shift.stopCount
    buckets.set(shift.shiftType, existing)
  }

  return Array.from(buckets.entries()).map(([shiftType, b]) => ({
    shiftType,
    shiftCount: b.shiftCount,
    avgOee: b.shiftCount > 0 ? b.sumOee / b.shiftCount : 0,
    avgAvailability: b.shiftCount > 0 ? b.sumAvailability / b.shiftCount : 0,
    avgPerformance: b.shiftCount > 0 ? b.sumPerformance / b.shiftCount : 0,
    // weighted avg uptime: sum(run)/sum(planned) across shiftType
    avgUptimePct: b.sumPlannedSeconds > 0 ? b.sumRunSeconds / b.sumPlannedSeconds : 0,
    totalBales: b.totalBales,
    totalStopSeconds: b.totalStopSeconds,
    totalStopCount: b.totalStopCount,
  }))
})

/**
 * Returns average bunker current draw for a single historical shift as an energy proxy.
 * Returns null if no bunker machine or shift not found for this tenant+plant.
 */
export const getShiftEnergyProxy = cache(async (
  plantId: number,
  shiftId: number,
): Promise<ShiftEnergyProxy | null> => {
  const session = await verifySession()

  // Fetch shift (tenant+plant scoped — cross-tenant guard)
  const [shift] = await db
    .select({ startAt: shifts.startAt, endAt: shifts.endAt })
    .from(shifts)
    .where(
      and(
        eq(shifts.id, shiftId),
        eq(shifts.tenantId, session.tenantId),
        eq(shifts.plantId, plantId),
      )
    )
    .limit(1)
  if (!shift) return null

  // Find the bunker machine for this plant+tenant
  const [bunker] = await db
    .select({ id: machines.id, nominalCurrentA: machines.nominalCurrentA })
    .from(machines)
    .where(
      and(
        eq(machines.plantId, plantId),
        eq(machines.tenantId, session.tenantId),
        eq(machines.type, 'bunker'),
      )
    )
    .limit(1)
  if (!bunker) return null

  // Aggregate avg current and reading count for this shift window
  const [result] = await db
    .select({
      avgCurrentA: sql<number>`round(avg(${timeSeriesReadings.currentA}), 2)`,
      readingCount: sql<number>`count(*)`,
    })
    .from(timeSeriesReadings)
    .where(
      and(
        eq(timeSeriesReadings.machineId, bunker.id),
        eq(timeSeriesReadings.tenantId, session.tenantId),
        gte(timeSeriesReadings.recordedAt, shift.startAt),
        lt(timeSeriesReadings.recordedAt, shift.endAt),
      )
    )

  return {
    avgCurrentA: result?.avgCurrentA ?? null,
    nominalCurrentA: bunker.nominalCurrentA,
    readingCount: Number(result?.readingCount ?? 0),
  }
})

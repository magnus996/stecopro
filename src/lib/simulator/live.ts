/**
 * Live simulator — keeps the plant running in real time while `npm run dev` is active.
 *
 * Called once from instrumentation.ts (guarded by globalThis.__SIMULATOR_STARTED__).
 * Opens its OWN WAL Database() connection — NOT @/db/index (which is server-only).
 *
 * Startup sequence:
 *   1. Open DB, resolve ids (plant / machines / fractions).
 *   2. Catch-up: if MAX(recordedAt) is older than ~1 minute, backfill from that
 *      point to now (capped at 24 h to avoid generating forever after a stale DB).
 *   3. Tick: every 60 s, advance one live minute via advanceLiveTick.
 */

import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { eq } from 'drizzle-orm'
import * as schema from '@/db/schema'
import {
  plants,
  tenants,
  machines,
  fractions,
  timeSeriesReadings,
} from '@/db/schema'
import { SqliteIngestAdapter } from '@/lib/ingest/sqlite-adapter'
import { NotifyingAdapter } from '@/lib/ingest/notifying-adapter'
import { advanceLiveTick, runBackfill, type SimContext } from './runner'

// Module-level interval handle (single reference, instrumentation guard prevents duplicates)
let intervalHandle: ReturnType<typeof setInterval> | null = null

/** Maximum catch-up window: do not regenerate more than 24 h of backlog. */
const MAX_CATCHUP_MS = 24 * 60 * 60 * 1000

/** Start the live simulator.  Called exactly once per server bootstrap. */
export function startLive(): void {
  // ── Open own WAL connection ────────────────────────────────────────────────
  const dbPath = process.env.DB_FILE_NAME ?? './stecopro.db'
  const sqlite = new Database(dbPath)
  sqlite.pragma('journal_mode = WAL')
  sqlite.pragma('busy_timeout = 5000')
  sqlite.pragma('synchronous = NORMAL')
  const db = drizzle(sqlite, { schema })

  // ── Resolve ids ───────────────────────────────────────────────────────────
  const plantRows = db.select().from(plants).all()
  if (plantRows.length === 0) {
    console.warn('[simulator] live mode: no plant found — skipping start (run db:seed first)')
    sqlite.close()
    return
  }
  const plant = plantRows[0]

  const tenantRows = db
    .select()
    .from(tenants)
    .where(eq(tenants.id, plant.tenantId))
    .all()
  if (tenantRows.length === 0) {
    console.warn('[simulator] live mode: tenant not found — skipping start')
    sqlite.close()
    return
  }
  const tenantId = tenantRows[0].id

  // Machine discovery: map by type
  const machineRows = db
    .select()
    .from(machines)
    .where(eq(machines.plantId, plant.id))
    .all()

  const machineByType: Record<string, number> = {}
  for (const m of machineRows) {
    machineByType[m.type] = m.id
  }

  const requiredMachineTypes = ['bunker', 'conveyor', 'press'] as const
  for (const t of requiredMachineTypes) {
    if (machineByType[t] === undefined) {
      console.warn(`[simulator] live mode: machine type '${t}' not found — skipping start (run db:seed first)`)
      sqlite.close()
      return
    }
  }

  // Fraction discovery: map by name
  const fractionRows = db
    .select()
    .from(fractions)
    .where(eq(fractions.plantId, plant.id))
    .all()

  const fractionByName: Record<string, number> = {}
  for (const f of fractionRows) {
    fractionByName[f.name] = f.id
  }

  const requiredFractions = ['Deink', 'Tetra/emballasjepapp', 'OCC', 'Miks'] as const
  for (const name of requiredFractions) {
    if (fractionByName[name] === undefined) {
      console.warn(`[simulator] live mode: fraction '${name}' not found — skipping start (run db:seed first)`)
      sqlite.close()
      return
    }
  }

  const ctx: SimContext = {
    plantId: plant.id,
    tenantId,
    machineIds: {
      bunker: machineByType['bunker'],
      conveyor: machineByType['conveyor'],
      press: machineByType['press'],
    },
    fractionIds: fractionByName,
  }

  // Plain adapter for backfill (catch-up must NEVER notify — no storm on restart)
  const adapter = new SqliteIngestAdapter(db, tenantId)
  // Notifying adapter for the live interval tick ONLY
  const notifyingAdapter = new NotifyingAdapter(adapter, db, { tenantId, plantId: plant.id, plantName: plant.name })

  // ── Catch-up ──────────────────────────────────────────────────────────────
  // Read MAX(recordedAt) — column is camelCase (Drizzle maps to "recordedAt")
  const maxRow = sqlite
    .prepare('SELECT MAX("recordedAt") AS maxAt FROM time_series_readings')
    .get() as { maxAt: number | null }

  const now = new Date()
  const nowMs = now.getTime()

  if (maxRow?.maxAt !== null && maxRow?.maxAt !== undefined) {
    // Drizzle integer({ mode: 'timestamp' }) stores Unix seconds (not ms) in better-sqlite3
    const lastMs = maxRow.maxAt * 1000
    const gapMs = nowMs - lastMs

    if (gapMs > 60_000) {
      // There is a gap to fill — cap at MAX_CATCHUP_MS so a very stale DB
      // doesn't generate hours of data synchronously on every server start.
      const catchupFromMs = Math.max(lastMs, nowMs - MAX_CATCHUP_MS)
      const catchupFromDate = new Date(catchupFromMs)

      console.log(
        `[simulator] catch-up: filling gap from ${catchupFromDate.toISOString()} to now` +
        ` (${Math.round(gapMs / 60000)} min gap, capped at ${MAX_CATCHUP_MS / 3600000} h)`,
      )

      // runBackfill already skips future shifts and is idempotent via ensureShift.
      // We pass a custom "now" so it only fills up to the current moment.
      // Use the capped window (not the actual gap) to compute daysBack.
      const cappedGapMs = nowMs - catchupFromMs
      runBackfill(adapter, ctx, { daysBack: Math.ceil(cappedGapMs / 86400000) + 1, now })
    }
  }

  // ── Tick every 60 s ───────────────────────────────────────────────────────
  intervalHandle = setInterval(() => {
    try {
      advanceLiveTick(notifyingAdapter, ctx, new Date())
      notifyingAdapter.flush()
    } catch (e) {
      console.error('[simulator] live tick failed', e)
    }
  }, 60_000)

  console.log('[simulator] live mode started')
}

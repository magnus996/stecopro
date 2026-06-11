/**
 * Standalone backfill script — run via: npm run db:simulate
 *
 * Own Database() connection (NOT @/db/index which is server-only).
 * Discovers real plant/machine/fraction ids from the DB.
 * Idempotently clears event tables then runs 14 days of backfill.
 * Prints summary counts and a computed availability percentage.
 *
 * Requires: npm run db:seed (plant/machines/fractions must exist first)
 */

import 'dotenv/config'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import { eq } from 'drizzle-orm'
import * as schema from '../src/db/schema'
import {
  tenants,
  plants,
  machines,
  fractions,
  shifts,
  baleEvents,
  stopEvents,
  timeSeriesReadings,
} from '../src/db/schema'
import { SqliteIngestAdapter } from '../src/lib/ingest/sqlite-adapter'
import { runBackfill, type SimContext } from '../src/lib/simulator/runner'

// ---------------------------------------------------------------------------
// Open own DB connection (never import @/db/index — server-only)
// ---------------------------------------------------------------------------
const dbPath = process.env.DB_FILE_NAME ?? './stecopro.db'
const sqlite = new Database(dbPath)
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('busy_timeout = 5000')
sqlite.pragma('synchronous = NORMAL')
const db = drizzle(sqlite, { schema })

async function simulate() {
  console.log('Simulating backfill into:', dbPath)

  // -------------------------------------------------------------------------
  // Discover ids (never hardcode)
  // -------------------------------------------------------------------------
  const plantRows = db.select().from(plants).all()
  if (plantRows.length === 0) {
    console.error('ERROR: No plant found. Run `npm run db:seed` first.')
    sqlite.close()
    process.exit(1)
  }
  const plant = plantRows[0]

  // Discover tenantId from plant
  const tenantRows = db
    .select()
    .from(tenants)
    .where(eq(tenants.id, plant.tenantId))
    .all()
  if (tenantRows.length === 0) {
    console.error('ERROR: Tenant not found for plant. Run `npm run db:seed` first.')
    sqlite.close()
    process.exit(1)
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
      console.error(`ERROR: Machine type '${t}' not found. Run \`npm run db:seed\` first.`)
      sqlite.close()
      process.exit(1)
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
      console.error(`ERROR: Fraction '${name}' not found. Run \`npm run db:seed\` first.`)
      sqlite.close()
      process.exit(1)
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

  console.log('Plant:', plant.name, '(id:', plant.id, ', tenant:', tenantId, ')')
  console.log('Machines:', ctx.machineIds)
  console.log('Fractions:', ctx.fractionIds)

  // -------------------------------------------------------------------------
  // Idempotent cleanup (FK-safe: leaves first, leave seeds intact)
  // -------------------------------------------------------------------------
  console.log('Clearing prior event data...')
  db.delete(schema.timeSeriesReadings).run()
  db.delete(schema.baleEvents).run()
  db.delete(schema.stopEvents).run()
  db.delete(schema.shifts).run()
  console.log('Cleared: time_series_readings, bale_events, stop_events, shifts')

  // -------------------------------------------------------------------------
  // Run backfill through the adapter (no direct table writes after this point)
  // -------------------------------------------------------------------------
  const adapter = new SqliteIngestAdapter(db, tenantId)
  console.log('Running 14-day backfill...')

  const t0 = Date.now()
  runBackfill(adapter, ctx, { daysBack: 14 })
  const elapsed = Date.now() - t0

  console.log(`Backfill complete in ${elapsed}ms`)

  // -------------------------------------------------------------------------
  // Print summary counts
  // -------------------------------------------------------------------------
  const shiftCount = db.select().from(shifts).all().length
  const stopCount = db.select().from(stopEvents).all().length
  const baleCount = db.select().from(baleEvents).all().length
  const readingCount = db.select().from(timeSeriesReadings).all().length

  console.log('\n=== Summary ===')
  console.log('  shifts              :', shiftCount)
  console.log('  stop_events         :', stopCount)
  console.log('  bale_events         :', baleCount)
  console.log('  time_series_readings:', readingCount)

  // -------------------------------------------------------------------------
  // Compute availability
  // -------------------------------------------------------------------------
  // Availability = running minutes / total shift minutes
  // We estimate from runState in time_series_readings for machine 0 (bunker).
  // Only count one reading per timestamp per machine to avoid triple-counting.

  const bunkerMachineId = ctx.machineIds.bunker
  const allReadings = db
    .select()
    .from(timeSeriesReadings)
    .where(eq(timeSeriesReadings.machineId, bunkerMachineId))
    .all()

  const totalReadings = allReadings.length
  const runningReadings = allReadings.filter((r) => r.runState).length
  const availability = totalReadings > 0 ? runningReadings / totalReadings : 0

  console.log(`  availability        : ${(availability * 100).toFixed(1)}%`)
  console.log(`                        (${runningReadings} running / ${totalReadings} total bunker readings)`)
  console.log('')

  if (shiftCount === 0 || readingCount === 0) {
    console.error('ERROR: No data written — backfill may have silently failed.')
    sqlite.close()
    process.exit(1)
  }

  console.log('Done.')
}

simulate()
  .then(() => {
    sqlite.close()
    process.exit(0)
  })
  .catch((err) => {
    console.error('Simulate failed:', err)
    sqlite.close()
    process.exit(1)
  })

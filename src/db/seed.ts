/**
 * Demo seed — run via: npm run db:seed
 *
 * Idempotent: deletes all rows (FK-safe order) before inserting,
 * so re-running yields a clean, predictable state.
 *
 * Seeds:
 *   - 2 tenants (Steco Demo + Isolasjonstest)
 *   - 5 users  (4 roles in tenant 1, 1 operator in tenant 2)
 *   - 2 plants  (Returpapir Linje 1 tenant 1 + Test Linje 1 tenant 2)
 *   - 4 fractions (tenant 1) + 2 fractions (tenant 2)
 *   - 3 machines  (tenant 1) + 1 machine (tenant 2)
 *   - 1 week of static shift/bale/stop/reading rows for tenant 2
 */
import bcrypt from 'bcryptjs'
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import * as schema from './schema'
import {
  tenants,
  users,
  plants,
  fractions,
  machines,
  shifts,
  baleEvents,
  stopEvents,
  timeSeriesReadings,
} from './schema'
import { getShiftBoundsUtc } from '../lib/time'

// Direct DB connection (not the server-only singleton) — seed runs outside Next.js
const dbPath = process.env.DB_FILE_NAME ?? './stecopro.db'
const sqlite = new Database(dbPath)
const db = drizzle(sqlite, { schema })

async function seed() {
  console.log('Seeding database:', dbPath)

  // ------------------------------------------------------------------
  // Idempotent cleanup (FK-safe order: leaves → parents)
  // Phase 7 tables must be deleted before their referenced tables
  // ------------------------------------------------------------------
  db.delete(schema.stopAcknowledgements).run()
  db.delete(schema.stopComments).run()
  db.delete(schema.shiftNotes).run()
  db.delete(schema.photos).run()
  db.delete(schema.pushSubscriptions).run()
  db.delete(schema.timeSeriesReadings).run()
  db.delete(schema.baleEvents).run()
  db.delete(schema.baleShipments).run()
  db.delete(schema.stopEvents).run()
  db.delete(schema.shifts).run()
  db.delete(schema.machines).run()
  db.delete(schema.fractions).run()
  db.delete(schema.plants).run()
  db.delete(schema.users).run()
  db.delete(schema.tenants).run()
  console.log('Cleared existing rows.')

  // ------------------------------------------------------------------
  // Hash demo password (shared across all demo accounts)
  // ------------------------------------------------------------------
  const demoHash = await bcrypt.hash('demo123', 10)

  // ------------------------------------------------------------------
  // Tenant 1: Steco Demo — the primary returpapir demo plant
  // ------------------------------------------------------------------
  const [tenant1] = db
    .insert(tenants)
    .values({ name: 'Steco Demo', slug: 'steco-demo', createdAt: new Date() })
    .returning()
    .all()

  await db.insert(users).values([
    {
      tenantId: tenant1.id,
      email: 'operator@steco-demo.no',
      name: 'Ole Operatør',
      role: 'operator',
      passwordHash: demoHash,
      active: true,
      createdAt: new Date(),
    },
    {
      tenantId: tenant1.id,
      email: 'leder@steco-demo.no',
      name: 'Lise Leder',
      role: 'produksjonsleder',
      passwordHash: demoHash,
      active: true,
      createdAt: new Date(),
    },
    {
      tenantId: tenant1.id,
      email: 'admin@steco-demo.no',
      name: 'Arne Admin',
      role: 'admin',
      passwordHash: demoHash,
      active: true,
      createdAt: new Date(),
    },
    {
      // system_admin lives in tenant 1 for Phase 1; Phase 5 adds proper tenant mgmt
      tenantId: tenant1.id,
      email: 'system@steco.no',
      name: 'Steco System',
      role: 'system_admin',
      passwordHash: demoHash,
      active: true,
      createdAt: new Date(),
    },
  ])

  // ------------------------------------------------------------------
  // Tenant 2: Isolasjonstest — proves data isolation in later phases
  // ------------------------------------------------------------------
  const [tenant2] = db
    .insert(tenants)
    .values({ name: 'Isolasjonstest', slug: 'isolasjonstest', createdAt: new Date() })
    .returning()
    .all()

  await db.insert(users).values({
    tenantId: tenant2.id,
    email: 'bruker@isolasjonstest.no',
    name: 'Isolert Bruker',
    role: 'operator',
    passwordHash: demoHash,
    active: true,
    createdAt: new Date(),
  })

  // ------------------------------------------------------------------
  // Plant (tenant 1)
  // ------------------------------------------------------------------
  const [plant1] = db
    .insert(plants)
    .values({
      tenantId: tenant1.id,
      name: 'Returpapir Linje 1',
      description: 'Sorteringslinje for returpapir og emballasjepapp',
      nominalCapacityTph: 10,
      createdAt: new Date(),
    })
    .returning()
    .all()

  // ------------------------------------------------------------------
  // Fractions — sortOrder matches display order on dashboards
  // ------------------------------------------------------------------
  await db.insert(fractions).values([
    { tenantId: tenant1.id, plantId: plant1.id, name: 'Deink', sortOrder: 0 },
    { tenantId: tenant1.id, plantId: plant1.id, name: 'Tetra/emballasjepapp', sortOrder: 1 },
    { tenantId: tenant1.id, plantId: plant1.id, name: 'OCC', sortOrder: 2 },
    { tenantId: tenant1.id, plantId: plant1.id, name: 'Miks', sortOrder: 3 },
  ])

  // ------------------------------------------------------------------
  // Machines — nominalCurrentA reflects typical motor sizing
  // ------------------------------------------------------------------
  await db.insert(machines).values([
    {
      tenantId: tenant1.id,
      plantId: plant1.id,
      name: 'Doseringsbunker',
      type: 'bunker',
      nominalCurrentA: 15,
      createdAt: new Date(),
    },
    {
      tenantId: tenant1.id,
      plantId: plant1.id,
      name: 'Hovedtransportbånd',
      type: 'conveyor',
      nominalCurrentA: 30,
      createdAt: new Date(),
    },
    {
      tenantId: tenant1.id,
      plantId: plant1.id,
      name: 'Presse 1',
      type: 'press',
      nominalCurrentA: 75,
      createdAt: new Date(),
    },
  ])

  // ------------------------------------------------------------------
  // Plant (tenant 2) — minimal isolation-proof plant
  // ------------------------------------------------------------------
  const [plant2] = db
    .insert(plants)
    .values({
      tenantId: tenant2.id,
      name: 'Test Linje 1',
      description: 'Testanlegg for isolasjonstest',
      nominalCapacityTph: 8,
      createdAt: new Date(),
    })
    .returning()
    .all()

  // Fractions for tenant 2
  const [fracA, fracB] = db
    .insert(fractions)
    .values([
      { tenantId: tenant2.id, plantId: plant2.id, name: 'Fraksjon A', sortOrder: 0 },
      { tenantId: tenant2.id, plantId: plant2.id, name: 'Fraksjon B', sortOrder: 1 },
    ])
    .returning()
    .all()

  // Machine for tenant 2
  const [machine2] = db
    .insert(machines)
    .values({
      tenantId: tenant2.id,
      plantId: plant2.id,
      name: 'Bunker T2',
      type: 'bunker',
      nominalCurrentA: 30,
      createdAt: new Date(),
    })
    .returning()
    .all()

  // ------------------------------------------------------------------
  // Static production history for tenant 2 — last 7 Oslo calendar days,
  // two shifts/day (day 07–15, evening 15–22).
  // Deterministic: proves isolation visually without a live simulator.
  // ------------------------------------------------------------------
  const now = Date.now()
  const osloFmt = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Oslo' })

  let shiftCount = 0
  let baleCount = 0
  let stopCount = 0
  let readingCount = 0

  for (let daysAgo = 7; daysAgo >= 1; daysAgo--) {
    const dayMs = now - daysAgo * 24 * 60 * 60 * 1000
    const osloDateStr = osloFmt.format(new Date(dayMs))

    for (const shiftType of ['day', 'evening'] as const) {
      const { startMs, endMs } = getShiftBoundsUtc(osloDateStr, shiftType)

      // Skip shifts that haven't ended yet
      if (endMs > now) continue

      // Insert shift row
      const [shiftRow] = db
        .insert(shifts)
        .values({
          tenantId: tenant2.id,
          plantId: plant2.id,
          shiftType,
          startAt: new Date(startMs),
          endAt: new Date(endMs),
        })
        .returning()
        .all()
      shiftCount++

      const shiftDurationMs = endMs - startMs // typically 8h or 7h

      // ----------------------------------------------------------------
      // 6 bale events spread evenly across the shift, alternating fractions
      // ----------------------------------------------------------------
      const balesPerShift = 6
      for (let i = 0; i < balesPerShift; i++) {
        const fraction = i % 2 === 0 ? fracA : fracB
        // Spread evenly: position i at (i+0.5)/balesPerShift of shift duration
        const offsetMs = Math.floor(((i + 0.5) / balesPerShift) * shiftDurationMs)
        const occurredAt = new Date(startMs + offsetMs)
        db.insert(baleEvents)
          .values({
            tenantId: tenant2.id,
            plantId: plant2.id,
            fractionId: fraction.id,
            machineId: machine2.id,
            occurredAt,
            weightKg: 480 + (i * 13) % 80, // 480–559 kg, deterministic variation
          })
          .run()
        baleCount++
      }

      // ----------------------------------------------------------------
      // 1–2 stop events per shift (closed, short duration)
      // Stop 1: fault at 25% into shift, 6-min duration
      // Stop 2 (every other shift based on daysAgo parity): idle at 65%, 5-min duration
      // ----------------------------------------------------------------
      const stop1StartMs = startMs + Math.floor(shiftDurationMs * 0.25)
      db.insert(stopEvents)
        .values({
          tenantId: tenant2.id,
          plantId: plant2.id,
          startAt: new Date(stop1StartMs),
          endAt: new Date(stop1StartMs + 6 * 60 * 1000),
          reason: 'driftsstans transportbånd',
          stopType: 'fault',
        })
        .run()
      stopCount++

      if (daysAgo % 2 === 0) {
        const stop2StartMs = startMs + Math.floor(shiftDurationMs * 0.65)
        db.insert(stopEvents)
          .values({
            tenantId: tenant2.id,
            plantId: plant2.id,
            startAt: new Date(stop2StartMs),
            endAt: new Date(stop2StartMs + 5 * 60 * 1000),
            reason: 'Bunker tom',
            stopType: 'idle',
          })
          .run()
        stopCount++
      }

      // ----------------------------------------------------------------
      // 8 time series readings spread across the shift for the bunker machine.
      // Most readings: currentA ~25–32 (running), runState true.
      // Two dips at reading indices 2 and 5: currentA ~2 (idle), runState false.
      // These are historical (not "live now") — no reading at or after now.
      // ----------------------------------------------------------------
      const readingsPerShift = 8
      for (let i = 0; i < readingsPerShift; i++) {
        const offsetMs = Math.floor(((i + 0.5) / readingsPerShift) * shiftDurationMs)
        const recordedAt = new Date(startMs + offsetMs)

        // Skip any reading that would be at/after now (safety guard)
        if (recordedAt.getTime() >= now) continue

        const isIdle = i === 2 || i === 5
        const currentA = isIdle ? 2.1 : 26 + (i * 3) % 7 // 26–32 A when running
        const runState = !isIdle

        db.insert(timeSeriesReadings)
          .values({
            tenantId: tenant2.id,
            machineId: machine2.id,
            recordedAt,
            currentA,
            runState,
          })
          .run()
        readingCount++
      }
    }
  }

  // ------------------------------------------------------------------
  // Summary
  // ------------------------------------------------------------------
  const counts = {
    tenants: db.select().from(tenants).all().length,
    users: db.select().from(users).all().length,
    plants: db.select().from(plants).all().length,
    fractions: db.select().from(fractions).all().length,
    machines: db.select().from(machines).all().length,
    shifts: shiftCount,
    baleEvents: baleCount,
    stopEvents: stopCount,
    timeSeriesReadings: readingCount,
  }
  console.log('Seed complete:', counts)
}

seed()
  .then(() => {
    sqlite.close()
    process.exit(0)
  })
  .catch((err) => {
    console.error('Seed failed:', err)
    sqlite.close()
    process.exit(1)
  })

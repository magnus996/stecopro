/**
 * Demo seed — run via: npm run db:seed
 *
 * Idempotent: deletes all rows (FK-safe order) before inserting,
 * so re-running yields a clean, predictable state.
 *
 * Seeds:
 *   - 2 tenants (Steco Demo + Isolasjonstest)
 *   - 5 users  (4 roles in tenant 1, 1 operator in tenant 2)
 *   - 1 plant  (Returpapir Linje 1, tenant 1)
 *   - 4 fractions (Deink, Tetra/emballasjepapp, OCC, Miks)
 *   - 3 machines  (Doseringsbunker, Hovedtransportbånd, Presse 1)
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
} from './schema'

// Direct DB connection (not the server-only singleton) — seed runs outside Next.js
const dbPath = process.env.DB_FILE_NAME ?? './stecopro.db'
const sqlite = new Database(dbPath)
const db = drizzle(sqlite, { schema })

async function seed() {
  console.log('Seeding database:', dbPath)

  // ------------------------------------------------------------------
  // Idempotent cleanup (FK-safe order: leaves → parents)
  // ------------------------------------------------------------------
  db.delete(schema.timeSeriesReadings).run()
  db.delete(schema.baleEvents).run()
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
      nominalCapacityTph: 12,
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
      nominalCurrentA: 45,
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
  // Summary
  // ------------------------------------------------------------------
  const counts = {
    tenants: db.select().from(tenants).all().length,
    users: db.select().from(users).all().length,
    plants: db.select().from(plants).all().length,
    fractions: db.select().from(fractions).all().length,
    machines: db.select().from(machines).all().length,
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

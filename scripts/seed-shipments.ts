/**
 * Standalone post-simulate shipment seeding script — run via: npm run seed-shipments
 *
 * Must run AFTER db:simulate (simulate clears bale_events and regenerates them).
 * Own better-sqlite3 connection (NOT @/db/index which is server-only).
 *
 * Idempotent: DELETEs this tenant's bale_shipments first, then re-seeds.
 * Ships floor(produced * 0.95) bales per fraction so ~5% (tens of bales) remain in stock.
 */

import 'dotenv/config'
import Database from 'better-sqlite3'

const dbPath = process.env.DB_FILE_NAME ?? './stecopro.db'
const sqlite = new Database(dbPath)
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('busy_timeout = 5000')
sqlite.pragma('synchronous = NORMAL')

async function seedShipments() {
  console.log('Seeding shipments into:', dbPath)

  // Discover plant (same pattern as simulate.ts — plantRows[0])
  const plantRow = sqlite.prepare('SELECT id, tenant_id FROM plants ORDER BY id LIMIT 1').get() as
    | { id: number; tenant_id: number }
    | undefined

  if (!plantRow) {
    console.error('ERROR: No plant found. Run `npm run db:seed` first.')
    sqlite.close()
    process.exit(1)
  }

  const plantId = plantRow.id
  const tenantId = plantRow.tenant_id

  console.log('Plant id:', plantId, '| tenant id:', tenantId)

  // Idempotency: delete this tenant's existing shipments
  const deleted = sqlite
    .prepare('DELETE FROM bale_shipments WHERE tenant_id = ?')
    .run(tenantId)
  console.log('Cleared', deleted.changes, 'prior shipment row(s) for tenant', tenantId)

  // Count produced bales per fraction for this plant
  const fractionCounts = sqlite
    .prepare(
      'SELECT fraction_id, COUNT(*) AS cnt FROM bale_events WHERE plant_id = ? GROUP BY fraction_id',
    )
    .all(plantId) as { fraction_id: number; cnt: number }[]

  if (fractionCounts.length === 0) {
    console.error('ERROR: No bale_events found. Run `npm run db:simulate` first.')
    sqlite.close()
    process.exit(1)
  }

  // Prepare insert statement (shippedAt and createdAt as ms-epoch integers — Drizzle timestamp mode)
  // Note: schema.ts uses integer({ mode: 'timestamp' }) without explicit column name for shippedAt/createdAt,
  // so SQLite stores them as camelCase column names: "shippedAt", "createdAt".
  const insert = sqlite.prepare(
    `INSERT INTO bale_shipments
      (tenant_id, plant_id, fraction_id, bale_count, "shippedAt", note, created_by_id, "createdAt")
     VALUES
      (?, ?, ?, ?, ?, ?, NULL, ?)`,
  )

  const now = Date.now()
  const shippedAt = now
  const createdAt = now

  console.log('\n=== Shipment Seed ===')

  for (const row of fractionCounts) {
    const produced = Number(row.cnt)
    const toShip = Math.floor(produced * 0.95)
    if (toShip === 0) {
      console.log(`  fraction ${row.fraction_id}: produced=${produced} — skipping (0 to ship)`)
      continue
    }

    insert.run(tenantId, plantId, row.fraction_id, toShip, shippedAt, 'Demo-utsendelse', createdAt)
    const remaining = produced - toShip
    console.log(
      `  fraction ${row.fraction_id}: produced=${produced}  shipped=${toShip}  stock=${remaining}`,
    )
  }

  // Fetch fraction names for a prettier summary
  const fractions = sqlite
    .prepare('SELECT id, name FROM fractions WHERE plant_id = ?')
    .all(plantId) as { id: number; name: string }[]
  const nameMap = new Map(fractions.map(f => [f.id, f.name]))

  console.log('\n=== Stock Summary ===')
  let allOk = true
  for (const row of fractionCounts) {
    const produced = Number(row.cnt)
    const shipped = Math.floor(produced * 0.95)
    const stock = produced - shipped
    const name = nameMap.get(row.fraction_id) ?? `fraction ${row.fraction_id}`
    console.log(`  ${name.padEnd(30)} produced=${String(produced).padStart(5)}  shipped=${String(shipped).padStart(5)}  stock=${String(stock).padStart(4)}`)
    if (stock < 0 || stock > 500) {
      console.error(`  ERROR: stock out of plausible range for fraction ${row.fraction_id}`)
      allOk = false
    }
  }

  if (!allOk) {
    sqlite.close()
    process.exit(1)
  }

  console.log('\nDone.')
}

seedShipments()
  .then(() => {
    sqlite.close()
    process.exit(0)
  })
  .catch((err) => {
    console.error('seed-shipments failed:', err)
    sqlite.close()
    process.exit(1)
  })

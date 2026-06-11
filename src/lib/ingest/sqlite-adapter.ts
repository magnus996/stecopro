import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import { eq, and } from 'drizzle-orm'
import * as schema from '@/db/schema'
import type { IngestAdapter, StopType, ShiftType } from './interface'

/**
 * SQLite implementation of IngestAdapter using Drizzle ORM.
 *
 * Receives a Drizzle db instance in its constructor so both the backfill script
 * and live runner can pass their own connection. Does NOT import @/db/index —
 * that file is server-only and throws outside the Next.js request context.
 *
 * reportReading buffers rows into pendingReadings; flush() writes them in a
 * single transaction (25ms for 40k rows — the batch pattern from research).
 * All other writes happen immediately since they are low-volume and the engine
 * needs returned IDs synchronously.
 */
export class SqliteIngestAdapter implements IngestAdapter {
  private pendingReadings: (typeof schema.timeSeriesReadings.$inferInsert)[] = []

  constructor(
    private db: BetterSQLite3Database<typeof schema>,
    private tenantId: number,
  ) {}

  reportReading(machineId: number, recordedAt: Date, currentA: number, runState: boolean): void {
    this.pendingReadings.push({ tenantId: this.tenantId, machineId, recordedAt, currentA, runState })
  }

  reportStop(plantId: number, startAt: Date, reason: string, stopType: StopType): number {
    const [row] = this.db
      .insert(schema.stopEvents)
      .values({ tenantId: this.tenantId, plantId, startAt, endAt: null, reason, stopType })
      .returning()
      .all()
    return row.id
  }

  reportStopEnded(stopEventId: number, endAt: Date): void {
    this.db
      .update(schema.stopEvents)
      .set({ endAt })
      .where(eq(schema.stopEvents.id, stopEventId))
      .run()
  }

  reportBale(plantId: number, fractionId: number, machineId: number | null, occurredAt: Date, weightKg?: number): void {
    this.db
      .insert(schema.baleEvents)
      .values({ tenantId: this.tenantId, plantId, fractionId, machineId, occurredAt, weightKg })
      .run()
  }

  ensureShift(plantId: number, shiftType: ShiftType, startAt: Date, endAt: Date): number {
    const existing = this.db
      .select({ id: schema.shifts.id })
      .from(schema.shifts)
      .where(
        and(
          eq(schema.shifts.plantId, plantId),
          eq(schema.shifts.shiftType, shiftType),
          eq(schema.shifts.startAt, startAt),
        ),
      )
      .all()

    if (existing.length > 0) {
      return existing[0].id
    }

    const [row] = this.db
      .insert(schema.shifts)
      .values({ tenantId: this.tenantId, plantId, shiftType, startAt, endAt })
      .returning()
      .all()
    return row.id
  }

  flush(): void {
    if (this.pendingReadings.length === 0) return
    const readings = this.pendingReadings
    this.db.transaction((tx) => {
      for (const r of readings) {
        tx.insert(schema.timeSeriesReadings).values(r).run()
      }
    })
    this.pendingReadings = []
  }
}

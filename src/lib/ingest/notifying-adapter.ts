/**
 * NotifyingAdapter — decorator around IngestAdapter that fires notifyStop
 * after each reportStop call.
 *
 * IMPORTANT: Only the live interval tick should use this adapter.
 * runBackfill MUST use the plain SqliteIngestAdapter to avoid notification
 * storms when catching up after a restart.
 *
 * The notify call is fire-and-forget (void ... .catch) so a push failure
 * NEVER breaks the synchronous ingest path.
 */

import type { IngestAdapter, StopType, ShiftType } from './interface'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import * as schema from '@/db/schema'
import { notifyStop } from '@/lib/notifier/notifier'

export class NotifyingAdapter implements IngestAdapter {
  constructor(
    private inner: IngestAdapter,
    private db: BetterSQLite3Database<typeof schema>,
    private ctx: { tenantId: number; plantId: number; plantName: string },
  ) {}

  reportReading(...a: Parameters<IngestAdapter['reportReading']>): void {
    return this.inner.reportReading(...a)
  }

  reportStopEnded(...a: Parameters<IngestAdapter['reportStopEnded']>): void {
    return this.inner.reportStopEnded(...a)
  }

  reportBale(...a: Parameters<IngestAdapter['reportBale']>): void {
    return this.inner.reportBale(...a)
  }

  ensureShift(...a: Parameters<IngestAdapter['ensureShift']>): number {
    return this.inner.ensureShift(...a)
  }

  flush(): void {
    return this.inner.flush()
  }

  reportStop(plantId: number, startAt: Date, reason: string, stopType: StopType): number {
    const id = this.inner.reportStop(plantId, startAt, reason, stopType)
    // fire-and-forget — never let a notify failure break the synchronous ingest path
    void notifyStop(this.db, {
      tenantId: this.ctx.tenantId,
      plantId,
      plantName: this.ctx.plantName,
      stopId: id,
      reason,
      stopType,
      startAtMs: startAt.getTime(),
    }).catch((e) => console.error('[notifier] notifyStop failed', e))
    return id
  }
}

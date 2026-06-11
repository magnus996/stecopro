import { NextRequest, NextResponse } from 'next/server'
import { getApiSession } from '@/lib/api-auth'
import { db } from '@/db'
import { plants, stopEvents } from '@/db/schema'
import { and, eq, isNull, lt } from 'drizzle-orm'
import { SqliteIngestAdapter } from '@/lib/ingest/sqlite-adapter'
import { notifyStop } from '@/lib/notifier/notifier'
import type { StopType } from '@/lib/ingest/interface'

/**
 * POST /api/dev/trigger-stop
 *
 * Injects a synthetic stop event via the ingest adapter and immediately fires
 * a push notification. Used by the demo button and E2E probe.
 *
 * Returns { ok, stopId, attempted, sent, pruned } as the E2E assertion hook.
 *
 * Authorization:
 *   - Production: admin or system_admin only
 *   - Development (NODE_ENV !== 'production'): any authenticated session
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getApiSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Role guard in production
    if (process.env.NODE_ENV === 'production') {
      if (!(['admin', 'system_admin'] as string[]).includes(session.role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    // Resolve the tenant's first plant
    const plantRows = await db
      .select()
      .from(plants)
      .where(eq(plants.tenantId, session.tenantId))

    const plant = plantRows[0]
    if (!plant) {
      return NextResponse.json(
        { error: 'No plant found for this tenant. Run db:seed first.' },
        { status: 400 },
      )
    }

    // Parse optional body
    let body: { reason?: string; stopType?: string; durationMin?: number } = {}
    try {
      body = await req.json()
    } catch {
      // No body is fine — use defaults
    }

    const stopType: StopType =
      body.stopType === 'idle' ? 'idle' :
      body.stopType === 'planned' ? 'planned' :
      'fault'

    const reason =
      body.reason ??
      (stopType === 'idle' ? 'Bunker tom' : 'driftsstans transportbånd')

    // Clean up zombie test stops: any open stop older than 10 minutes was
    // most likely triggered here and never closed (the live simulator only
    // closes stops it created itself). Without this, a forgotten test stop
    // keeps the dashboard on "Stanset" forever.
    const tenMinAgo = new Date(Date.now() - 10 * 60 * 1000)
    await db
      .update(stopEvents)
      .set({ endAt: new Date() })
      .where(
        and(
          eq(stopEvents.tenantId, session.tenantId),
          eq(stopEvents.plantId, plant.id),
          isNull(stopEvents.endAt),
          lt(stopEvents.startAt, tenMinAgo),
        ),
      )

    // Inject stop via adapter
    const adapter = new SqliteIngestAdapter(db, session.tenantId)
    const stopId = adapter.reportStop(plant.id, new Date(), reason, stopType)

    // Auto-close the test stop after durationMin (default 2, max 30) so the
    // dashboard shows the red "Stanset" state for a demo-friendly window and
    // then recovers on its own.
    const durationMin = Math.min(Math.max(body.durationMin ?? 2, 0), 30)
    setTimeout(() => {
      try {
        adapter.reportStopEnded(stopId, new Date())
      } catch (e) {
        console.error('[trigger-stop] auto-close failed:', e)
      }
    }, durationMin * 60 * 1000)

    // Fire notification (errors are isolated inside notifyStop)
    const result = await notifyStop(db, {
      tenantId: session.tenantId,
      plantId: plant.id,
      plantName: plant.name,
      stopId,
      reason,
      stopType,
      startAtMs: Date.now(),
    })

    return NextResponse.json({ ok: true, stopId, ...result })
  } catch (e) {
    const err = e as Error
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

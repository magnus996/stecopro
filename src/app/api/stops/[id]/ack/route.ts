import { NextRequest, NextResponse } from 'next/server'
import { getApiSession } from '@/lib/api-auth'
import { db } from '@/db'
import { stopEvents, stopAcknowledgements } from '@/db/schema'
import { eq, and } from 'drizzle-orm'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getApiSession()
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const stopEventId = Number(id)
  if (isNaN(stopEventId)) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 })
  }

  // Verify the stop belongs to this tenant (tenant isolation)
  const [stop] = await db
    .select({ id: stopEvents.id })
    .from(stopEvents)
    .where(
      and(
        eq(stopEvents.id, stopEventId),
        eq(stopEvents.tenantId, session.tenantId),
      )
    )
    .limit(1)

  if (!stop) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  // Idempotent insert: onConflictDoNothing on unique(stopEventId, userId)
  await db
    .insert(stopAcknowledgements)
    .values({
      tenantId: session.tenantId,
      stopEventId,
      userId: session.userId,
    })
    .onConflictDoNothing()

  return NextResponse.json({ ok: true })
}

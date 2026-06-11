import { NextRequest, NextResponse } from 'next/server'
import { getApiSession } from '@/lib/api-auth'
import { db } from '@/db'
import { pushSubscriptions } from '@/db/schema'
import { eq, and } from 'drizzle-orm'

/**
 * POST /api/push/unsubscribe
 *
 * Removes the push subscription for the given endpoint, scoped to the session tenant.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getApiSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await req.json()
    const { endpoint } = body ?? {}

    if (typeof endpoint !== 'string' || !endpoint) {
      return NextResponse.json({ error: 'endpoint is required' }, { status: 400 })
    }

    await db
      .delete(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.endpoint, endpoint),
          eq(pushSubscriptions.tenantId, session.tenantId),
        ),
      )

    return NextResponse.json({ ok: true })
  } catch (e) {
    const err = e as Error
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

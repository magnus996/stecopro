import { NextRequest, NextResponse } from 'next/server'
import { getApiSession } from '@/lib/api-auth'
import { db } from '@/db'
import { pushSubscriptions } from '@/db/schema'

/**
 * POST /api/push/subscribe
 *
 * Authenticated upsert of a Web Push subscription.
 * Uses onConflictDoUpdate on endpoint so re-subscribing from the same device
 * does not 500 on the unique index (research pitfall #6).
 */
export async function POST(req: NextRequest) {
  try {
    const session = await getApiSession()
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!process.env.VAPID_PUBLIC_KEY) {
      return NextResponse.json({ error: 'push_not_configured' }, { status: 503 })
    }

    const body = await req.json()
    const { endpoint, keys } = body ?? {}

    if (
      typeof endpoint !== 'string' || !endpoint ||
      typeof keys?.p256dh !== 'string' || !keys.p256dh ||
      typeof keys?.auth !== 'string' || !keys.auth
    ) {
      return NextResponse.json(
        { error: 'Invalid subscription: endpoint, keys.p256dh and keys.auth are required' },
        { status: 400 },
      )
    }

    const userAgent = req.headers.get('user-agent') ?? undefined

    await db
      .insert(pushSubscriptions)
      .values({
        tenantId: session.tenantId,
        userId: session.userId,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent,
      })
      .onConflictDoUpdate({
        target: pushSubscriptions.endpoint,
        set: {
          tenantId: session.tenantId,
          userId: session.userId,
          p256dh: keys.p256dh,
          auth: keys.auth,
          userAgent,
        },
      })

    return NextResponse.json({ ok: true }, { status: 201 })
  } catch (e) {
    const err = e as Error
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

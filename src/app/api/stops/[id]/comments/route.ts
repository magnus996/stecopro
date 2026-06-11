import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { getApiSession } from '@/lib/api-auth'
import { db } from '@/db'
import { stopEvents, stopComments, photos, users } from '@/db/schema'
import { eq, and, asc } from 'drizzle-orm'

const CommentSchema = z
  .object({
    comment: z.string().optional(),
    correctedReason: z.string().optional(),
    photoId: z.number().int().positive().optional(),
  })
  .refine(
    (data) =>
      (data.comment?.trim() ?? '').length > 0 ||
      (data.correctedReason?.trim() ?? '').length > 0,
    { message: 'comment_or_reason_required' }
  )

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

  // Verify the stop belongs to this tenant
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

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const parsed = CommentSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'comment_or_reason_required' }, { status: 400 })
  }

  const { comment, correctedReason, photoId } = parsed.data

  // Validate photoId tenant ownership if present
  if (photoId !== undefined) {
    const [photo] = await db
      .select({ tenantId: photos.tenantId })
      .from(photos)
      .where(eq(photos.id, photoId))
      .limit(1)
    if (!photo || photo.tenantId !== session.tenantId) {
      return NextResponse.json({ error: 'photo_not_found' }, { status: 400 })
    }
  }

  // If correctedReason given, update stop_events.reason for this stop
  if (correctedReason?.trim()) {
    await db
      .update(stopEvents)
      .set({ reason: correctedReason.trim() })
      .where(
        and(
          eq(stopEvents.id, stopEventId),
          eq(stopEvents.tenantId, session.tenantId),
        )
      )
  }

  const [inserted] = await db
    .insert(stopComments)
    .values({
      tenantId: session.tenantId,
      stopEventId,
      userId: session.userId,
      comment: comment?.trim() || null,
      correctedReason: correctedReason?.trim() || null,
      photoId: photoId ?? null,
    })
    .returning({ id: stopComments.id })

  return NextResponse.json({ ok: true, id: inserted.id }, { status: 201 })
}

export async function GET(
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

  // Verify stop belongs to tenant
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

  const comments = await db
    .select({
      id: stopComments.id,
      comment: stopComments.comment,
      correctedReason: stopComments.correctedReason,
      photoId: stopComments.photoId,
      createdAt: stopComments.createdAt,
      userName: users.name,
    })
    .from(stopComments)
    .innerJoin(users, eq(users.id, stopComments.userId))
    .where(
      and(
        eq(stopComments.stopEventId, stopEventId),
        eq(stopComments.tenantId, session.tenantId),
      )
    )
    .orderBy(asc(stopComments.createdAt))

  return NextResponse.json({ comments })
}

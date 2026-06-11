import { NextRequest, NextResponse } from 'next/server'
import { getApiSession } from '@/lib/api-auth'
import { db } from '@/db'
import { plants, shiftNotes, photos } from '@/db/schema'
import { eq, and, asc } from 'drizzle-orm'

export async function POST(req: NextRequest) {
  const session = await getApiSession()
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }

  const { content, photoId, plantId: bodyPlantId } = body as {
    content?: string
    photoId?: number
    plantId?: number
  }

  if (!content || content.trim().length === 0) {
    return NextResponse.json({ error: 'content_required' }, { status: 400 })
  }

  // Resolve plantId: if given verify it belongs to tenant; else use first plant
  let resolvedPlantId: number

  if (bodyPlantId !== undefined) {
    const [plant] = await db
      .select({ id: plants.id })
      .from(plants)
      .where(
        and(
          eq(plants.id, bodyPlantId),
          eq(plants.tenantId, session.tenantId),
        )
      )
      .limit(1)
    if (!plant) {
      return NextResponse.json({ error: 'plant_not_found' }, { status: 400 })
    }
    resolvedPlantId = plant.id
  } else {
    // Default to first plant for this tenant
    const [firstPlant] = await db
      .select({ id: plants.id })
      .from(plants)
      .where(eq(plants.tenantId, session.tenantId))
      .orderBy(asc(plants.id))
      .limit(1)
    if (!firstPlant) {
      return NextResponse.json({ error: 'no_plant_for_tenant' }, { status: 400 })
    }
    resolvedPlantId = firstPlant.id
  }

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

  const [inserted] = await db
    .insert(shiftNotes)
    .values({
      tenantId: session.tenantId,
      plantId: resolvedPlantId,
      userId: session.userId,
      content: content.trim(),
      photoId: photoId ?? null,
    })
    .returning({ id: shiftNotes.id })

  return NextResponse.json({ ok: true, id: inserted.id }, { status: 201 })
}

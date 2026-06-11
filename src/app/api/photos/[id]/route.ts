import { NextRequest, NextResponse } from 'next/server'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { getApiSession } from '@/lib/api-auth'
import { db } from '@/db'
import { photos } from '@/db/schema'
import { eq } from 'drizzle-orm'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getApiSession()
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  const { id } = await params
  const photoId = Number(id)
  if (isNaN(photoId)) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 })
  }

  const [photo] = await db
    .select()
    .from(photos)
    .where(eq(photos.id, photoId))
    .limit(1)

  // 404 for not found OR wrong tenant — same response hides existence cross-tenant
  if (!photo || photo.tenantId !== session.tenantId) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 })
  }

  const absPath = join(process.cwd(), photo.filePath)
  let buffer: Buffer
  try {
    buffer = await readFile(absPath)
  } catch {
    return NextResponse.json({ error: 'file_not_found' }, { status: 404 })
  }

  return new NextResponse(buffer as unknown as BodyInit, {
    headers: {
      'Content-Type': photo.mimeType,
      'Cache-Control': 'private, max-age=3600',
    },
  })
}

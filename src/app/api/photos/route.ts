import { NextRequest, NextResponse } from 'next/server'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'
import { getApiSession } from '@/lib/api-auth'
import { db } from '@/db'
import { photos } from '@/db/schema'

const MAX_SIZE = 10 * 1024 * 1024 // 10 MB

function extFromMime(mime: string): string {
  if (mime === 'image/jpeg' || mime === 'image/jpg') return 'jpg'
  if (mime === 'image/png') return 'png'
  if (mime === 'image/webp') return 'webp'
  if (mime === 'image/gif') return 'gif'
  if (mime === 'image/heic') return 'heic'
  return 'bin'
}

export async function POST(req: NextRequest) {
  const session = await getApiSession()
  if (!session) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch {
    return NextResponse.json({ error: 'invalid_multipart' }, { status: 400 })
  }

  const file = form.get('file')
  if (!file || !(file instanceof Blob)) {
    return NextResponse.json({ error: 'file_required' }, { status: 400 })
  }

  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'not_an_image' }, { status: 400 })
  }

  if (file.size > MAX_SIZE) {
    return NextResponse.json({ error: 'too_large' }, { status: 400 })
  }

  const ext = extFromMime(file.type)
  const uuid = randomUUID()
  const filename = `${uuid}.${ext}`
  const dir = join(process.cwd(), 'uploads', String(session.tenantId))
  const filePath = `uploads/${session.tenantId}/${filename}`
  const absPath = join(dir, filename)

  await mkdir(dir, { recursive: true })
  await writeFile(absPath, Buffer.from(await file.arrayBuffer()))

  const [inserted] = await db
    .insert(photos)
    .values({
      tenantId: session.tenantId,
      userId: session.userId,
      filePath,
      mimeType: file.type,
      sizeBytes: file.size,
    })
    .returning({ id: photos.id })

  return NextResponse.json({ id: inserted.id, ok: true }, { status: 201 })
}

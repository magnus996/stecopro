// Test/verification endpoint that calls the same login logic as the server action
// This allows smoke testing without needing to replicate the full RSC protocol
import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { createSession } from '@/lib/session'
import { LoginSchema } from '@/lib/definitions'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const parsed = LoginSchema.safeParse(body)
    
    if (!parsed.success) {
      return NextResponse.json(
        { errors: parsed.error.flatten().fieldErrors },
        { status: 400 }
      )
    }
    
    const { email, password } = parsed.data
    const [user] = await db.select().from(users).where(eq(users.email, email))
    
    if (!user || !user.active || !(await bcrypt.compare(password, user.passwordHash))) {
      return NextResponse.json(
        { errors: { email: ['Ugyldig e-post eller passord'] } },
        { status: 401 }
      )
    }
    
    await createSession({
      userId: user.id,
      tenantId: user.tenantId,
      role: user.role,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    })
    
    return NextResponse.json({ ok: true, role: user.role }, { status: 200 })
  } catch (e) {
    const err = e as Error
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

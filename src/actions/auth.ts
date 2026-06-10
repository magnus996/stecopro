'use server'
import bcrypt from 'bcryptjs'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { createSession, deleteSession } from '@/lib/session'
import { LoginSchema } from '@/lib/definitions'

export async function login(
  prevState: unknown,
  formData: FormData,
): Promise<{ errors: Record<string, string[]> } | never> {
  const parsed = LoginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors as Record<string, string[]> }
  }

  const { email, password } = parsed.data

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))

  // Use a single generic message for unknown-email AND wrong-password
  // to avoid leaking which one was wrong.
  if (!user || !user.active || !(await bcrypt.compare(password, user.passwordHash))) {
    return { errors: { email: ['Ugyldig e-post eller passord'] } }
  }

  await createSession({
    userId: user.id,
    tenantId: user.tenantId,
    role: user.role,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  })

  redirect('/dashboard')
}

export async function logout(): Promise<never> {
  await deleteSession()
  redirect('/login')
}

'use server'
import bcrypt from 'bcryptjs'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import { verifySession } from '@/lib/dal'

// ---------------------------------------------------------------------------
// Role helper
// ---------------------------------------------------------------------------
function isAdmin(role: string): boolean {
  return role === 'admin' || role === 'system_admin'
}

// ---------------------------------------------------------------------------
// Validation schemas
// Role enum deliberately EXCLUDES system_admin (RESEARCH Pitfall 2).
// system_admin users are only created via seed.
// ---------------------------------------------------------------------------
const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(['operator', 'produksjonsleder', 'admin']),
  password: z.string().min(8),
})

const UpdateUserSchema = z.object({
  name: z.string().min(1),
  role: z.enum(['operator', 'produksjonsleder', 'admin']),
})

// ---------------------------------------------------------------------------
// createUser — admin+ gated, tenant-scoped (session.tenantId ALWAYS used)
// ---------------------------------------------------------------------------
export async function createUser(
  prevState: unknown,
  formData: FormData,
): Promise<{ errors: Record<string, string[]> } | never> {
  const session = await verifySession()

  // Role gate: only admin or system_admin may create users
  if (!isAdmin(session.role)) {
    return { errors: { _: ['Ikke tilgang'] } }
  }

  const parsed = CreateUserSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors as Record<string, string[]> }
  }

  const { email, name, role, password } = parsed.data

  // Guard duplicate email — avoid a raw constraint crash (RESEARCH Pitfall 3)
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1)

  if (existing) {
    return { errors: { email: ['E-post er allerede i bruk'] } }
  }

  const passwordHash = await bcrypt.hash(password, 10)

  await db.insert(users).values({
    email,
    name,
    role,
    passwordHash,
    tenantId: session.tenantId, // ALWAYS from session — never from form (RESEARCH Pitfall 1)
    active: true,
    createdAt: new Date(),
  })

  revalidatePath('/admin/users')
  redirect('/admin/users')
}

// ---------------------------------------------------------------------------
// updateUser — admin+ gated, tenant-scoped
// ---------------------------------------------------------------------------
export async function updateUser(
  prevState: unknown,
  formData: FormData,
): Promise<{ errors: Record<string, string[]> } | never> {
  const session = await verifySession()

  if (!isAdmin(session.role)) {
    return { errors: { _: ['Ikke tilgang'] } }
  }

  const userId = Number(formData.get('userId'))
  if (!userId || isNaN(userId)) {
    return { errors: { _: ['Ugyldig bruker-ID'] } }
  }

  const parsed = UpdateUserSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors as Record<string, string[]> }
  }

  const { name, role } = parsed.data

  await db
    .update(users)
    .set({ name, role })
    .where(
      // Tenant scope is the boundary — prevents cross-tenant edits
      and(eq(users.id, userId), eq(users.tenantId, session.tenantId)),
    )

  revalidatePath('/admin/users')
  revalidatePath(`/admin/users/${userId}`)
  redirect('/admin/users')
}

// ---------------------------------------------------------------------------
// deactivateUser — admin+ gated, tenant-scoped
// Sets active=false (NOT a delete). Login already checks active=true in auth.ts.
// NOTE: deactivation does not kill an existing 7-day JWT session immediately.
// getCurrentUser checks active=true so the deactivated user is bounced to /login
// on their NEXT page load. Acceptable demo limitation (RESEARCH Pattern 3).
// ---------------------------------------------------------------------------
export async function deactivateUser(
  prevState: unknown,
  formData: FormData,
): Promise<{ success?: boolean; errors?: Record<string, string[]> }> {
  const session = await verifySession()

  if (!isAdmin(session.role)) {
    return { errors: { _: ['Ikke tilgang'] } }
  }

  const userId = Number(formData.get('userId'))
  if (!userId || isNaN(userId)) {
    return { errors: { _: ['Ugyldig bruker-ID'] } }
  }

  await db
    .update(users)
    .set({ active: false })
    .where(
      and(eq(users.id, userId), eq(users.tenantId, session.tenantId)),
    )

  revalidatePath('/admin/users')
  revalidatePath(`/admin/users/${userId}`)
  return { success: true }
}

// ---------------------------------------------------------------------------
// reactivateUser — mirrors deactivateUser (set active=true)
// Included for demo convenience so admins can reverse a deactivation.
// ---------------------------------------------------------------------------
export async function reactivateUser(
  prevState: unknown,
  formData: FormData,
): Promise<{ success?: boolean; errors?: Record<string, string[]> }> {
  const session = await verifySession()

  if (!isAdmin(session.role)) {
    return { errors: { _: ['Ikke tilgang'] } }
  }

  const userId = Number(formData.get('userId'))
  if (!userId || isNaN(userId)) {
    return { errors: { _: ['Ugyldig bruker-ID'] } }
  }

  await db
    .update(users)
    .set({ active: true })
    .where(
      and(eq(users.id, userId), eq(users.tenantId, session.tenantId)),
    )

  revalidatePath('/admin/users')
  revalidatePath(`/admin/users/${userId}`)
  return { success: true }
}

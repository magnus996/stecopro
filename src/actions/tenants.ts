'use server'
import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { verifySession } from '@/lib/dal'
import { db } from '@/db'
import { tenants, plants } from '@/db/schema'
import { eq } from 'drizzle-orm'

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const CreateTenantSchema = z.object({
  name: z.string().min(1),
  slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/, 'Kun små bokstaver, tall og bindestrek'),
})

const CreatePlantSchema = z.object({
  tenantId: z.coerce.number().int().positive(),
  name: z.string().min(1),
  description: z.string().optional(),
  nominalCapacityTph: z.coerce.number().positive().optional(),
})

// ---------------------------------------------------------------------------
// createTenant — system_admin only
// ---------------------------------------------------------------------------

export async function createTenant(
  prevState: unknown,
  formData: FormData,
): Promise<{ errors: Record<string, string[]> } | never> {
  // GATE: system_admin only — MUST come first, before any form data is trusted
  const session = await verifySession()
  if (session.role !== 'system_admin') {
    return { errors: { _: ['Ikke tilgang'] } }
  }

  const parsed = CreateTenantSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors as Record<string, string[]> }
  }

  const { name, slug } = parsed.data

  // Duplicate slug guard (the unique index would throw, but we surface a
  // user-friendly error instead)
  const [existing] = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.slug, slug))
    .limit(1)

  if (existing) {
    return { errors: { slug: ['Slug er allerede i bruk'] } }
  }

  await db.insert(tenants).values({ name, slug, createdAt: new Date() })

  revalidatePath('/admin/tenants')
  redirect('/admin/tenants')
}

// ---------------------------------------------------------------------------
// createPlantForTenant — system_admin only
// This is the ONE place where a tenantId comes from the form rather than
// session.tenantId. It is safe ONLY because the system_admin role check
// immediately above the query is the security boundary.
// ---------------------------------------------------------------------------

export async function createPlantForTenant(
  prevState: unknown,
  formData: FormData,
): Promise<{ errors: Record<string, string[]> } | never> {
  // GATE: system_admin only — MUST come before reading form-supplied tenantId
  const session = await verifySession()
  if (session.role !== 'system_admin') {
    return { errors: { _: ['Ikke tilgang'] } }
  }

  const parsed = CreatePlantSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors as Record<string, string[]> }
  }

  // Verify the target tenant exists
  const [targetTenant] = await db
    .select({ id: tenants.id })
    .from(tenants)
    .where(eq(tenants.id, parsed.data.tenantId))
    .limit(1)

  if (!targetTenant) {
    return { errors: { _: ['Tenant finnes ikke'] } }
  }

  // [SECURITY NOTE] parsed.data.tenantId is form-supplied — this is the sole
  // place in the codebase where a non-session tenantId drives an INSERT.
  // It is safe because the system_admin gate above executes before this line.
  await db.insert(plants).values({
    tenantId: parsed.data.tenantId,
    name: parsed.data.name,
    description: parsed.data.description ?? null,
    nominalCapacityTph: parsed.data.nominalCapacityTph ?? null,
    createdAt: new Date(),
  })

  revalidatePath(`/admin/tenants/${parsed.data.tenantId}`)
  revalidatePath('/admin/tenants')
  redirect(`/admin/tenants/${parsed.data.tenantId}`)
}

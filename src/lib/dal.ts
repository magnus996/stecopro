import 'server-only'
// ---------------------------------------------------------------------------
// DATA ACCESS LAYER (DAL) — Tenant Isolation Rule
// ---------------------------------------------------------------------------
// EVERY accessor in this file derives tenantId from the verified session.
// NO accessor accepts tenantId as a parameter.
// This is the single enforcement point for multi-tenant data isolation.
// When adding new accessors: call verifySession() first, use session.tenantId
// in every WHERE clause. Never pass tenantId in from a page or component.
// ---------------------------------------------------------------------------
import { cache } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { decrypt } from './session'
import { db } from '@/db'
import { users, plants, tenants } from '@/db/schema'
import { eq, and } from 'drizzle-orm'
import type { SessionPayload } from './definitions'

// Verify the session cookie and redirect to /login if invalid.
// Returns the full session payload on success.
export const verifySession = cache(async (): Promise<SessionPayload> => {
  const cookie = (await cookies()).get('session')?.value
  const session = await decrypt(cookie)
  if (!session?.userId) redirect('/login')
  return session
})

// Re-query the users table by userId AND tenantId (honoring the active flag).
// Used for nav/role decisions. Returns safe fields only.
export const getCurrentUser = cache(async () => {
  const session = await verifySession()
  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      tenantId: users.tenantId,
    })
    .from(users)
    .where(
      and(
        eq(users.id, session.userId),
        eq(users.tenantId, session.tenantId),
        eq(users.active, true),
      )
    )
  return user ?? null
})

// Returns the current tenant's record (name, slug).
export const getTenant = cache(async () => {
  const session = await verifySession()
  const [tenant] = await db
    .select({ id: tenants.id, name: tenants.name, slug: tenants.slug })
    .from(tenants)
    .where(eq(tenants.id, session.tenantId))
  return tenant ?? null
})

// Example tenant-scoped accessor: returns plants for the current tenant.
// system_admin sees all plants (no tenant filter) — Phase 5 builds the full
// system-admin surface; keep this minimal for Phase 1.
export const getPlants = cache(async () => {
  const session = await verifySession()
  if (session.role === 'system_admin') {
    return db.select().from(plants)
  }
  return db.select().from(plants).where(eq(plants.tenantId, session.tenantId))
})

# Phase 5: Administration & Demo Polish - Research

**Researched:** 2026-06-11
**Domain:** Next.js App Router server actions, CRUD admin UI, multi-tenant access control, demo seed
**Confidence:** HIGH (all findings based on direct codebase inspection)

## Summary

Phase 5 adds admin CRUD pages for users, tenants, and plant configuration, then polishes the demo seed so a salesperson can walk through all four roles without touching code. The codebase is well-prepared: the schema already has `active` flag on users, `nominalCapacityTph` on plants, fractions and machines tables — all the data model is in place. What's missing are the pages, server actions, and DAL accessors.

The primary challenge is **system_admin cross-tenant access**: the session JWT carries a single `tenantId`, but the system_admin must manage ALL tenants. The DAL already has a special case in `getPlants()` (`if (session.role === 'system_admin') return db.select().from(plants)`) which establishes the intended pattern: role-based DAL bypass rather than session impersonation.

The plant config editing scope should be **conservative**: only `nominalCapacityTph`, fraction names/sortOrder, and machine names/nominalCurrentA are safe to edit without touching the simulator. Shift times (07/15/22) and machine types are hardcoded in multiple places — editing them in the UI would create data/UI mismatches without rework outside this phase's scope.

**Primary recommendation:** Use the established server-action + `useActionState` pattern from the existing login form. No new libraries needed — zod is already installed, bcryptjs for password hashing, existing Tailwind + table patterns from report pages.

## Standard Stack

All libraries are already installed. No new dependencies required for this phase.

### Core (already in package.json)
| Library | Version | Purpose | Status |
|---------|---------|---------|--------|
| zod | ^4.4.3 | Form validation schemas | Installed |
| bcryptjs | ^3.0.3 | Password hashing for new users | Installed |
| drizzle-orm | ^0.45.2 | CRUD queries | Installed |
| next | 16.2.9 | Server actions, `useActionState` | Installed |

### Patterns Already Established in Codebase
| Pattern | Where | Reuse for Phase 5 |
|---------|-------|-------------------|
| Server action with `prevState` | `src/actions/auth.ts` | User/tenant/plant CRUD actions |
| `useActionState` client form | `src/app/(auth)/login/LoginForm.tsx` | All edit forms |
| Server Component page + Client Component form | `/login/page.tsx` + `LoginForm.tsx` | Admin pages |
| Role gate in page | `/reports/page.tsx` → redirect if `operator` | Gate admin pages by role |
| Table UI pattern | `/reports/shifts/page.tsx` | User/tenant lists |
| `revalidatePath` after mutation | Standard App Router pattern | All CRUD actions |

**No installation needed.** `npm install --cache .npm-cache` only if a new dependency is added.

## Architecture Patterns

### Recommended File Structure
```
src/
├── actions/
│   ├── auth.ts              (existing)
│   ├── users.ts             (NEW — createUser, updateUser, deactivateUser)
│   ├── tenants.ts           (NEW — createTenant, updateTenant)
│   └── plant.ts             (NEW — updatePlantConfig, updateFraction, updateMachine)
├── lib/
│   └── dal.ts               (add admin accessors: getUsers, getUserById, getTenantList,
│                              getPlantConfig, getSystemAdminTenants, etc.)
├── app/
│   └── (app)/
│       └── admin/
│           ├── users/
│           │   ├── page.tsx          (list: admin+; scoped to own tenant)
│           │   ├── new/page.tsx      (create user)
│           │   └── [userId]/page.tsx (edit/deactivate user)
│           ├── tenants/
│           │   ├── page.tsx          (list: system_admin only)
│           │   ├── new/page.tsx      (create tenant)
│           │   └── [tenantId]/page.tsx (edit tenant, manage its plants)
│           └── plant/
│               └── page.tsx          (fractions, machines, nominalCapacity: produksjonsleder+)
```

### Pattern 1: Server Action + useActionState (Client Form)

This is the established codebase pattern. Server Component page fetches initial data, passes it to a Client Component form that uses `useActionState`.

```typescript
// src/actions/users.ts  (server action)
'use server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { revalidatePath } from 'next/cache'
import { verifySession } from '@/lib/dal'
import { db } from '@/db'
import { users } from '@/db/schema'

const CreateUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(['operator', 'produksjonsleder', 'admin']), // not system_admin
  password: z.string().min(8),
})

export async function createUser(prevState: unknown, formData: FormData) {
  const session = await verifySession()
  // Role gate: only admin+ can create users
  if (!['admin', 'system_admin'].includes(session.role)) {
    return { errors: { _: ['Ikke tilgang'] } }
  }
  const parsed = CreateUserSchema.safeParse(Object.fromEntries(formData))
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors }
  const passwordHash = await bcrypt.hash(parsed.data.password, 10)
  await db.insert(users).values({
    ...parsed.data,
    passwordHash,
    tenantId: session.tenantId, // ALWAYS scoped to current session tenant
    active: true,
    createdAt: new Date(),
  })
  revalidatePath('/admin/users')
  return { success: true }
}
```

```typescript
// Admin page — Server Component, passes initial data to form
import { getCurrentUser, getUsers } from '@/lib/dal'
import { UserForm } from './UserForm'  // 'use client'

export default async function NewUserPage() {
  const user = await getCurrentUser()
  if (!user || !['admin', 'system_admin'].includes(user.role)) redirect('/')
  return <UserForm />
}
```

### Pattern 2: system_admin Cross-Tenant Access via DAL Role Bypass

The existing `getPlants()` already implements this pattern. Extend it consistently:

```typescript
// In dal.ts — system_admin bypasses tenantId filter
export const getTenantList = cache(async () => {
  const session = await verifySession()
  if (session.role !== 'system_admin') {
    // Tenant admins cannot list other tenants
    throw new Error('Forbidden')
  }
  return db.select().from(tenants).orderBy(asc(tenants.name))
})

export const getSystemAdminPlants = cache(async () => {
  const session = await verifySession()
  if (session.role !== 'system_admin') throw new Error('Forbidden')
  // No tenantId filter — system_admin sees all
  return db.select({
    id: plants.id,
    name: plants.name,
    tenantId: plants.tenantId,
    tenantName: tenants.name,
  })
  .from(plants)
  .innerJoin(tenants, eq(tenants.id, plants.tenantId))
})
```

**Key decision:** system_admin session `tenantId` stays as tenant1 (Steco's own tenant). When system_admin creates a tenant or plant for another tenant, the server action explicitly uses the target `tenantId` from the form — not `session.tenantId`. This is the only case where a DAL action accepts a `tenantId` parameter, and it's scoped to system_admin actions only.

### Pattern 3: User Deactivation (not deletion)

The `active` flag already exists on the `users` table. Login already checks it (`if (!user || !user.active || ...)` in `src/actions/auth.ts`). So deactivation is a simple UPDATE.

**Existing session behavior after deactivation:** The JWT is valid for 7 days. A deactivated user's cookie remains valid. The `getCurrentUser()` accessor checks `eq(users.active, true)` so the deactivated user will be redirected to `/login` on their NEXT page load. This is acceptable for a demo — document it as a known limitation (not a bug).

**Demo limitation to document:** Deactivating a user does NOT immediately kill existing sessions. Sessions expire naturally after 7 days. For the demo this is fine and should be noted in the walkthrough guide.

### Pattern 4: Plant Config Editing — Scope Decision

**What IS safe to edit in Phase 5:**
- `plants.nominalCapacityTph` — consumed by dashboard throughput card and `calculateOee` performance metric. Currently 12 t/h (returpapir). Safe to change — OEE recalculates automatically.
- `fractions.name` and `fractions.sortOrder` — displayed in dashboard/reports. Renaming is safe; the simulator uses fraction IDs (not names).
- `machines.name` and `machines.nominalCurrentA` — displayed in reports (energy proxy). Safe to rename.

**What is NOT safe to edit in Phase 5 (hardcoded elsewhere):**
- Shift times (07/15/22) — hardcoded in `src/lib/time.ts` `getShiftType()` and `getShiftBoundsUtc()`. Adding a shift times column to the plants table would require changing time.ts, simulator, and shift attribution logic. **Out of scope for Phase 5.**
- Machine `type` (bunker/conveyor/press) — `type === 'bunker'` is used in DAL to find the correct machine for current-draw queries. Changing via UI without validation would break the dashboard. Display-only.
- Fraction `plantId`/`tenantId` — structural, not config.
- `nominalBalesPerShift` — currently hardcoded in `dal.ts` (not in the schema). ADMN-01 says "nominal capacity" which is already `nominalCapacityTph` in the schema. Adding `nominalBalesPerShift` to the plants table IS feasible (read it in dal.ts instead of the constant) but adds schema migration complexity. **Recommendation:** use `nominalCapacityTph` as the "nominal capacity" field for ADMN-01; do not add new schema columns.

**Plant config page scope:**
1. Edit plant: `nominalCapacityTph`, `description`, `name`
2. Fraction list: edit `name`, `sortOrder` per fraction
3. Machine list: edit `name`, `nominalCurrentA` per machine
4. Shift times section: display-only with explanation ("fastsatt i systemkonfigurasjon")

### Pattern 5: Schema Migration

There are NO schema changes needed for Phase 5. All required data is already in the schema:
- `users.active` — already exists
- `plants.nominalCapacityTph` — already exists  
- `fractions.name`, `fractions.sortOrder` — already exist
- `machines.name`, `machines.nominalCurrentA` — already exist

`drizzle-kit push` is the established migration command for this project.

### Pattern 6: Demo Seed Polish (ADMN-04)

Current seed (`src/db/seed.ts`) creates:
- Tenant 1 "Steco Demo" — 4 users, 1 plant (Returpapir Linje 1), 4 fractions, 3 machines
- Tenant 2 "Isolasjonstest" — 1 user, no plant, no data

**What's missing for "sells the product":**
1. Tenant 2 needs a minimal plant + 1 recent shift of data (proves isolation in admin UI — currently the admin tenant list shows tenant 2 exists but it's completely empty)
2. More descriptive user names are fine (already good: Ole Operatør, Lise Leder, etc.)
3. The `system@steco.no` system_admin living in tenant 1 is correct — do NOT change this, it's an intentional decision per STATE.md

**`npm run demo:setup` recommendation:** YES — add a `demo:setup` script to `package.json` that runs `db:reset` (seed + simulate). This is a single-command "start the demo from scratch". The existing `db:reset` is `npm run db:seed && npm run db:simulate` which already does this. Rename or alias it to `demo:setup`.

### Pattern 7: Full Role Walkthrough (Success Criterion 5)

Pages that MUST exist (currently 404 or missing):

| Route | Role Required | Status |
|-------|--------------|--------|
| `/admin/plant` | produksjonsleder+ | MISSING — nav item exists in nav.ts but no page |
| `/admin/users` | admin+ | MISSING — nav item exists in nav.ts but no page |
| `/admin/tenants` | system_admin | MISSING — nav item exists in nav.ts but no page |

**Full click-path for demo walkthrough:**

1. **Operator (Ole Operatør, operator@steco-demo.no)**
   - Login → Dashboard (plant status, OEE, bale counts, current draw)
   - Shift Reports → click any shift → detail (OEE, stops, bales, energy proxy)
   - Blocked from: /reports (analysis), all /admin/* routes

2. **Production Manager (Lise Leder, leder@steco-demo.no)**
   - All operator routes above
   - Analysis page (/reports) — OEE trend, Pareto, bales per day, day vs evening
   - CSV export
   - Plant config (/admin/plant) — view/edit nominalCapacity, fractions, machines
   - Blocked from: /admin/users, /admin/tenants

3. **Admin (Arne Admin, admin@steco-demo.no)**
   - All produksjonsleder routes above
   - User management (/admin/users) — list users, create, edit, deactivate
   - Cannot create users with system_admin role
   - Cannot see/manage other tenants

4. **System Admin (Steco System, system@steco.no)**
   - All admin routes above
   - Tenant management (/admin/tenants) — list ALL tenants, create new tenant
   - Plant management for any tenant
   - Can see Steco Demo AND Isolasjonstest in tenant list

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Password hashing | Custom hash | `bcrypt.hash(pw, 10)` (bcryptjs already installed) | bcryptjs is already used in auth.ts and seed.ts — same pattern |
| Form state/errors | Custom state manager | `useActionState` from React | Established pattern from LoginForm.tsx |
| Validation | Manual checks | zod (already installed) | Same schema for both server action and TypeScript types |
| Optimistic protection | Re-checking roles in pages | Always call `verifySession()` in DAL/actions | Proxy is optimistic-only — real guard is the DAL |
| Session invalidation | Complex token revocation | Document as demo limitation | 7-day JWT is fine for demo; immediate invalidation would require a token blocklist |

## Common Pitfalls

### Pitfall 1: Accepting tenantId as an action parameter for regular tenant admins
**What goes wrong:** A server action `createUser(tenantId, ...)` where tenantId comes from the form allows a malicious admin to create users in other tenants by spoofing the form field.
**How to avoid:** For `admin` role actions, ALWAYS use `session.tenantId` from `verifySession()`, never from form data. Only `system_admin` actions accept a target `tenantId` parameter, and they must first verify `session.role === 'system_admin'`.

### Pitfall 2: Creating system_admin users via the UI
**What goes wrong:** If the create-user form allows selecting `system_admin` role, a tenant admin could create a privileged user.
**How to avoid:** The `CreateUserSchema` should use `z.enum(['operator', 'produksjonsleder', 'admin'])` — excluding `system_admin`. System admins are only created via seed.

### Pitfall 3: plant config page accessible to operators
**What goes wrong:** Nav entry for `/admin/plant` shows for `produksjonsleder+`. Without a server-side role check in the page, an operator who manually navigates to the URL gets the plant config.
**How to avoid:** Every admin page must call `getCurrentUser()` and check role, then redirect if insufficient. The proxy only checks for the `/admin` prefix (not sub-roles).

### Pitfall 4: system_admin can't see tenant 2's plant in admin/plant
**What goes wrong:** The `/admin/plant` page uses `getPlants()` which returns plants for the session's tenantId for non-system_admin users. For system_admin it returns ALL plants. The page uses `plants[0]` — which for system_admin would return the first plant alphabetically, not necessarily the right one.
**How to avoid:** The `/admin/plant` page should work with `plants[0]` for normal admins (they only have one plant). For system_admin, `/admin/tenants` is the entry point for cross-tenant plant management; `/admin/plant` can remain scoped to the system_admin's own tenant (tenant 1 / Steco Demo).

### Pitfall 5: Edit forms not pre-populated
**What goes wrong:** An edit page that renders a blank form instead of current values, causing accidental overwrites.
**How to avoid:** Server Component fetches current row by ID + tenantId scope, passes values as defaultValue props to the form's input fields.

### Pitfall 6: revalidatePath scope
**What goes wrong:** After a create/edit, the list page doesn't show updated data because revalidatePath missed a segment.
**How to avoid:** Call `revalidatePath('/admin/users')` (the list page) AND `revalidatePath('/admin/users/[id]')` (detail page if it exists) from the same action.

### Pitfall 7: Isolation test tenant has no data — isolation proof is invisible
**What goes wrong:** Logging in as `bruker@isolasjonstest.no` shows an empty dashboard with "Ingen anlegg" which doesn't convincingly prove isolation.
**How to avoid:** Seed tenant 2 with a minimal plant and 1 week of simulated data. The dashboard shows real (different) data, proving isolation visually.

## Code Examples

### Existing login form client pattern to replicate
```typescript
// Source: src/app/(auth)/login/LoginForm.tsx
'use client'
import { useActionState } from 'react'
import { login } from '@/actions/auth'

export default function LoginForm() {
  const [state, action, isPending] = useActionState(login, undefined)
  return (
    <form action={action}>
      <input name="email" type="email" />
      {state?.errors?.email && <p>{state.errors.email[0]}</p>}
      <button disabled={isPending} type="submit">
        {isPending ? 'Logger inn…' : 'Logg inn'}
      </button>
    </form>
  )
}
```

### Existing server action error return pattern to replicate
```typescript
// Source: src/actions/auth.ts
export async function login(prevState: unknown, formData: FormData) {
  const parsed = Schema.safeParse({ ... })
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors as Record<string, string[]> }
  }
  // ... success path: redirect('/destination')
}
```

### Deactivate user (UPDATE, not DELETE)
```typescript
// In src/actions/users.ts
export async function deactivateUser(prevState: unknown, formData: FormData) {
  const session = await verifySession()
  if (!['admin', 'system_admin'].includes(session.role)) {
    return { errors: { _: ['Ikke tilgang'] } }
  }
  const userId = Number(formData.get('userId'))
  // Security: verify user belongs to current tenant (admin) or allow any (system_admin)
  const whereClause = session.role === 'system_admin'
    ? eq(users.id, userId)
    : and(eq(users.id, userId), eq(users.tenantId, session.tenantId))
  await db.update(users).set({ active: false }).where(whereClause)
  revalidatePath('/admin/users')
  return { success: true }
}
```

### DAL accessor for users list (admin scope)
```typescript
// In src/lib/dal.ts
export const getUsersForTenant = cache(async () => {
  const session = await verifySession()
  if (!['admin', 'system_admin'].includes(session.role)) {
    throw new Error('Forbidden')
  }
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      active: users.active,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.tenantId, session.tenantId))  // ALWAYS scoped — even for system_admin when on /admin/users
    .orderBy(asc(users.name))
})
```

### Seed tenant 2 with minimal plant (isolation proof)
```typescript
// src/db/seed.ts — add after tenant2 user creation
const [plant2] = db
  .insert(plants)
  .values({
    tenantId: tenant2.id,
    name: 'Test Linje 1',
    description: 'Testanlegg for isolasjonstest',
    nominalCapacityTph: 8,
    createdAt: new Date(),
  })
  .returning()
  .all()

await db.insert(fractions).values([
  { tenantId: tenant2.id, plantId: plant2.id, name: 'Fraksjon A', sortOrder: 0 },
  { tenantId: tenant2.id, plantId: plant2.id, name: 'Fraksjon B', sortOrder: 1 },
])

await db.insert(machines).values([
  {
    tenantId: tenant2.id, plantId: plant2.id,
    name: 'Bunker T2', type: 'bunker', nominalCurrentA: 30, createdAt: new Date(),
  },
])
```

## State of the Art

All tech is current. No deprecated patterns in scope.

| Area | Current approach in this codebase | Phase 5 follows same approach |
|------|----------------------------------|-------------------------------|
| Forms | `useActionState` + server action | Yes — replicate LoginForm pattern |
| Auth | jose JWT cookie session | No change needed |
| DB | better-sqlite3 + drizzle-orm | No change needed |
| Styling | Tailwind + zinc palette | Yes — same card/table classes |
| Validation | zod v4 | Yes — already used in auth |

## Open Questions

### 1. nominalBalesPerShift: add to schema or keep as DAL constant?
- **What we know:** Currently hardcoded as `const NOMINAL_BALES_PER_SHIFT = 120` in `dal.ts`. The plants table has `nominalCapacityTph` but not `nominalBalesPerShift`. ADMN-01 says "nominal capacity" is editable.
- **What's unclear:** Does "nominal capacity" in ADMN-01 mean `nominalCapacityTph` (which already exists in the schema and is used in the dashboard throughput card) or `nominalBalesPerShift` (which drives OEE performance)?
- **Recommendation:** Treat `nominalCapacityTph` as the nominal capacity field (it's already in the schema, already displayed in the UI). The 120 bales/shift constant is an internal OEE calibration parameter — leave it as a constant for Phase 5. If a stakeholder wants it configurable, that's a schema change to defer.

### 2. Isolation tenant second plant — simulate or just seed static shifts?
- **What we know:** `scripts/simulate.ts` uses `plantRows[0]` — it simulates ONLY the first plant found. Tenant 2's plant would NOT be automatically simulated.
- **Resolution:** Two options: (a) seed static shift/bale/stop rows directly in `seed.ts` for tenant 2 (simpler, no simulator dependency), or (b) update `simulate.ts` to loop over all plants. Option (a) is recommended for Phase 5 — a handful of hardcoded rows is enough to prove isolation visually without touching the simulator.
- **Recommendation:** Add minimal static seed data (1 week of shift rows + ~20 bale events) for tenant2's plant directly in `seed.ts`. The simulator remains single-plant.

### 3. Admin pages — list + edit on same page vs separate pages?
- **What we know:** Report detail pages use separate routes (`/reports/shifts/[shiftId]`). Login is a single page.
- **What's unclear:** For small CRUD (3-5 users, 1-2 tenants in demo), inline editing (same page) vs separate edit pages.
- **Recommendation:** Separate pages following the existing pattern (`/admin/users`, `/admin/users/new`, `/admin/users/[userId]`). This is more extensible and matches the established route structure.

## Sources

### Primary (HIGH confidence — direct codebase inspection)
- `/Users/magnushj/Projects/stecopro/src/db/schema.ts` — complete data model
- `/Users/magnushj/Projects/stecopro/src/db/seed.ts` — current seed state
- `/Users/magnushj/Projects/stecopro/src/lib/dal.ts` — all accessors, system_admin pattern established
- `/Users/magnushj/Projects/stecopro/src/actions/auth.ts` — server action + form pattern
- `/Users/magnushj/Projects/stecopro/src/app/(auth)/login/LoginForm.tsx` — useActionState pattern
- `/Users/magnushj/Projects/stecopro/src/lib/oee.ts` — QUALITY_FACTOR, NOMINAL_BALES_PER_SHIFT context
- `/Users/magnushj/Projects/stecopro/src/lib/time.ts` — shift times hardcoded at 07/15/22
- `/Users/magnushj/Projects/stecopro/src/lib/nav.ts` — existing nav stubs for admin routes
- `/Users/magnushj/Projects/stecopro/src/proxy.ts` — /admin protected by proxy
- `/Users/magnushj/Projects/stecopro/.planning/STATE.md` — accumulated decisions
- `/Users/magnushj/Projects/stecopro/.planning/REQUIREMENTS.md` — TENA-04, TENA-05, ADMN-01..04

### Secondary (HIGH confidence — package.json inspection)
- `/Users/magnushj/Projects/stecopro/package.json` — confirmed: zod 4.4.3, bcryptjs 3.0.3, drizzle-orm 0.45.2, next 16.2.9

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all libraries confirmed in package.json
- Architecture patterns: HIGH — based on direct reading of established codebase patterns
- Cross-tenant access design: HIGH — DAL pattern already established in getPlants()
- Plant config scope decision: HIGH — based on code audit of time.ts, dal.ts, oee.ts
- Pitfalls: HIGH — derived from actual code paths, not speculation
- Open questions: MEDIUM — require one more file read (scripts/simulate.ts) to resolve

**Research date:** 2026-06-11
**Valid until:** 2026-07-11 (stable codebase, no fast-moving dependencies)

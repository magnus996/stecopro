# Phase 1: Foundation - Research

**Researched:** 2026-06-11
**Domain:** Next.js App Router auth, SQLite data layer, multi-tenant scoping
**Confidence:** HIGH (core stack verified against official docs + Context7)

---

## Summary

Phase 1 establishes a running Next.js App Router app with email/password login, JWT-based stateless sessions, role-based navigation, and a Drizzle ORM + SQLite schema covering the full plant data model. The hardest decisions are the auth mechanism and tenant isolation pattern — both are expensive to retrofit.

The standard approach for this stack is: **hand-rolled stateless sessions using `jose` + Next.js `cookies()` API** (exactly as shown in the official Next.js authentication guide for Next.js 16.2.9, which ships its own auth documentation matching this version). `next-auth@beta` (v5) remains in beta status as of June 2026 — the latest stable npm tag is v4.24.14 while v5 is `5.0.0-beta.31`. For a demo app with simple email/password credentials and no OAuth providers, the hand-rolled path is simpler, has no beta risk, and the Next.js docs provide complete reference code.

For the data layer, **Drizzle ORM with `better-sqlite3`** is the right choice. Drizzle v0.45.2 has stable SQLite support with TypeScript-first schema declaration, migration tooling via `drizzle-kit`, and the same schema compiles against Postgres when the project grows. Tenant isolation in SQLite must be enforced by convention (DAL functions, not DB-level RLS), making the Data Access Layer architecture the critical correctness boundary.

**Primary recommendation:** Use hand-rolled `jose` sessions + Drizzle ORM `better-sqlite3`. Store `userId`, `tenantId`, and `role` in the JWT. Build every DAL function to accept `tenantId` from the session and filter every query with it — never let callers pass `tenantId` directly.

---

## Standard Stack

### Core

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `next` | 16.2.9 (existing) | Framework, App Router, Server Actions | Already in project |
| `jose` | 6.2.3 | JWT sign/verify for stateless sessions | Edge-compatible, endorsed by Next.js docs for sessions |
| `drizzle-orm` | 0.45.2 | TypeScript ORM with SQLite support | Type-safe, SQL-close, portable to Postgres |
| `better-sqlite3` | 12.10.0 | Synchronous SQLite driver | Fast, zero-config for local demo |
| `drizzle-kit` | 0.31.10 | Migration generator and push tooling | Paired with drizzle-orm |
| `bcryptjs` | 3.0.3 | Password hashing for seeded demo users | Pure JS (no native addon), sufficient for demo |
| `zod` | 4.4.3 | Runtime validation of login form fields | Already ecosystem standard with Next.js |
| `server-only` | latest | Prevent DAL/session modules from leaking to client | Official Next.js pattern |

### Supporting

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `@types/better-sqlite3` | latest | TypeScript types for better-sqlite3 | Dev dependency |
| `dotenv` | latest | Load `.env` in drizzle-kit scripts | Dev tooling only |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `jose` hand-rolled sessions | `next-auth@beta` (v5) | next-auth adds OAuth/social providers; still beta as of June 2026; overkill for demo-only credentials |
| `better-sqlite3` | `@libsql/client` | libsql adds Turso remote support; unnecessary complexity for a local demo |
| `bcryptjs` | `argon2` (via `@node-rs/argon2`) | argon2 is stronger but requires native bindings; bcryptjs is pure JS, fine for seeded demo |
| `zod` v4 | `valibot` | zod v4 is already in the ecosystem; no reason to change |

**Installation (with project-local npm cache):**
```bash
npm install --cache .npm-cache jose bcryptjs zod server-only drizzle-orm better-sqlite3
npm install --cache .npm-cache -D drizzle-kit @types/better-sqlite3 dotenv
```

> **IMPORTANT npm cache note:** The global npm cache at `~/.npm/_cacache` has permission problems in this sandbox. Always use `npm install --cache .npm-cache` (project-local cache directory) for all installs in this project. The `--cache .npm-cache` flag redirects npm's cache to a project-local directory, which avoids the permission error. Verified working with npm 11.8.0 + Node 22.16.0.

---

## Architecture Patterns

### Recommended Project Structure

```
stecopro/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   └── login/
│   │   │       └── page.tsx           # Login page
│   │   ├── (app)/                     # Protected route group
│   │   │   ├── layout.tsx             # Auth-gate layout
│   │   │   └── dashboard/
│   │   │       └── page.tsx
│   │   ├── api/
│   │   │   └── auth/
│   │   │       └── logout/
│   │   │           └── route.ts
│   │   ├── layout.tsx                 # Root layout
│   │   └── page.tsx
│   ├── lib/
│   │   ├── session.ts                 # JWT encrypt/decrypt, createSession, deleteSession
│   │   ├── dal.ts                     # verifySession(), getUser() — server-only
│   │   └── definitions.ts             # Zod schemas, TypeScript types
│   ├── db/
│   │   ├── index.ts                   # Drizzle db instance
│   │   ├── schema.ts                  # All table definitions
│   │   └── seed.ts                    # Demo seed script
│   └── actions/
│       └── auth.ts                    # Server Actions: login, logout
├── drizzle/                           # Generated migrations (drizzle-kit output)
├── drizzle.config.ts
├── proxy.ts                           # Next.js 16 proxy (replaces middleware for optimistic auth)
├── .env.local
└── .npm-cache/                        # Project-local npm cache (gitignored)
```

> **Next.js 16 note:** Next.js 16 uses `proxy.ts` (not `middleware.ts`) for request interception. The exported function name is `proxy`, not `middleware`. The `config.matcher` export still works the same way. Source: official Next.js 16.2.9 docs.

### Pattern 1: Stateless JWT Session (Official Next.js pattern)

**What:** Session payload `{ userId, tenantId, role, expiresAt }` is encrypted with `jose` (HS256) and stored in an HttpOnly cookie. No database session table needed.

**When to use:** Demo app with simple credentials auth, no session revocation required, edge-compatible.

```typescript
// Source: https://nextjs.org/docs/app/guides/authentication (Next.js 16.2.9)
// src/lib/session.ts
import 'server-only'
import { SignJWT, jwtVerify } from 'jose'
import { cookies } from 'next/headers'

type SessionPayload = {
  userId: number
  tenantId: number
  role: 'operator' | 'produksjonsleder' | 'admin' | 'system_admin'
  expiresAt: Date
}

const secretKey = process.env.SESSION_SECRET!
const encodedKey = new TextEncoder().encode(secretKey)

export async function encrypt(payload: SessionPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(encodedKey)
}

export async function decrypt(session: string | undefined = '') {
  try {
    const { payload } = await jwtVerify(session, encodedKey, { algorithms: ['HS256'] })
    return payload as SessionPayload
  } catch {
    return null
  }
}

export async function createSession(payload: SessionPayload) {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  const token = await encrypt({ ...payload, expiresAt })
  const cookieStore = await cookies()
  cookieStore.set('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    expires: expiresAt,
    sameSite: 'lax',
    path: '/',
  })
}

export async function deleteSession() {
  const cookieStore = await cookies()
  cookieStore.delete('session')
}
```

### Pattern 2: Data Access Layer with Tenant Scoping (Critical)

**What:** Every DAL function reads `tenantId` from the verified session and injects it into every query. Callers never pass `tenantId` — they call DAL functions that enforce it internally.

**When to use:** Always. This is the only correct pattern for SQLite multi-tenancy (no DB-level RLS).

```typescript
// Source: https://nextjs.org/docs/app/guides/authentication + project design
// src/lib/dal.ts
import 'server-only'
import { cache } from 'react'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { decrypt } from './session'
import { db } from '@/db'
import { plants } from '@/db/schema'
import { eq, and } from 'drizzle-orm'

export const verifySession = cache(async () => {
  const cookie = (await cookies()).get('session')?.value
  const session = await decrypt(cookie)
  if (!session?.userId) redirect('/login')
  return session  // { userId, tenantId, role, expiresAt }
})

// Plants for current tenant — tenantId comes from session, NEVER from caller
export const getPlants = cache(async () => {
  const session = await verifySession()
  return db.select().from(plants).where(eq(plants.tenantId, session.tenantId))
})
```

### Pattern 3: Proxy for Optimistic Route Protection

**What:** `proxy.ts` at project root intercepts requests, reads the session cookie, and redirects unauthenticated users to `/login` before they hit any page component.

```typescript
// Source: https://nextjs.org/docs/app/guides/authentication (Next.js 16.2.9)
// proxy.ts
import { NextRequest, NextResponse } from 'next/server'
import { decrypt } from '@/lib/session'
import { cookies } from 'next/headers'

const protectedRoutes = ['/dashboard', '/reports', '/admin']
const publicRoutes = ['/login']

export default async function proxy(req: NextRequest) {
  const path = req.nextUrl.pathname
  const isProtected = protectedRoutes.some(r => path.startsWith(r))
  const isPublic = publicRoutes.includes(path)

  const cookie = (await cookies()).get('session')?.value
  const session = await decrypt(cookie)

  if (isProtected && !session?.userId) {
    return NextResponse.redirect(new URL('/login', req.nextUrl))
  }
  if (isPublic && session?.userId) {
    return NextResponse.redirect(new URL('/dashboard', req.nextUrl))
  }
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|.*\\.png$).*)'],
}
```

### Pattern 4: Drizzle Schema with Tenant Scoping

**What:** Every entity table carries a `tenantId` foreign key. `NOT NULL` enforced at schema level.

```typescript
// Source: https://orm.drizzle.team/docs/sql-schema-declaration
// src/db/schema.ts
import { sqliteTable as table, int, text, real, integer, index } from 'drizzle-orm/sqlite-core'

export const tenants = table('tenants', {
  id: int().primaryKey({ autoIncrement: true }),
  name: text().notNull(),
  slug: text().notNull().unique(),
  createdAt: integer({ mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
})

export const users = table('users', {
  id: int().primaryKey({ autoIncrement: true }),
  tenantId: int('tenant_id').notNull().references(() => tenants.id),
  email: text().notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text().notNull(),
  role: text().notNull().$type<'operator' | 'produksjonsleder' | 'admin' | 'system_admin'>(),
  active: integer({ mode: 'boolean' }).notNull().default(true),
  createdAt: integer({ mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (t) => [
  index('users_tenant_idx').on(t.tenantId),
])

export const plants = table('plants', {
  id: int().primaryKey({ autoIncrement: true }),
  tenantId: int('tenant_id').notNull().references(() => tenants.id),
  name: text().notNull(),
  description: text(),
  nominalCapacityTph: real('nominal_capacity_tph'),  // tonnes per hour
  createdAt: integer({ mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (t) => [
  index('plants_tenant_idx').on(t.tenantId),
])

// ... machines, shifts, fractions, bale_events, stop_events, time_series_readings
// All carry tenantId
```

### Anti-Patterns to Avoid

- **Auth checks only in proxy/middleware:** Proxy is optimistic (cookie read only). Always re-verify in DAL functions — cookies can be forged if SECRET leaks, and static routes may bypass proxy.
- **Passing tenantId as a function argument from pages/components:** Any page component that accepts `tenantId` as input becomes a security hole. DAL functions must extract it from the session themselves.
- **Auth checks in layouts:** Next.js layouts use partial rendering and do NOT re-run on client-side navigation. Never rely on layout-level auth checks as the security boundary.
- **Storing passwords in the JWT:** JWT payload should only contain `userId`, `tenantId`, `role`. Never include password hashes or sensitive PII.
- **Using `next-auth@beta` for credentials-only:** Adds complexity and beta risk for no benefit. The hand-rolled approach with `jose` is simpler and has official docs covering this exact case.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| JWT sign/verify | Custom crypto | `jose` | Edge-compatible, correct alg handling, maintained |
| Password hashing | Custom hash | `bcryptjs` | Timing-safe compare, correct salt rounds |
| Form validation | Custom validators | `zod` v4 | Runtime + compile-time types, Next.js integration |
| DB migrations | SQL files | `drizzle-kit push` / `drizzle-kit generate` | Schema drift prevention, TypeScript schema source of truth |
| Session cookie security | Manual cookie config | Next.js `cookies()` API with HttpOnly/Secure/SameSite flags | Avoids XSS/CSRF configuration errors |

**Key insight:** The only custom code needed is the business logic (tenant scoping, role gates). Everything else has battle-tested library solutions.

---

## Common Pitfalls

### Pitfall 1: next-auth v5 Beta Instability
**What goes wrong:** `next-auth@beta` (v5) has API changes between beta versions; a `npm update` can break auth silently.
**Why it happens:** v5 is `5.0.0-beta.31` as of June 2026 — the stable npm tag is still v4.24.14.
**How to avoid:** Don't use next-auth for this project. Use `jose` + hand-rolled sessions.
**Warning signs:** Any guide telling you to install `next-auth@beta` without pinning an exact version.

### Pitfall 2: Tenant Isolation Through Convention Without Enforcement
**What goes wrong:** A developer adds a new DAL function and forgets to include `WHERE tenant_id = ?`. All tenants see all data.
**Why it happens:** SQLite has no row-level security. Every query must manually include the tenant filter.
**How to avoid:** The DAL pattern enforces this — `verifySession()` is called inside every DAL function; `tenantId` is NEVER passed as a caller argument. Code review checklist: every `db.select().from(X)` must include `.where(eq(X.tenantId, session.tenantId))`.
**Warning signs:** Any function signature like `getPlants(tenantId: number)` — the DAL should get `tenantId` from the session, not the caller.

### Pitfall 3: Auth Checks in Layouts (Next.js Partial Rendering)
**What goes wrong:** Auth check in `layout.tsx` runs once on initial load but NOT on client-side navigation to new routes within the same layout. Users who lose session validity mid-session remain on protected pages.
**Why it happens:** Next.js App Router layouts are persistent during client navigation.
**How to avoid:** Put auth checks in page components and/or in DAL functions (which run on every data fetch). Proxy is the first line of defense for redirects, DAL is the secure line.
**Warning signs:** Seeing `verifySession()` only in layout files.

### Pitfall 4: Storing Role in the JWT Without DB Verification
**What goes wrong:** A user's role changes in the DB but their JWT still carries the old role for up to 7 days.
**Why it happens:** Stateless JWTs are not invalidated when DB data changes.
**How to avoid:** For a demo app this is acceptable — role changes are rare. Document the limitation. For production, add a `jti` claim and a token revocation table, or use shorter-lived JWTs.
**Warning signs:** Role-sensitive operations (admin actions) relying solely on the JWT role without re-querying the DB.

### Pitfall 5: npm Cache Permission Error
**What goes wrong:** `npm install` fails with `EACCES` errors on `~/.npm/_cacache`.
**Why it happens:** Global npm cache at `~/.npm/_cacache` has permission issues in this environment.
**How to avoid:** Always use `npm install --cache .npm-cache` to redirect to a project-local cache. Add `.npm-cache/` to `.gitignore`.
**Warning signs:** Any error mentioning `_cacache` or `EACCES` during npm install.

### Pitfall 6: better-sqlite3 and Next.js Hot Reload
**What goes wrong:** `better-sqlite3` opens the database file and Next.js dev server's hot reload opens multiple connections, causing `SQLITE_BUSY` errors.
**Why it happens:** `better-sqlite3` is synchronous and single-connection; Next.js re-imports modules on change.
**How to avoid:** Use the Node.js global singleton pattern to reuse the db connection across HMR reloads:
```typescript
// src/db/index.ts
import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'

const globalForDb = globalThis as unknown as { db: ReturnType<typeof drizzle> }

export const db = globalForDb.db ?? drizzle(new Database(process.env.DB_FILE_NAME!))
if (process.env.NODE_ENV !== 'production') globalForDb.db = db
```
**Warning signs:** `SQLITE_BUSY` or `database is locked` errors during dev.

---

## Code Examples

### Login Server Action

```typescript
// Source: https://nextjs.org/docs/app/guides/authentication
// src/actions/auth.ts
'use server'
import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { redirect } from 'next/navigation'
import { db } from '@/db'
import { users } from '@/db/schema'
import { eq } from 'drizzle-orm'
import { createSession } from '@/lib/session'

const LoginSchema = z.object({
  email: z.email(),
  password: z.string().min(1),
})

export async function login(prevState: unknown, formData: FormData) {
  const parsed = LoginSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })
  if (!parsed.success) {
    return { errors: parsed.error.flatten().fieldErrors }
  }

  const { email, password } = parsed.data
  const [user] = await db.select().from(users).where(eq(users.email, email))

  if (!user || !user.active || !await bcrypt.compare(password, user.passwordHash)) {
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
```

### Full Database Schema (SIMU-01)

```typescript
// src/db/schema.ts — covers all entities from SIMU-01
import { sqliteTable as table } from 'drizzle-orm/sqlite-core'
import { int, text, real, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core'

export const tenants = table('tenants', {
  id: int().primaryKey({ autoIncrement: true }),
  name: text().notNull(),
  slug: text().notNull(),
  createdAt: integer({ mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (t) => [uniqueIndex('tenants_slug_idx').on(t.slug)])

export const users = table('users', {
  id: int().primaryKey({ autoIncrement: true }),
  tenantId: int('tenant_id').notNull().references(() => tenants.id),
  email: text().notNull(),
  passwordHash: text('password_hash').notNull(),
  name: text().notNull(),
  role: text().notNull(),  // 'operator' | 'produksjonsleder' | 'admin' | 'system_admin'
  active: integer({ mode: 'boolean' }).notNull().default(true),
  createdAt: integer({ mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (t) => [
  uniqueIndex('users_email_idx').on(t.email),
  index('users_tenant_idx').on(t.tenantId),
])

export const plants = table('plants', {
  id: int().primaryKey({ autoIncrement: true }),
  tenantId: int('tenant_id').notNull().references(() => tenants.id),
  name: text().notNull(),
  description: text(),
  nominalCapacityTph: real('nominal_capacity_tph'),
  createdAt: integer({ mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (t) => [index('plants_tenant_idx').on(t.tenantId)])

export const machines = table('machines', {
  id: int().primaryKey({ autoIncrement: true }),
  tenantId: int('tenant_id').notNull().references(() => tenants.id),
  plantId: int('plant_id').notNull().references(() => plants.id),
  name: text().notNull(),
  type: text().notNull(),  // e.g. 'conveyor', 'press', 'optical_sorter', 'bunker'
  nominalCurrentA: real('nominal_current_a'),
  createdAt: integer({ mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
}, (t) => [index('machines_plant_idx').on(t.plantId)])

export const fractions = table('fractions', {
  id: int().primaryKey({ autoIncrement: true }),
  tenantId: int('tenant_id').notNull().references(() => tenants.id),
  plantId: int('plant_id').notNull().references(() => plants.id),
  name: text().notNull(),   // 'Deink', 'Tetra/emballasjepapp', 'OCC', 'Miks'
  sortOrder: int('sort_order').notNull().default(0),
}, (t) => [index('fractions_plant_idx').on(t.plantId)])

export const shifts = table('shifts', {
  id: int().primaryKey({ autoIncrement: true }),
  tenantId: int('tenant_id').notNull().references(() => tenants.id),
  plantId: int('plant_id').notNull().references(() => plants.id),
  shiftType: text('shift_type').notNull(),  // 'day' (07-15) | 'evening' (15-22)
  startAt: integer({ mode: 'timestamp' }).notNull(),
  endAt: integer({ mode: 'timestamp' }).notNull(),
}, (t) => [
  index('shifts_plant_time_idx').on(t.plantId, t.startAt),
])

export const baleEvents = table('bale_events', {
  id: int().primaryKey({ autoIncrement: true }),
  tenantId: int('tenant_id').notNull().references(() => tenants.id),
  plantId: int('plant_id').notNull().references(() => plants.id),
  fractionId: int('fraction_id').notNull().references(() => fractions.id),
  machineId: int('machine_id').references(() => machines.id),  // the press
  occurredAt: integer({ mode: 'timestamp' }).notNull(),
  weightKg: real('weight_kg'),
}, (t) => [
  index('bale_events_plant_time_idx').on(t.plantId, t.occurredAt),
])

export const stopEvents = table('stop_events', {
  id: int().primaryKey({ autoIncrement: true }),
  tenantId: int('tenant_id').notNull().references(() => tenants.id),
  plantId: int('plant_id').notNull().references(() => plants.id),
  startAt: integer({ mode: 'timestamp' }).notNull(),
  endAt: integer({ mode: 'timestamp' }),   // null = ongoing
  reason: text(),      // HMI-reported reason string
  stopType: text('stop_type').notNull(),  // 'fault' | 'idle' | 'planned'
}, (t) => [
  index('stop_events_plant_time_idx').on(t.plantId, t.startAt),
])

// Time-series: 1-min resolution current draw per machine
// Designed for OPC UA adapter swap — same table, same ingest interface
export const timeSeriesReadings = table('time_series_readings', {
  id: int().primaryKey({ autoIncrement: true }),
  tenantId: int('tenant_id').notNull().references(() => tenants.id),
  machineId: int('machine_id').notNull().references(() => machines.id),
  recordedAt: integer({ mode: 'timestamp' }).notNull(),
  currentA: real('current_a'),           // motor current draw in Amps
  runState: integer({ mode: 'boolean' }), // 1=running, 0=stopped
}, (t) => [
  index('ts_machine_time_idx').on(t.machineId, t.recordedAt),
  index('ts_tenant_time_idx').on(t.tenantId, t.recordedAt),
])
```

### Drizzle Config

```typescript
// drizzle.config.ts
import type { Config } from 'drizzle-kit'

export default {
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  dbCredentials: {
    url: process.env.DB_FILE_NAME ?? './stecopro.db',
  },
} satisfies Config
```

### Demo Seed Structure

```typescript
// src/db/seed.ts — run with: npx tsx src/db/seed.ts
// Two tenants: "Steco Demo" (returpapir plant) + "Isolasjonstest" (proves isolation)
import bcrypt from 'bcryptjs'
import { db } from './index'
import { tenants, users, plants, fractions, machines } from './schema'

async function seed() {
  // Tenant 1: Steco Demo
  const [tenant1] = await db.insert(tenants).values({
    name: 'Steco Demo',
    slug: 'steco-demo',
    createdAt: new Date(),
  }).returning()

  // Users for tenant1
  await db.insert(users).values([
    { tenantId: tenant1.id, email: 'operator@steco-demo.no', name: 'Ole Operatør',
      role: 'operator', passwordHash: await bcrypt.hash('demo123', 10), active: true, createdAt: new Date() },
    { tenantId: tenant1.id, email: 'leder@steco-demo.no', name: 'Lise Leder',
      role: 'produksjonsleder', passwordHash: await bcrypt.hash('demo123', 10), active: true, createdAt: new Date() },
    { tenantId: tenant1.id, email: 'admin@steco-demo.no', name: 'Arne Admin',
      role: 'admin', passwordHash: await bcrypt.hash('demo123', 10), active: true, createdAt: new Date() },
  ])

  // Tenant 2: isolation proof
  const [tenant2] = await db.insert(tenants).values({
    name: 'Isolasjonstest',
    slug: 'isolasjonstest',
    createdAt: new Date(),
  }).returning()

  await db.insert(users).values({
    tenantId: tenant2.id, email: 'bruker@isolasjonstest.no', name: 'Isolert Bruker',
    role: 'operator', passwordHash: await bcrypt.hash('demo123', 10), active: true, createdAt: new Date(),
  })
  // Plant and machines for tenant1...
}

seed()
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `next-auth` v4 for simple credentials | Hand-rolled `jose` sessions | Next.js 13+ App Router era | Simpler for credentials-only; v5 still in beta June 2026 |
| `middleware.ts` | `proxy.ts` | Next.js 16 | Same behavior, renamed file and function |
| `getServerSession()` | `auth()` or `cookies()` directly | Next.js App Router | RSC-native session access without API call overhead |
| Prisma + Postgres for MVP | Drizzle + SQLite for demo | 2024–2025 | Zero-setup demo; Drizzle schema is Postgres-portable |
| `bcrypt` (native) | `bcryptjs` (pure JS) | — | No native build step; fine for demo/seeded credentials |

**Deprecated/outdated:**
- `middleware.ts` with exported `middleware` function: replaced by `proxy.ts` with exported `proxy` function in Next.js 16.
- `next-auth` v4 `getServerSession()`: not compatible with App Router server components without a wrapper.
- `pages/api/auth/[...nextauth].ts`: replaced by `app/api/auth/[...nextauth]/route.ts` in App Router; not needed at all if using hand-rolled sessions.

---

## Open Questions

1. **system_admin role scope**
   - What we know: TENA-03 mentions "Steco system admin (tenant management)"; TENA-05 is Phase 5.
   - What's unclear: Does system_admin bypass tenant scoping entirely (sees all tenants), or does it have its own tenant?
   - Recommendation: For Phase 1, create a system_admin user with `tenantId = NULL` (or a special `tenant_id = 0` sentinel). DAL functions should handle `system_admin` as a bypass case. Phase 5 will build the actual UI for this role.

2. **JWT expiry vs. `active` flag**
   - What we know: Users have an `active` boolean. A JWT is valid for 7 days.
   - What's unclear: If a user is deactivated, their existing JWT will still be valid until expiry.
   - Recommendation: For demo phase, this is acceptable. Document the limitation. The DAL's `verifySession()` can optionally re-check `users.active` from the DB for sensitive operations.

3. **Schema migration strategy: push vs. generate**
   - What we know: `drizzle-kit push` applies schema directly (no migration files); `drizzle-kit generate` creates SQL migration files.
   - What's unclear: For a demo that starts fresh each time, `push` is simpler; for a production path, `generate` is safer.
   - Recommendation: Use `drizzle-kit push` for Phase 1 development (fastest iteration). Switch to `drizzle-kit generate` + tracked migration files before any multi-person or production deployment.

---

## Sources

### Primary (HIGH confidence)
- `https://nextjs.org/docs/app/guides/authentication` — Official Next.js 16.2.9 auth guide; full session/DAL/proxy patterns
- `https://orm.drizzle.team/docs/sql-schema-declaration` — Drizzle ORM schema declaration
- `https://orm.drizzle.team/docs/quick-sqlite/better-sqlite3` — Drizzle + better-sqlite3 setup
- `https://orm.drizzle.team/docs/column-types/sqlite` — SQLite column types
- `https://nextjs.org/docs/app/getting-started/project-structure` — Next.js 16.2.9 project structure

### Secondary (MEDIUM confidence)
- npm package versions verified via `npm show [package] version` locally: jose@6.2.3, drizzle-orm@0.45.2, better-sqlite3@12.10.0, drizzle-kit@0.31.10, bcryptjs@3.0.3, zod@4.4.3, next-auth@4.24.14 (stable) / 5.0.0-beta.31 (beta)
- `https://authjs.dev/getting-started/installation` — confirms next-auth v5 still beta
- Multiple community sources confirming next-auth v5 beta status as of June 2026

### Tertiary (LOW confidence)
- WebSearch findings on better-auth Organization plugin for multi-tenancy (not used — overkill for this project)

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — verified via official docs and live npm registry
- Architecture: HIGH — patterns sourced directly from official Next.js 16.2.9 authentication guide
- Pitfalls: HIGH for auth/tenancy pitfalls (verified against official docs); MEDIUM for HMR/SQLite pitfall (community-sourced, plausible)
- Schema design: HIGH — Drizzle official docs, all entity tables designed from SIMU-01 requirements

**Research date:** 2026-06-11
**Valid until:** 2026-09-11 (stable stack; re-check if next-auth v5 goes stable)
